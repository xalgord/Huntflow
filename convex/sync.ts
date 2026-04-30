import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

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

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_STORAGE_BYTES = 1024 * 1024 * 1024;

export const getSnapshot = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    return await ctx.db
      .query('syncItems')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();
  }
});

export const upsertSnapshot = mutationGeneric({
  args: {
    items: v.array(syncItemInput)
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
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

      if (existing) {
        // Last-writer-wins: update if the incoming timestamp is newer.
        // For soft deletes, compare deletedAt against updatedAt too.
        const incomingTs = item.deletedAt ?? item.updatedAt;
        const existingTs = existing.deletedAt ?? existing.updatedAt;
        if (incomingTs >= existingTs) {
          await ctx.db.patch(existing._id, {
            payload: item.payload,
            updatedAt: item.updatedAt,
            deletedAt: item.deletedAt
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

export const generateAssetUploadUrl = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    await requireOwnerId(ctx);
    return await ctx.storage.generateUploadUrl();
  }
});

export const registerAssetFile = mutationGeneric({
  args: {
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

    return { storageId: args.storageId, usedBytes: usedBytes + args.size };
  }
});

export const getAssetFileUrl = queryGeneric({
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

export const deleteAssetFile = mutationGeneric({
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

export const clearCloud = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const items = await ctx.db
      .query('syncItems')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    const files = await ctx.db
      .query('assetFiles')
      .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
      .collect();

    for (const file of files) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.delete(file._id);
    }

    return { deleted: items.length + files.length };
  }
});
