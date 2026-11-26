/**
 * POST /api/contact — relays landing-page contact messages to the
 * HuntFlow inbox through Resend.
 *
 * Anti-abuse: a honeypot field (`website`) that real users never see,
 * field length caps, and a D1-backed fixed-window limit of 3 messages
 * per 10 minutes per client. The limiter key is a SHA-256 of the IP,
 * so raw addresses are never stored.
 */
import { envValue, type Env } from './env';
import { HttpError, isRecord, json, readJson } from './http';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'HuntFlow <huntflow@xalgorix.com>';
const TO_ADDRESS = 'huntflow@xalgorix.com';

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;
const MAX_BODY_BYTES = 16_384;

const WINDOW_MS = 10 * 60 * 1000;
const WINDOW_MAX = 3;

const DELIVERY_ERROR = 'We could not deliver your message. Please try again or email huntflow@xalgorix.com.';

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Returns the clean message, `'honeypot'` for bots, or an error string. */
export function validateContact(input: unknown): ContactMessage | 'honeypot' | { error: string } {
  const payload = isRecord(input) ? input : {};
  if (typeof payload.website === 'string' && payload.website.trim().length > 0) return 'honeypot';

  const name = clip(payload.name, MAX_NAME);
  const email = clip(payload.email, MAX_EMAIL);
  const subject = clip(payload.subject, MAX_SUBJECT);
  const message = clip(payload.message, MAX_MESSAGE);

  if (name.length < 2) return { error: 'Please enter your name.' };
  if (!isValidEmail(email)) return { error: 'Please enter a valid email address.' };
  if (message.length < 10) return { error: 'Please share a few more details so we can help.' };
  return { name, email, subject, message };
}

export function contactEmail(clean: ContactMessage): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(clean.name);
  const safeEmail = escapeHtml(clean.email);
  const safeSubject = escapeHtml(clean.subject || '(no subject)');
  const safeMessage = escapeHtml(clean.message).replace(/\n/g, '<br />');
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f7;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5ea;border-radius:14px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;color:#86868b;">New contact</p>
      <h1 style="margin:0 0 16px;font-size:19px;font-weight:600;">${safeSubject}</h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#86868b;width:80px;">Name</td><td style="padding:6px 0;">${safeName}</td></tr>
        <tr><td style="padding:6px 0;color:#86868b;">Email</td><td style="padding:6px 0;"><a href="mailto:${safeEmail}" style="color:#0071e3;text-decoration:none;">${safeEmail}</a></td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e5ea;margin:16px 0;" />
      <div style="font-size:15px;line-height:1.55;white-space:pre-wrap;">${safeMessage}</div>
      <p style="margin:24px 0 0;font-size:12px;color:#86868b;">Sent via huntflow.xalgorix.com</p>
    </div>
  </body>
</html>`;
  const text = [
    'New contact from huntflow.xalgorix.com',
    '',
    `Name:    ${clean.name}`,
    `Email:   ${clean.email}`,
    `Subject: ${clean.subject || '(none)'}`,
    '',
    'Message:',
    clean.message
  ].join('\n');
  const subject = clean.subject ? `[HuntFlow] ${clean.subject}` : `[HuntFlow] New contact from ${clean.name}`;
  return { subject, html, text };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Fixed-window counter. Returns seconds until retry when the limit is hit. */
export async function hitRateLimit(db: D1Database, key: string, now = Date.now()): Promise<number | null> {
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start <= ?2 - ?3 THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start <= ?2 - ?3 THEN ?2 ELSE rate_limits.window_start END
       RETURNING window_start, count`
    )
    .bind(key, now, WINDOW_MS)
    .first<{ window_start: number; count: number }>();
  if (!row || row.count <= WINDOW_MAX) return null;
  return Math.max(1, Math.ceil((row.window_start + WINDOW_MS - now) / 1000));
}

export async function handleContact(request: Request, env: Env): Promise<Response> {
  const body = await readJson<unknown>(request, MAX_BODY_BYTES);
  const validated = validateContact(body);
  if (validated === 'honeypot') return json({ ok: true });
  if ('error' in validated) throw new HttpError(400, 'invalid', validated.error);

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const retryAfter = await hitRateLimit(env.DB, `contact:${await sha256Hex(ip)}`);
  if (retryAfter !== null) {
    return json(
      { error: 'Too many messages from this address. Please try again later.', code: 'rate_limited' },
      { status: 429, headers: { 'retry-after': String(retryAfter) } }
    );
  }

  const apiKey = envValue(env, 'RESEND_API_KEY');
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY is not configured');
    throw new HttpError(503, 'not_configured', 'Email service is not configured. Please email huntflow@xalgorix.com directly.');
  }

  const mail = contactEmail(validated);
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [TO_ADDRESS],
      reply_to: validated.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text
    })
  });
  if (!response.ok) {
    console.error('[contact] Resend rejected request', response.status, (await response.text()).slice(0, 300));
    throw new HttpError(502, 'delivery_failed', DELIVERY_ERROR);
  }
  return json({ ok: true });
}
