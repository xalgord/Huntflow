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
    .index('by_owner_asset', ['ownerId', 'assetId']),
  /**
   * Short-lived tickets that pin an upload URL to the user who minted
   * it. Without this binding, signed-in user A could request an upload
   * URL and signed-in user B could register the resulting `storageId`
   * for an `assetId` they control — an asymmetric upload smuggling
   * primitive. The ticket id is returned by `generateAssetUploadUrl`
   * and required by `registerAssetFile`, which consumes it on success.
   * Tickets expire after 1 hour. See `convex/sync.ts`.
   */
  assetUploadTickets: defineTable({
    ownerId: v.string(),
    createdAt: v.number()
  })
    .index('by_owner', ['ownerId'])
    .index('by_createdAt', ['createdAt']),
  /**
   * Pro entitlement source of truth. Keyed by Firebase `uid` (the
   * `sub` claim on the validated ID token). Written exclusively by
   * the Dodo Payments webhook handler in `convex/http.ts` via the
   * internal `entitlements.upsertFromWebhook` mutation. Read by the
   * client through `entitlements.getMine`. Adding this table is
   * purely additive: rolling back the migration leaves it dormant
   * without breaking existing tables.
   */
  entitlements: defineTable({
    uid: v.string(), // Firebase uid (claim sub)
    isPro: v.boolean(),
    dodoCustomerId: v.string(), // empty string if unknown
    dodoSubscriptionId: v.union(v.string(), v.null()),
    currentPeriodEnd: v.union(v.number(), v.null()), // ms epoch
    updatedAt: v.number() // ms epoch
  }).index('by_uid', ['uid'])
});
