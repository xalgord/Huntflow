import { v } from 'convex/values';

import { mutation, query, internalMutation } from './_generated/server';
import type { MutationCtx } from './_generated/server';

const syncCollection = v.union(
  v.literal('sessions'),
  v.literal('notes'),
  v.literal('targets'),
  v.literal('payouts'),
  v.literal('evidenceAssets'),
  v.literal('evidenceLinks'),
  v.literal('evidenceCanvasViews'),
  v.literal('reconAssets'),
  v.literal('payloads'),
  v.literal('checklistTemplates'),
  v.literal('checklistInstances'),
  v.literal('submissions'),
  v.literal('bookmarks')
);

const syncItemInput = v.object({
  collection: syncCollection,
  localId: v.string(),
  payload: v.any(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number())
});

async function requireOwnerId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity.subject;
}

/**
 * Server-side Pro gate. Reads the entitlements row keyed by the caller's
 * Firebase uid (identity.subject) and throws if the user is not Pro.
 * Mirrors the client-side gate so a cancelled subscription can't keep
 * writing snapshots or uploading assets even if a stale client still
 * believes it is Pro. Uses the same `by_uid` index as
 * `entitlements.getMine`.
 */
async function requirePro(ctx: Pick<MutationCtx, 'auth' | 'db'>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  const row = await ctx.db
    .query('entitlements')
    .withIndex('by_uid', (q) => q.eq('uid', identity.subject))
    .first();
  if (!row?.isPro) throw new Error('Pro required');
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_STORAGE_BYTES = 1024 * 1024 * 1024;
/** Tickets minted by `generateAssetUploadUrl` expire after this many ms. */
const UPLOAD_TICKET_TTL_MS = 60 * 60 * 1000;

export const getSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    return await ctx.db
      .query('syncItems')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();
  }
});

export const upsertSnapshot = mutation({
  args: {
    items: v.array(syncItemInput)
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    await requirePro(ctx);
    let upserted = 0;
    const existingItems = await ctx.db
      .query('syncItems')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();
    const existingByKey = new Map(
      existingItems.map((item) => [`${item.collection}:${item.localId}`, item])
    );

    for (const item of args.items) {
      const key = `${item.collection}:${item.localId}`;
      const existing = existingByKey.get(key);

      // Resurrection: a live item (no deletedAt) must explicitly clear
      // any stored tombstone. We build the deletedAt field
      // conditionally so `undefined` is carried into the patch and
      // removes the field rather than leaving the stale tombstone in
      // place. delete→re-create then converges on a live row.
      const deletedAtPatch =
        typeof item.deletedAt === 'number' ? { deletedAt: item.deletedAt } : { deletedAt: undefined };

      if (existing) {
        // Last-writer-wins: update if the incoming timestamp is newer.
        // For soft deletes, compare deletedAt against updatedAt too.
        const incomingTs = item.deletedAt ?? item.updatedAt;
        const existingTs = existing.deletedAt ?? existing.updatedAt;
        if (incomingTs >= existingTs) {
          await ctx.db.patch(existing._id, {
            payload: item.payload,
            updatedAt: item.updatedAt,
            ...deletedAtPatch
          });
        }
      } else {
        await ctx.db.insert('syncItems', {
          ownerId,
          collection: item.collection,
          localId: item.localId,
          payload: item.payload,
          updatedAt: item.updatedAt,
          deletedAt: item.deletedAt
        });
      }

      upserted += 1;
    }

    return { upserted };
  }
});

export const generateAssetUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    await requirePro(ctx);
    // Mint a single-use ticket scoped to the caller. The client must
    // present this ticketId back to `registerAssetFile`, which proves
    // that the same authenticated user who requested the upload URL is
    // the one registering the resulting storage object. Without this,
    // a signed-in user could harvest another user's just-minted upload
    // URL (e.g. via a side channel) and register storage they control
    // against an asset id from the victim's workspace.
    const uploadUrl = await ctx.storage.generateUploadUrl();
    const ticketId = await ctx.db.insert('assetUploadTickets', {
      ownerId,
      createdAt: Date.now()
    });
    return { uploadUrl, ticketId };
  }
});

export const registerAssetFile = mutation({
  args: {
    ticketId: v.id('assetUploadTickets'),
    assetId: v.string(),
    storageId: v.string(),
    fileName: v.optional(v.string()),
    relativePath: v.optional(v.string()),
    mimeType: v.string(),
    size: v.number(),
    uploadedAt: v.number()
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    await requirePro(ctx);

    // Ticket binding: must exist, must belong to the caller, must be
    // fresh. Anything else, including a forged or replayed ticketId,
    // is rejected before we touch storage.
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error('Upload ticket not found.');
    if (ticket.ownerId !== ownerId) throw new Error('Upload ticket does not belong to this user.');
    if (Date.now() - ticket.createdAt > UPLOAD_TICKET_TTL_MS) {
      // Best-effort cleanup; the periodic janitor below sweeps the rest.
      await ctx.db.delete(ticket._id);
      throw new Error('Upload ticket has expired. Re-upload the evidence file.');
    }

    if (args.size <= 0 || args.size > MAX_FILE_SIZE) {
      throw new Error('Cloud sync supports evidence files up to 100MB.');
    }

    const existingFiles = await ctx.db
      .query('assetFiles')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();
    const existingForAsset = existingFiles.find((file) => file.assetId === args.assetId);
    const usedBytes = existingFiles.reduce(
      (sum, file) => sum + (file.assetId === args.assetId ? 0 : file.size),
      0
    );

    if (usedBytes + args.size > MAX_STORAGE_BYTES) {
      throw new Error('Cloud evidence storage quota is 1GB per user.');
    }

    if (existingForAsset) {
      if (existingForAsset.storageId !== args.storageId) {
        await ctx.storage.delete(existingForAsset.storageId);
      }
      await ctx.db.patch(existingForAsset._id, {
        storageId: args.storageId,
        fileName: args.fileName,
        relativePath: args.relativePath,
        mimeType: args.mimeType,
        size: args.size,
        uploadedAt: args.uploadedAt
      });
      // Single-use: consume the ticket so it can't be replayed on a
      // different asset id within the TTL window.
      await ctx.db.delete(ticket._id);
      return { storageId: args.storageId, usedBytes: usedBytes + args.size };
    }

    await ctx.db.insert('assetFiles', {
      ownerId,
      assetId: args.assetId,
      storageId: args.storageId,
      fileName: args.fileName,
      relativePath: args.relativePath,
      mimeType: args.mimeType,
      size: args.size,
      uploadedAt: args.uploadedAt
    });

    // Single-use: consume the ticket on success.
    await ctx.db.delete(ticket._id);

    return { storageId: args.storageId, usedBytes: usedBytes + args.size };
  }
});

/**
 * Janitor: drop expired upload tickets. Convex doesn't have native TTLs,
 * so we let the client (or a cron, if you wire one up) call this
 * occasionally. Either way, expired tickets are also rejected at use
 * time, so the worst case if this never runs is unbounded growth of an
 * inert table — never a security issue.
 *
 * Internal + cron-driven: there is no authenticated caller when a cron
 * fires, so this sweep is global (not owner-scoped) and skips the
 * `requireOwnerId` gate. It only ever deletes already-expired tickets,
 * which are inert. Registered hourly from `convex/cron.ts`.
 */
export const cleanupExpiredUploadTickets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - UPLOAD_TICKET_TTL_MS;
    const expired = await ctx.db
      .query('assetUploadTickets')
      .withIndex('by_createdAt', (q) => q.lt('createdAt', cutoff))
      .collect();
    for (const ticket of expired) {
      await ctx.db.delete(ticket._id);
    }
    return { cleaned: expired.length };
  }
});

export const getAssetFileUrl = query({
  args: {
    assetId: v.string()
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const file = await ctx.db
      .query('assetFiles')
      .withIndex('by_owner_asset', (q) => q.eq('ownerId', ownerId).eq('assetId', args.assetId))
      .first();

    if (!file) return null;
    const url = await ctx.storage.getUrl(file.storageId);
    if (!url) return null;

    return {
      url,
      storageId: file.storageId,
      fileName: file.fileName,
      relativePath: file.relativePath,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt
    };
  }
});

export const deleteAssetFile = mutation({
  args: {
    assetId: v.string()
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const file = await ctx.db
      .query('assetFiles')
      .withIndex('by_owner_asset', (q) => q.eq('ownerId', ownerId).eq('assetId', args.assetId))
      .first();

    if (!file) return { deleted: false };
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(file._id);
    return { deleted: true };
  }
});

export const clearCloud = mutation({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const items = await ctx.db
      .query('syncItems')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();

    // Capture LIVE (non-tombstone) evidenceAssets references before we
    // delete any syncItems. An asset whose syncItem is still live is in
    // active use on this or another device; destroying its blob would
    // brick the asset there. We skip those blobs (and their rows) below.
    const liveEvidenceAssetIds = new Set(
      items
        .filter((item) => item.collection === 'evidenceAssets' && item.deletedAt === undefined)
        .map((item) => item.localId)
    );

    let skippedFiles = 0;
    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    const files = await ctx.db
      .query('assetFiles')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();

    for (const file of files) {
      if (liveEvidenceAssetIds.has(file.assetId)) {
        // Leave the blob and the row intact so other devices can still
        // resolve this asset. The user can re-run clearCloud once the
        // asset is actually deleted everywhere.
        skippedFiles += 1;
        continue;
      }
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }

    return { deleted: items.length + (files.length - skippedFiles), skippedFiles };
  }
});
