/**
 * POST /api/contact
 *
 * Vercel serverless function (Node runtime) that relays landing-page
 * contact form submissions to the HuntFlow inbox via Resend's HTTP API.
 *
 * The Vercel project root /api directory is auto-detected by Vercel and
 * each .ts file becomes its own function, even though the rest of the
 * app is built with @sveltejs/adapter-static. Functions take priority
 * over the catch-all SPA rewrite in vercel.json, so this endpoint is
 * always reachable at /api/contact in production.
 *
 * Environment:
 *   RESEND_API_KEY  Required. Resend API key for the xalgorix.com sender
 *                   domain. Set in Vercel project env vars; never commit.
 *
 * Sender:
 *   from      "HuntFlow <huntflow@xalgorix.com>"
 *   to        ["huntflow@xalgorix.com"]
 *   reply_to  the visitor's email so the team can reply directly
 *
 * Anti-abuse:
 *   - Honeypot field "website" must be empty (bots fill all fields).
 *   - Field length caps prevent abuse of the relay as a spam vector.
 *   - We deliberately swallow honeypot hits with a 200 so bots don't
 *     learn anything from the response.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'HuntFlow <huntflow@xalgorix.com>';
const TO_ADDRESS = 'huntflow@xalgorix.com';

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;
const MAX_BODY_BYTES = 16_384;

interface ContactPayload {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
  website?: unknown; // honeypot
}

interface ContactClean {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// In-memory per-IP rate limit (token bucket). NOT shared across
// serverless instances and resets on cold start — defense-in-depth only,
// not a hard guarantee. Caps burst abuse of the Resend relay.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: VercelRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0].trim();
  return req.socket?.remoteAddress ?? 'unknown';
}

function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function trim(value: unknown, max: number): string {
  if (!isString(value)) return '';
  return value.trim().slice(0, max);
}

function isValidEmail(value: string): boolean {
  // Pragmatic email check — rejects obvious garbage but keeps the regex
  // small. Requires a 2+ char final label (TLD) to cut common noise.
  // Resend does its own validation server-side anyway.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function validate(payload: ContactPayload): ContactClean | { error: string } {
  // Honeypot: bots fill every field, real users never see this one.
  // Return a fake-success-shaped object so the caller can short-circuit.
  if (isString(payload.website) && payload.website.trim().length > 0) {
    return { error: '__honeypot__' };
  }

  const name = trim(payload.name, MAX_NAME);
  const email = trim(payload.email, MAX_EMAIL);
  const subject = trim(payload.subject, MAX_SUBJECT);
  const message = trim(payload.message, MAX_MESSAGE);

  if (name.length < 2) return { error: 'Please enter your name.' };
  if (!isValidEmail(email)) return { error: 'Please enter a valid email address.' };
  if (message.length < 10) {
    return { error: 'Please share a few more details so we can help.' };
  }

  return { name, email, subject, message };
}

function buildSubject(clean: ContactClean): string {
  if (clean.subject) return `[HuntFlow] ${clean.subject}`;
  return `[HuntFlow] New contact from ${clean.name}`;
}

function buildHtml(clean: ContactClean): string {
  const safeName = escapeHtml(clean.name);
  const safeEmail = escapeHtml(clean.email);
  const safeSubject = escapeHtml(clean.subject || '(no subject)');
  const safeMessage = escapeHtml(clean.message).replace(/\n/g, '<br />');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#0f172a;color:#e2e8f0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#5eead4;">New contact</p>
      <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;color:#f1f5f9;">${safeSubject}</h1>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#cbd5e1;">
        <tr>
          <td style="padding:6px 0;color:#94a3b8;width:80px;">Name</td>
          <td style="padding:6px 0;">${safeName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#94a3b8;">Email</td>
          <td style="padding:6px 0;"><a href="mailto:${safeEmail}" style="color:#5eead4;text-decoration:none;">${safeEmail}</a></td>
        </tr>
      </table>
      <hr style="border:none;border-top:1px solid #334155;margin:16px 0;" />
      <div style="font-size:14px;line-height:1.6;color:#e2e8f0;white-space:pre-wrap;">${safeMessage}</div>
      <p style="margin:24px 0 0;font-size:11px;color:#64748b;">Sent via huntflow.xalgorix.com</p>
    </div>
  </body>
</html>`;
}

function buildText(clean: ContactClean): string {
  return [
    `New contact from huntflow.xalgorix.com`,
    ``,
    `Name:    ${clean.name}`,
    `Email:   ${clean.email}`,
    `Subject: ${clean.subject || '(none)'}`,
    ``,
    `Message:`,
    clean.message
  ].join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'Request body too large.' });
    return;
  }

  const ip = clientIp(req);
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    res.status(429).json({ error: 'Too many messages from this address. Please try again later.' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY is not configured');
    res.status(500).json({
      error: 'Email service is not configured. Please email huntflow@xalgorix.com directly.'
    });
    return;
  }

  // Vercel parses JSON bodies automatically when content-type is set,
  // but be defensive in case a client sends a string.
  let payload: ContactPayload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    res.status(400).json({ error: 'Invalid JSON body.' });
    return;
  }

  const validated = validate(payload);
  if ('error' in validated) {
    if (validated.error === '__honeypot__') {
      // Pretend everything worked so bots don't learn the trap exists.
      res.status(200).json({ ok: true });
      return;
    }
    res.status(400).json({ error: validated.error });
    return;
  }

  try {
    const resendResponse = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        reply_to: validated.email,
        subject: buildSubject(validated),
        html: buildHtml(validated),
        text: buildText(validated)
      })
    });

    if (!resendResponse.ok) {
      const detail = await resendResponse.text();
      console.error('[contact] Resend rejected request', resendResponse.status, detail);
      res.status(502).json({
        error: 'We could not deliver your message. Please try again or email huntflow@xalgorix.com.'
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] Resend request failed', err);
    res.status(502).json({
      error: 'We could not deliver your message. Please try again or email huntflow@xalgorix.com.'
    });
  }
}
