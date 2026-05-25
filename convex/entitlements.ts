import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';

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
		currentPeriodEnd: v.union(v.number(), v.null())
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const existing = await ctx.db
			.query('entitlements')
			.withIndex('by_uid', (q) => q.eq('uid', args.uid))
			.first();
		if (existing) {
			await ctx.db.patch(existing._id, {
				isPro: args.isPro,
				dodoCustomerId: args.dodoCustomerId,
				dodoSubscriptionId: args.dodoSubscriptionId,
				currentPeriodEnd: args.currentPeriodEnd,
				updatedAt: now
			});
			return { mode: 'patch' as const, id: existing._id };
		}
		const id = await ctx.db.insert('entitlements', {
			uid: args.uid,
			isPro: args.isPro,
			dodoCustomerId: args.dodoCustomerId,
			dodoSubscriptionId: args.dodoSubscriptionId,
			currentPeriodEnd: args.currentPeriodEnd,
			updatedAt: now
		});
		return { mode: 'insert' as const, id };
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
