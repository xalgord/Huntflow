import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action } from './_generated/server';

/**
 * Dodo Payments integration: checkout + customer-portal entry points.
 *
 * Both endpoints are `actionGeneric` rather than mutations because they
 * make outbound HTTPS requests to the Dodo REST API. Convex actions are
 * the only place where `fetch` is permitted on the server side.
 *
 * Auth: every action requires a Firebase identity. The identity's
 * `subject` claim is the Firebase `uid`, which we propagate to Dodo as
 * `metadata.uid` on checkout (so the eventual webhook can key the
 * entitlement row back to the right user) and use to look up the
 * existing `entitlements` row when minting a customer-portal session.
 *
 * Env vars: read once per call from `process.env`. We trim and validate
 * each one and throw an actionable `ConvexError` if any are missing,
 * mirroring the loud-fail pattern in `convex/auth.config.ts`. A silent
 * fallback to `''` would surface as a confusing 401/404 from Dodo.
 */

/**
 * Read a required Convex env var. Trims whitespace and throws a
 * `ConvexError` with the variable name if the value is missing or
 * empty after trimming. The error message names the var so an
 * operator running `npx convex env set` knows exactly what to fix.
 */
function requireEnv(name: string): string {
	const raw = process.env[name];
	const trimmed = typeof raw === 'string' ? raw.trim() : '';
	if (!trimmed) {
		throw new ConvexError(
			`${name} is not set on the Convex deployment. ` +
				`Run: npx convex env set ${name} <value>`
		);
	}
	return trimmed;
}

/**
 * Create a Dodo Payments checkout session for the calling user.
 *
 * Requires an authenticated Firebase identity. The action POSTs to
 * `${DODO_API_BASE_URL}/checkouts` with a single-line `product_cart`
 * containing `DODO_PRO_PRODUCT_ID`, the caller's email pulled from the
 * verified Firebase ID token, and `metadata.uid` set to the Firebase
 * `subject` claim. The webhook handler in `convex/http.ts` reads
 * `metadata.uid` back out of the event payload to key the entitlement
 * upsert, so it MUST be set here.
 *
 * OQ 1 — checkout response field. Verified against Dodo test mode
 * (POST https://test.dodopayments.com/checkouts) on 2026-05-25:
 * the response is `{ session_id, checkout_url, ... }`. We pick
 * `checkout_url`. This matches the docs at
 * https://docs.dodopayments.com/api-reference/checkout-sessions/create
 * and the Subscription Integration Guide example.
 *
 * Returns `{ checkoutUrl }`. The client navigates to the URL with a
 * full-page redirect (Dodo's hosted checkout is not embeddable).
 *
 * Validates Requirements 8.1, 12.4, 12.5.
 */
export const createCheckoutSession = action({
	args: {
		returnUrl: v.string(),
		cancelUrl: v.string()
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error('Not authenticated');
		}

		const baseUrl = requireEnv('DODO_API_BASE_URL');
		const apiKey = requireEnv('DODO_API_KEY');
		const productId = requireEnv('DODO_PRO_PRODUCT_ID');

		const res = await fetch(`${baseUrl}/checkouts`, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				product_cart: [{ product_id: productId, quantity: 1 }],
				customer: { email: identity.email ?? '' },
				metadata: { uid: identity.subject },
				return_url: args.returnUrl,
				cancel_url: args.cancelUrl
			})
		});

		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw new ConvexError(
				`Dodo checkout request failed: ${res.status} ${res.statusText}${
					detail ? ` — ${detail.slice(0, 500)}` : ''
				}`
			);
		}

		const json = (await res.json()) as { checkout_url?: unknown };
		const checkoutUrl = typeof json.checkout_url === 'string' ? json.checkout_url : '';
		if (!checkoutUrl) {
			throw new ConvexError(
				'Dodo checkout response missing `checkout_url` field.'
			);
		}

		return { checkoutUrl };
	}
});

/**
 * Mint a Dodo customer-portal URL so the calling user can manage their
 * existing subscription (update payment method, cancel, view invoices).
 *
 * Requires an authenticated Firebase identity AND an existing
 * `entitlements` row with a non-empty `dodoCustomerId`. We read the
 * entitlement via the internal `entitlements.getMineInternal` query —
 * the public `getMine` projects away payment ids so they never reach
 * the browser, but this server-side action legitimately needs
 * `dodoCustomerId` to mint a portal session. Both queries gate on
 * `ctx.auth.getUserIdentity()`, so when this action propagates auth
 * into `runQuery`, the row returned belongs to the authenticated
 * caller. This is the OQ 7 design default ("server reads
 * entitlement"), kept unless an operator overrides it.
 *
 * The action POSTs to
 * `${DODO_API_BASE_URL}/customers/${customerId}/customer-portal/session`
 * (note: SINGULAR `session`, not `sessions`) with bearer auth and no
 * body, matching Dodo's documented contract. The plural form returns
 * 404 — verified against test mode on 2026-05-25.
 *
 * OQ 1 — portal response field. Verified against Dodo test mode on
 * 2026-05-25 by calling the live test endpoint with a real customer
 * id: the response is exactly `{ "link": "<jwt-protected url>" }`.
 * Confirmed by Dodo's docs:
 * https://docs.dodopayments.com/api-reference/customers/create-customer-portal-session
 * (the documented response shape is `{ "link": "<string>" }`). The
 * Node SDK example also reads `customerPortalSession.link`. We pick
 * `link` as the canonical field but accept `url` and `portal_url` as
 * fallbacks so a future Dodo-side rename surfaces a working URL
 * rather than a hard ConvexError. Priority order: link → url →
 * portal_url. Update this fallback list (or drop it entirely) if
 * Dodo ever publishes a different field name in production.
 *
 * Returns `{ url }`. The caller navigates to the URL with a full-page
 * redirect.
 *
 * Validates Requirements 8.3, 12.4, 12.5.
 */
export const getCustomerPortalUrl = action({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error('Not authenticated');
		}

		// Read the full entitlement row server-side via the internal
		// query. The public `entitlements.getMine` projects away
		// payment ids so they never reach the browser; the portal
		// action legitimately needs `dodoCustomerId`, so it uses the
		// internal surface that returns the whole row. Auth propagates
		// into the runQuery, so the row belongs to the caller.
		const entitlement = (await ctx.runQuery(internal.entitlements.getMineInternal, {})) as {
			dodoCustomerId?: string | null;
		} | null;

		const customerId = entitlement?.dodoCustomerId?.trim() ?? '';
		if (!customerId) {
			throw new ConvexError('No active subscription');
		}

		const baseUrl = requireEnv('DODO_API_BASE_URL');
		const apiKey = requireEnv('DODO_API_KEY');

		const res = await fetch(
			`${baseUrl}/customers/${encodeURIComponent(customerId)}/customer-portal/session`,
			{
				method: 'POST',
				headers: {
					authorization: `Bearer ${apiKey}`,
					'content-type': 'application/json'
				}
			}
		);

		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw new ConvexError(
				`Dodo customer-portal request failed: ${res.status} ${res.statusText}${
					detail ? ` — ${detail.slice(0, 500)}` : ''
				}`
			);
		}

		const json = (await res.json()) as {
			link?: unknown;
			url?: unknown;
			portal_url?: unknown;
		};

		// Priority: link (verified canonical) → url → portal_url.
		const candidates = [json.link, json.url, json.portal_url];
		const url = candidates.find(
			(c): c is string => typeof c === 'string' && c.length > 0
		);
		if (!url) {
			throw new ConvexError(
				'Dodo customer-portal response missing `link`, `url`, and `portal_url` fields.'
			);
		}

		return { url };
	}
});
