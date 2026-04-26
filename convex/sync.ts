import { mutationGeneric, queryGeneric } from 'convex/server';
import { v } from 'convex/values';

const syncCollection = v.union(
  v.literal('sessions'),
  v.literal('notes'),
  v.literal('targets'),
  v.literal('payouts')
);

const syncItemInput = v.object({
  collection: syncCollection,
  localId: v.string(),
  payload: v.any(),
  updatedAt: v.number()
});

async function requireOwnerId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity.subject;
}

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
        if (item.updatedAt >= existing.updatedAt) {
          await ctx.db.patch(existing._id, {
            payload: item.payload,
            updatedAt: item.updatedAt
          });
        }
      } else {
        await ctx.db.insert('syncItems', {
          ownerId,
          collection: item.collection,
          localId: item.localId,
          payload: item.payload,
          updatedAt: item.updatedAt
        });
      }

      upserted += 1;
    }

    return { upserted };
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

    return { deleted: items.length };
  }
});
