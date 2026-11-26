/**
 * Dodo Payments: hosted checkout, customer portal, and the
 * subscription webhook that writes HuntFlow Pro entitlements.
 *
 *   POST /api/billing/checkout   { returnUrl, cancelUrl } → { checkoutUrl }
 *   POST /api/billing/portal                              → { url }
 *   POST /api/webhooks/dodo      Standard Webhooks-signed event
 */
import { Webhook } from 'standardwebhooks';

import type { AuthUser } from './auth';
import { entitlementUpsert, getEntitlement } from './entitlements';
import { envValue, type Env } from './env';
import { HttpError, isRecord, json, readJson } from './http';

function requireSetting(env: Env, name: keyof Env): string {
  const value = envValue(env, name);
  if (!value) {
    console.error(`[billing] ${String(name)} is not configured`);
    throw new HttpError(503, 'billing_not_configured', 'Billing is not available right now. Please try again later.');
  }
  return value.replace(/\/+$/, '');
}

function requireRedirectUrl(name: string, value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'bad_request', `${name} must be a URL.`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(400, 'bad_request', `${name} must be an absolute http(s) URL.`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HttpError(400, 'bad_request', `${name} must be an http(s) URL.`);
  }
  return parsed.toString();
}

async function dodoFailure(label: string, response: Response): Promise<never> {
  const detail = await response.text().catch(() => '');
  console.error(`[billing] Dodo ${label} failed`, response.status, detail.slice(0, 500));
  throw new HttpError(502, 'billing_upstream', 'The payment provider did not respond. Please try again.');
}

export async function handleCheckout(request: Request, env: Env, user: AuthUser): Promise<Response> {
  const body = await readJson<unknown>(request, 8 * 1024);
  const input = isRecord(body) ? body : {};
  const returnUrl = requireRedirectUrl('returnUrl', input.returnUrl);
  const cancelUrl = requireRedirectUrl('cancelUrl', input.cancelUrl);

  const baseUrl = requireSetting(env, 'DODO_API_BASE_URL');
  const apiKey = requireSetting(env, 'DODO_API_KEY');
  const productId = requireSetting(env, 'DODO_PRO_PRODUCT_ID');

  const response = await fetch(`${baseUrl}/checkouts`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email: user.email },
      metadata: { uid: user.uid },
      return_url: returnUrl,
      cancel_url: cancelUrl
    })
  });
  if (!response.ok) await dodoFailure('checkout', response);

  const result = (await response.json()) as { checkout_url?: unknown };
  const checkoutUrl = typeof result.checkout_url === 'string' ? result.checkout_url : '';
  if (!checkoutUrl) throw new HttpError(502, 'billing_upstream', 'The payment provider returned no checkout link.');
  return json({ checkoutUrl });
}

export async function handlePortal(env: Env, user: AuthUser): Promise<Response> {
  const entitlement = await getEntitlement(env.DB, user.uid);
  const customerId = entitlement?.dodo_customer_id?.trim() ?? '';
  if (!customerId) throw new HttpError(404, 'no_subscription', 'No active subscription.');

  const baseUrl = requireSetting(env, 'DODO_API_BASE_URL');
  const apiKey = requireSetting(env, 'DODO_API_KEY');
  const response = await fetch(
    `${baseUrl}/customers/${encodeURIComponent(customerId)}/customer-portal/session`,
    { method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' } }
  );
  if (!response.ok) await dodoFailure('customer portal', response);

  const result = (await response.json()) as { link?: unknown; url?: unknown; portal_url?: unknown };
  const url = [result.link, result.url, result.portal_url].find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0
  );
  if (!url) throw new HttpError(502, 'billing_upstream', 'The payment provider returned no portal link.');
  return json({ url });
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export interface ParsedDodoEvent {
  uid: string;
  isPro: boolean;
  dodoCustomerId: string;
  dodoSubscriptionId: string | null;
  currentPeriodEnd: number | null;
}

export const MISSING_UID_MARKER: unique symbol = Symbol('parseDodoEvent.missing_uid');

/** Consumed event types → resulting Pro state. Anything else is ignored. */
const EVENT_IS_PRO: Record<string, boolean> = {
  'subscription.active': true,
  'subscription.renewed': true,
  'subscription.cancelled': false,
  'subscription.expired': false,
  'subscription.failed': false
};

const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;
const CUSTOMER_RE = /^(cus_[A-Za-z0-9_-]+|[A-Za-z0-9_-]+)$/;
const SUBSCRIPTION_RE = /^[A-Za-z0-9_-]+$/;

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePeriodEnd(value: unknown): number | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Map a verified Dodo event to an entitlement update. Returns `null`
 * for event types we don't consume and `MISSING_UID_MARKER` when a
 * consumed event lacks a valid `data.metadata.uid` (set at checkout).
 * Never throws.
 */
export function parseDodoEvent(event: unknown): ParsedDodoEvent | typeof MISSING_UID_MARKER | null {
  if (!isRecord(event)) return null;
  const type = typeof event.type === 'string' ? event.type : '';
  if (!(type in EVENT_IS_PRO)) return null;
  const data = isRecord(event.data) ? event.data : null;
  if (!data) return null;

  const metadata = isRecord(data.metadata) ? data.metadata : {};
  const uid = trimmed(metadata.uid);
  if (!uid || !UID_RE.test(uid)) return MISSING_UID_MARKER;

  let dodoCustomerId = isRecord(data.customer) ? trimmed(data.customer.customer_id) : '';
  if (!dodoCustomerId) dodoCustomerId = trimmed(data.customer_id);
  if (dodoCustomerId && !CUSTOMER_RE.test(dodoCustomerId)) dodoCustomerId = '';

  const subscriptionId = trimmed(data.subscription_id);
  const dodoSubscriptionId = subscriptionId && SUBSCRIPTION_RE.test(subscriptionId) ? subscriptionId : null;

  return {
    uid,
    isPro: EVENT_IS_PRO[type],
    dodoCustomerId,
    dodoSubscriptionId,
    currentPeriodEnd: parsePeriodEnd(data.next_billing_date)
  };
}

function plain(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

export async function handleDodoWebhook(request: Request, env: Env): Promise<Response> {
  // Standard Webhooks signs the literal body bytes: verify before parsing.
  const rawBody = await request.text();
  const headers = {
    'webhook-id': request.headers.get('webhook-id') ?? '',
    'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
    'webhook-signature': request.headers.get('webhook-signature') ?? ''
  };

  const secret = envValue(env, 'DODO_WEBHOOK_SIGNING_SECRET');
  if (!secret) {
    console.error('[billing] DODO_WEBHOOK_SIGNING_SECRET is not configured');
    return plain('Webhook not configured', 503);
  }

  let event: unknown;
  try {
    event = new Webhook(secret).verify(rawBody, headers);
  } catch {
    return plain('Invalid signature', 401);
  }

  const parsed = parseDodoEvent(event);
  if (parsed === null) return plain('Ignored event type', 200);
  if (parsed === MISSING_UID_MARKER) return plain('Missing or invalid metadata.uid', 400);

  const webhookId = headers['webhook-id'];
  if (webhookId) {
    const seen = await env.DB.prepare('SELECT 1 AS hit FROM webhook_deliveries WHERE webhook_id = ?1')
      .bind(webhookId)
      .first<{ hit: number }>();
    if (seen) return plain('Duplicate webhook delivery', 200);
  }

  const seconds = Number.parseInt(headers['webhook-timestamp'], 10);
  const eventTime = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : Date.now();

  // Apply and record atomically so a failed apply is retried by Dodo.
  const statements = [entitlementUpsert(env.DB, { ...parsed, eventTime })];
  if (webhookId) {
    statements.push(
      env.DB.prepare(
        'INSERT INTO webhook_deliveries (webhook_id, delivered_at) VALUES (?1, ?2) ON CONFLICT (webhook_id) DO NOTHING'
      ).bind(webhookId, Date.now())
    );
  }
  await env.DB.batch(statements);
  return plain('ok', 200);
}
