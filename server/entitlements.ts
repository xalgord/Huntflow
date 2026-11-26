/**
 * HuntFlow Pro entitlements. The Dodo webhook is the only writer; the
 * browser only ever reads `{ isPro, currentPeriodEnd }` — payment ids
 * stay server-side.
 */
import type { AuthUser } from './auth';
import { HttpError } from './http';

export interface EntitlementRow {
  uid: string;
  is_pro: number;
  dodo_customer_id: string;
  dodo_subscription_id: string | null;
  current_period_end: number | null;
  updated_at: number;
}

export async function getEntitlement(db: D1Database, uid: string): Promise<EntitlementRow | null> {
  return db.prepare('SELECT * FROM entitlements WHERE uid = ?1').bind(uid).first<EntitlementRow>();
}

export async function requirePro(db: D1Database, user: AuthUser): Promise<void> {
  const row = await getEntitlement(db, user.uid);
  if (!row || row.is_pro !== 1) {
    throw new HttpError(402, 'pro_required', 'HuntFlow Pro is required for cloud sync.');
  }
}

export interface EntitlementUpdate {
  uid: string;
  isPro: boolean;
  dodoCustomerId: string;
  dodoSubscriptionId: string | null;
  currentPeriodEnd: number | null;
  /** Webhook event time in ms; older events never overwrite newer ones. */
  eventTime: number;
}

export function entitlementUpsert(db: D1Database, update: EntitlementUpdate): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO entitlements (uid, is_pro, dodo_customer_id, dodo_subscription_id, current_period_end, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (uid) DO UPDATE SET
         is_pro = excluded.is_pro,
         dodo_customer_id = excluded.dodo_customer_id,
         dodo_subscription_id = excluded.dodo_subscription_id,
         current_period_end = excluded.current_period_end,
         updated_at = excluded.updated_at
       WHERE excluded.updated_at >= entitlements.updated_at`
    )
    .bind(
      update.uid,
      update.isPro ? 1 : 0,
      update.dodoCustomerId,
      update.dodoSubscriptionId,
      update.currentPeriodEnd,
      update.eventTime
    );
}
