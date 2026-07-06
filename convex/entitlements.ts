import { v } from 'convex/values';

import { internalMutation, internalQuery, query } from './_generated/server';

/**
 * Read the current user's Pro entitlement row. Returns `null` when:
 *   - the caller is unauthenticated (no Firebase ID token), or
 *   - the user has no row yet (free tier; the Dodo webhook hasn't
 *     written one because they've never subscribed).
 *
 * The client treats `null` as `isPro: false`. Source of truth lives
 * in this table; the webhook handler in `convex/http.ts` writes it
 * via `upsertFromWebhook` after verifying the Standard Webhooks
 * signature. The client never writes the entitlement directly.
 */
export const getMine = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const row = await ctx.db
			.query('entitlements')
			.withIndex('by_uid', (q) => q.eq('uid', identity.subject))
			.first();
		// Project to the minimal shape the client needs. Payment ids
		// (dodoCustomerId, dodoSubscriptionId) never cross the wire to
		// the browser — the customer-portal action reads them directly
		// from the table server-side instead of via this query.
		if (!row) return null;
		return { isPro: row.isPro, currentPeriodEnd: row.currentPeriodEnd };
	}
});

/**
 * Internal counterpart of `getMine` that returns the FULL entitlement
 * row (including payment ids). Used only by server-side actions such as
 * `dodo.getCustomerPortalUrl`, which need `dodoCustomerId` to mint a
 * portal session. Internal so the client can never call it — the public
 * `getMine` is the only entitlement surface exposed to the browser, and
 * it projects away payment ids.
 */
export const getMineInternal = internalQuery({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		return await ctx.db
			.query('entitlements')
			.withIndex('by_uid', (q) => q.eq('uid', identity.subject))
			.first();
	}
});

/**
 * Upsert an entitlement row from a verified Dodo webhook event. This
 * is `internal` so it cannot be called by the client — only by the
 * HTTP webhook handler after `Webhook.verify(...)` has accepted the
 * Standard Webhooks signature. The handler is responsible for parsing
 * the Dodo event into the args shape below.
 *
 * Idempotent by `uid`: a duplicate webhook delivery (same `webhook-id`)
 * patches the existing row in place rather than inserting a second one.
 * `currentPeriodEnd` and `dodoSubscriptionId` use `null` (not `undefined`)
 * so the schema's `v.union(..., v.null())` columns serialize cleanly.
 */
export const upsertFromWebhook = internalMutation({
	args: {
		uid: v.string(),
		isPro: v.boolean(),
		dodoCustomerId: v.string(),
		dodoSubscriptionId: v.union(v.string(), v.null()),
		currentPeriodEnd: v.union(v.number(), v.null()),
		// Standard Webhooks `webhook-timestamp` (unix seconds) converted
		// to ms by the HTTP handler. Used as the row's `updatedAt` so the
		// stored value reflects the event's own time, enabling
		// last-writer-wins on event time: a stale/replayed event older
		// than the most recently applied event is skipped. 0 means
		// "unknown" and falls back to Date.now() to preserve prior
		// behavior. Optional so a rolled-back caller omitting it still
		// applies the event.
		eventTime: v.optional(v.number())
	},
	handler: async (ctx, args) => {
		const eventTime = args.eventTime > 0 ? args.eventTime : Date.now();
		const existing = await ctx.db
			.query('entitlements')
			.withIndex('by_uid', (q) => q.eq('uid', args.uid))
			.first();
		if (existing) {
			// Last-writer-wins on event time: skip if the incoming event
			// is older than the most recently applied event. This stops
			// an out-of-order or replayed delivery from reverting a
			// newer state (e.g. a `subscription.renewed` arriving before
			// a delayed `subscription.cancelled` would otherwise flip
			// isPro back to true).
			if (eventTime < existing.updatedAt) {
				return { mode: 'skip' as const, id: existing._id };
			}
			await ctx.db.patch(existing._id, {
				isPro: args.isPro,
				dodoCustomerId: args.dodoCustomerId,
				dodoSubscriptionId: args.dodoSubscriptionId,
				currentPeriodEnd: args.currentPeriodEnd,
				updatedAt: eventTime
			});
			return { mode: 'patch' as const, id: existing._id };
		}
		const id = await ctx.db.insert('entitlements', {
			uid: args.uid,
			isPro: args.isPro,
			dodoCustomerId: args.dodoCustomerId,
			dodoSubscriptionId: args.dodoSubscriptionId,
			currentPeriodEnd: args.currentPeriodEnd,
			updatedAt: eventTime
		});
		return { mode: 'insert' as const, id };
	}
});

/**
 * Read-only idempotency check: returns true if a delivery with this
 * `webhookId` has already been recorded. The HTTP handler calls this
 * BEFORE applying the event (so a replay skips the apply), and calls
 * `recordWebhookDelivery` AFTER a successful apply (so a failed upsert
 * can be retried). Internal so only the webhook action can call it.
 */
export const findWebhookDelivery = internalQuery({
	args: {
		webhookId: v.string()
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('webhookDeliveries')
			.withIndex('by_webhookId', (q) => q.eq('webhookId', args.webhookId))
			.first();
		return Boolean(existing);
	}
});

/**
 * Record a successfully-applied webhook delivery for future dedup.
 * Called by the HTTP handler AFTER `upsertFromWebhook` resolves, so a
 * failed upsert never commits a delivery record (and Dodo can retry).
 * Internal so only the webhook action can call it.
 */
export const recordWebhookDelivery = internalMutation({
	args: {
		webhookId: v.string()
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('webhookDeliveries')
			.withIndex('by_webhookId', (q) => q.eq('webhookId', args.webhookId))
			.first();
		if (existing) return;
		await ctx.db.insert('webhookDeliveries', {
			webhookId: args.webhookId,
			deliveredAt: Date.now()
		});
	}
});

/**
 * One-time wipe used at the Firebase cutover (Requirement 6.6 and
 * 13.2): every row tied to the previous Clerk-derived `ownerId` is
 * deleted before the new AuthUI is exposed to users. There are no
 * production users at cutover, so the wipe is acceptable.
 *
 * Internal-only so it can't be triggered from the browser. Operators
 * invoke it via:
 *   npx convex run entitlements:wipeLegacyOwnerData
 *
 * Storage blob deletion is best-effort: a failed `ctx.storage.delete`
 * (e.g. blob already gone, transient storage error) does not abort
 * the wipe. The post-cutover storage bucket is also being reset, so
 * orphaned blobs are not a correctness problem.
 */
export const wipeLegacyOwnerData = internalMutation({
	args: {},
	handler: async (ctx) => {
		let deletedRows = 0;
		let deletedBlobs = 0;
		let blobErrors = 0;

		// assetFiles first so we attempt blob cleanup before the row
		// id is gone. The order doesn't matter for correctness because
		// blob deletes are best-effort, but it keeps the loop readable.
		const assetFiles = await ctx.db.query('assetFiles').collect();
		for (const file of assetFiles) {
			try {
				await ctx.storage.delete(file.storageId);
				deletedBlobs += 1;
			} catch {
				blobErrors += 1;
			}
			await ctx.db.delete(file._id);
			deletedRows += 1;
		}

		const syncItems = await ctx.db.query('syncItems').collect();
		for (const item of syncItems) {
			await ctx.db.delete(item._id);
			deletedRows += 1;
		}

		const tickets = await ctx.db.query('assetUploadTickets').collect();
		for (const ticket of tickets) {
			await ctx.db.delete(ticket._id);
			deletedRows += 1;
		}

		return { deletedRows, deletedBlobs, blobErrors };
	}
});
