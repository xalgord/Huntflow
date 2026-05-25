import { httpActionGeneric, httpRouter } from 'convex/server';
import { Webhook } from 'standardwebhooks';
import { internal } from './_generated/api';

/**
 * Dodo Payments webhook receiver.
 *
 * Convex exposes this module's default-exported `httpRouter` at
 * `https://<deployment>.convex.site/dodo-webhook`. Dodo POSTs every
 * subscription lifecycle event here. The handler:
 *
 *   1. Reads the raw body (Standard Webhooks signs the literal bytes,
 *      so we must NOT round-trip through `JSON.parse` before verifying).
 *   2. Collects the three Standard Webhooks headers (`webhook-id`,
 *      `webhook-timestamp`, `webhook-signature`).
 *   3. Verifies the HMAC-SHA256 signature using
 *      `process.env.DODO_WEBHOOK_SIGNING_SECRET`. A missing or invalid
 *      signature returns `401 Unauthorized` and performs no mutation
 *      (Requirement 7.3).
 *   4. Parses the verified event into the entitlement upsert args via
 *      `parseDodoEvent`. Ignored event types return `200 OK` with no
 *      mutation. A missing `data.metadata.uid` returns `400 Bad
 *      Request` with no mutation — Dodo cannot map an event back to a
 *      Firebase user without it, and silently falling back to email
 *      lookup would let a Dodo-side spoof attach Pro to an arbitrary
 *      address (design "Data Models — Dodo Webhook Event Schema").
 *   5. On a parsed event, calls the internal
 *      `entitlements.upsertFromWebhook` mutation. Idempotency is
 *      handled on the mutation side (insert-or-patch by uid), so
 *      replayed `webhook-id` deliveries converge on the same row.
 *
 * `parseDodoEvent` is exported separately so Wave 6 Property 3 can
 * exercise the event-type → entitlement mapping directly without
 * spinning up an HTTP server.
 *
 * Validates Requirements 7.1, 7.2, 7.3, 12.5.
 */

/**
 * Args passed to `internal.entitlements.upsertFromWebhook`.
 *
 * `dodoSubscriptionId` and `currentPeriodEnd` are nullable to match
 * the schema's `v.union(v.string(), v.null())` and
 * `v.union(v.number(), v.null())` columns. We never write `undefined`
 * because Convex serializes that as a missing field and the schema
 * would reject it.
 */
export interface ParsedDodoEvent {
	uid: string;
	isPro: boolean;
	dodoCustomerId: string;
	dodoSubscriptionId: string | null;
	currentPeriodEnd: number | null;
}

/**
 * Distinguishable marker for "event payload is well-formed and the
 * event type is one we consume, but `data.metadata.uid` is missing."
 * The handler maps this sentinel to a 400 response.
 *
 * A `Symbol` is used (rather than a magic string) so callers can check
 * identity with `=== MISSING_UID_MARKER` and TypeScript's narrowing
 * keeps the success branch typed as `ParsedDodoEvent`. Tests in Wave 6
 * import this marker directly.
 */
export const MISSING_UID_MARKER: unique symbol = Symbol(
	'parseDodoEvent.missing_uid'
);

/**
 * Maps the consumed Dodo event types onto `isPro`. Anything not in
 * this table is ignored (handler returns 200 OK).
 *
 *   subscription.active    → isPro = true
 *   subscription.renewed   → isPro = true (refreshes currentPeriodEnd)
 *   subscription.cancelled → isPro = false
 *   subscription.expired   → isPro = false
 *   subscription.failed    → isPro = false (failed billing)
 *
 * `payment.succeeded`, `dispute.*`, `refund.*` and friends are not
 * listed here, so `parseDodoEvent` returns `null` for them.
 */
const EVENT_IS_PRO: Record<string, boolean> = {
	'subscription.active': true,
	'subscription.renewed': true,
	'subscription.cancelled': false,
	'subscription.expired': false,
	'subscription.failed': false
};

/**
 * Coerce an unknown value into a string, returning `''` if it isn't
 * already a string. Whitespace is trimmed so a payload that supplies
 * `customer_id: '   '` is treated as missing.
 */
function asTrimmedString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * Parse `data.next_billing_date` into a ms-epoch number. Dodo emits
 * ISO 8601 strings (or `null` when no next billing date applies, e.g.
 * a cancelled subscription mid-cycle). Returns `null` if the value is
 * missing, not a string, or unparseable. We never throw here so a
 * weird date string from Dodo doesn't poison the whole handler — the
 * row gets written with `currentPeriodEnd: null` and the operator can
 * reconcile later.
 */
function parseCurrentPeriodEnd(value: unknown): number | null {
	if (typeof value !== 'string' || value.length === 0) return null;
	const ms = Date.parse(value);
	return Number.isFinite(ms) ? ms : null;
}

/**
 * Parse a verified Dodo webhook event into the entitlement upsert
 * args. Returns:
 *
 *   - a `ParsedDodoEvent` when the event type is consumed and
 *     `data.metadata.uid` is present;
 *   - `MISSING_UID_MARKER` when the event type is consumed but
 *     `data.metadata.uid` is missing (handler returns 400);
 *   - `null` for any other event type (handler returns 200).
 *
 * The function is total: it never throws on a malformed payload. A
 * payload missing the expected `data` block returns `null` (treated
 * as "ignored"), because at that point the event isn't structurally
 * a subscription event we could act on.
 */
export function parseDodoEvent(
	event: unknown
): ParsedDodoEvent | typeof MISSING_UID_MARKER | null {
	if (!event || typeof event !== 'object') return null;
	const root = event as Record<string, unknown>;

	const type = typeof root.type === 'string' ? root.type : '';
	if (!(type in EVENT_IS_PRO)) return null;
	const isPro = EVENT_IS_PRO[type];

	const data =
		root.data && typeof root.data === 'object'
			? (root.data as Record<string, unknown>)
			: null;
	if (!data) return null;

	const metadata =
		data.metadata && typeof data.metadata === 'object'
			? (data.metadata as Record<string, unknown>)
			: {};
	const uid = asTrimmedString(metadata.uid);
	if (!uid) return MISSING_UID_MARKER;

	// Customer id: prefer `data.customer.customer_id` (Standard Dodo
	// shape per the design's Data Models section). Fall back to a
	// flat `data.customer_id` if Dodo ever emits one. Empty string is
	// acceptable per the schema (the column is `v.string()`, not
	// nullable, and entitlement rows tolerate an empty customer id
	// for audit purposes).
	let dodoCustomerId = '';
	const customer =
		data.customer && typeof data.customer === 'object'
			? (data.customer as Record<string, unknown>)
			: null;
	if (customer) {
		dodoCustomerId = asTrimmedString(customer.customer_id);
	}
	if (!dodoCustomerId) {
		dodoCustomerId = asTrimmedString(data.customer_id);
	}

	const subscriptionId = asTrimmedString(data.subscription_id);
	const dodoSubscriptionId = subscriptionId === '' ? null : subscriptionId;

	const currentPeriodEnd = parseCurrentPeriodEnd(data.next_billing_date);

	return {
		uid,
		isPro,
		dodoCustomerId,
		dodoSubscriptionId,
		currentPeriodEnd
	};
}

/**
 * Build a `text/plain` Response with the given status and body. Used
 * for every webhook reply so curl/operator inspection is readable.
 */
function plainResponse(body: string, status: number): Response {
	return new Response(body, {
		status,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
}

const dodoWebhook = httpActionGeneric(async (ctx, request) => {
	// Standard Webhooks signs the literal bytes of the body. We must
	// pass the raw text into `wh.verify` — re-stringifying a JSON.parse
	// result would change whitespace and break the signature.
	const rawBody = await request.text();

	const headers = {
		'webhook-id': request.headers.get('webhook-id') ?? '',
		'webhook-timestamp': request.headers.get('webhook-timestamp') ?? '',
		'webhook-signature': request.headers.get('webhook-signature') ?? ''
	};

	// Default the secret to '' rather than using a non-null assertion
	// so a misconfigured Convex deployment fails as 401 (signature
	// mismatch) instead of crashing the action with a TypeError. The
	// edge-case table in the design notes this: missing secret →
	// every delivery rejected, surfacing as Dodo dashboard failures.
	const secret = process.env.DODO_WEBHOOK_SIGNING_SECRET ?? '';

	let event: unknown;
	try {
		const wh = new Webhook(secret);
		event = wh.verify(rawBody, headers);
	} catch {
		return plainResponse('Invalid signature', 401);
	}

	const parsed = parseDodoEvent(event);

	if (parsed === null) {
		// Ignored event type (e.g. payment.succeeded, dispute.*).
		return plainResponse('Ignored event type', 200);
	}

	if (parsed === MISSING_UID_MARKER) {
		// Event type is one we consume, but Dodo didn't echo back the
		// `metadata.uid` we set on the checkout. Without uid we cannot
		// safely key the entitlement row, so we reject the delivery.
		return plainResponse('Missing metadata.uid', 400);
	}

	await ctx.runMutation(internal.entitlements.upsertFromWebhook, parsed);
	return plainResponse('ok', 200);
});

const http = httpRouter();
http.route({
	path: '/dodo-webhook',
	method: 'POST',
	handler: dodoWebhook
});

export default http;
