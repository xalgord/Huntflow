import { defineSchema, defineTable } from 'convex/server';
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

export default defineSchema({
  syncItems: defineTable({
    ownerId: v.string(),
    collection: syncCollection,
    localId: v.string(),
    payload: v.any(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number())
  })
    .index('by_owner', ['ownerId'])
    .index('by_owner_updatedAt', ['ownerId', 'updatedAt'])
    .index('by_owner_collection', ['ownerId', 'collection'])
    .index('by_owner_collection_localId', ['ownerId', 'collection', 'localId']),
  assetFiles: defineTable({
    ownerId: v.string(),
    assetId: v.string(),
    storageId: v.string(),
    fileName: v.optional(v.string()),
    relativePath: v.optional(v.string()),
    mimeType: v.string(),
    size: v.number(),
    uploadedAt: v.number()
  })
    .index('by_owner', ['ownerId'])
    .index('by_owner_asset', ['ownerId', 'assetId'])
});
