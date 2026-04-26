import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const syncCollection = v.union(
  v.literal('sessions'),
  v.literal('notes'),
  v.literal('targets'),
  v.literal('payouts')
);

export default defineSchema({
  syncItems: defineTable({
    ownerId: v.string(),
    collection: syncCollection,
    localId: v.string(),
    payload: v.any(),
    updatedAt: v.number()
  })
    .index('by_owner', ['ownerId'])
    .index('by_owner_updatedAt', ['ownerId', 'updatedAt'])
    .index('by_owner_collection', ['ownerId', 'collection'])
    .index('by_owner_collection_localId', ['ownerId', 'collection', 'localId'])
});
