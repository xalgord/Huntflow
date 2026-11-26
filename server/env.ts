/**
 * Bindings and configuration available to the HuntFlow API on
 * Cloudflare Pages Functions. Bindings come from `wrangler.toml`;
 * plain values are `[vars]` there, and anything sensitive is a Pages
 * secret (`wrangler pages secret put NAME --project-name huntflow`).
 */
export interface Env {
  /** D1: sync items, evidence file index, entitlements, webhook log. */
  DB: D1Database;
  /** R2: evidence file bodies, keyed `evidence/<uid>/<assetId>`. */
  EVIDENCE: R2Bucket;

  /** Firebase project whose ID tokens we accept (var). */
  FIREBASE_PROJECT_ID?: string;

  /** Dodo Payments API host, test or live (var). */
  DODO_API_BASE_URL?: string;
  /** Dodo product id for HuntFlow Pro (var). */
  DODO_PRO_PRODUCT_ID?: string;
  /** Dodo API key (secret). */
  DODO_API_KEY?: string;
  /** Standard Webhooks signing secret for the Dodo endpoint (secret). */
  DODO_WEBHOOK_SIGNING_SECRET?: string;

  /** Resend API key for the landing-page contact form (secret). */
  RESEND_API_KEY?: string;
}

export function envValue(env: Env, name: keyof Env): string {
  const raw = env[name];
  return typeof raw === 'string' ? raw.trim() : '';
}
