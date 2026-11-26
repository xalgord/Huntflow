/**
 * In-memory stand-ins for the Cloudflare bindings the API uses, so the
 * whole router can be exercised in Vitest:
 *   - FakeD1 runs real SQL on node:sqlite (same engine family as D1),
 *     with D1's prepare/bind/first/all/run/batch surface.
 *   - FakeR2 keeps object bodies in a Map.
 * The migration file is applied verbatim, so schema drift fails tests.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';

import { setFirebaseKeysForTesting } from '../../server/auth';
import type { Env } from '../../server/env';

// Vite's module graph doesn't know the newer `node:sqlite` builtin, so
// load it through Node's own resolver.
const { DatabaseSync } = createRequire(resolve(process.cwd(), 'package.json'))('node:sqlite') as typeof import('node:sqlite');
type DatabaseSync = InstanceType<typeof DatabaseSync>;

type Param = string | number | null;

function toParams(values: unknown[]): Param[] {
  return values.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value as Param;
  });
}

function returnsRows(sql: string): boolean {
  return /^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql);
}

class FakeStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: Param[] = []
  ) {}

  bind(...values: unknown[]): FakeStatement {
    return new FakeStatement(this.db, this.sql, toParams(values));
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : { ...row }) as T;
  }

  async all<T>(): Promise<{ results: T[]; success: true; meta: Record<string, number> }> {
    const rows = this.db.prepare(this.sql).all(...this.params) as Record<string, unknown>[];
    return { results: rows.map((row) => ({ ...row }) as T), success: true, meta: {} };
  }

  async run(): Promise<{ results: unknown[]; success: true; meta: { changes: number } }> {
    return this.runSync();
  }

  runSync(): { results: unknown[]; success: true; meta: { changes: number } } {
    const statement = this.db.prepare(this.sql);
    if (returnsRows(this.sql)) {
      const rows = statement.all(...this.params) as Record<string, unknown>[];
      return { results: rows.map((row) => ({ ...row })), success: true, meta: { changes: rows.length } };
    }
    const info = statement.run(...this.params);
    return { results: [], success: true, meta: { changes: Number(info.changes) } };
  }
}

export class FakeD1 {
  readonly sqlite = new DatabaseSync(':memory:');

  constructor() {
    // Resolved from the repo root so it also works under the jsdom environment.
    this.sqlite.exec(readFileSync(resolve(process.cwd(), 'migrations/0001_init.sql'), 'utf8'));
  }

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this.sqlite, sql);
  }

  async batch(statements: FakeStatement[]) {
    this.sqlite.exec('BEGIN');
    try {
      const results = statements.map((statement) => statement.runSync());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  }
}

interface StoredObject {
  bytes: Uint8Array;
  contentType?: string;
  customMetadata?: Record<string, string>;
}

export class FakeR2 {
  readonly objects = new Map<string, StoredObject>();

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | string,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }
  ) {
    const bytes = new Uint8Array(await new Response(value as BodyInit).arrayBuffer());
    this.objects.set(key, {
      bytes,
      contentType: options?.httpMetadata?.contentType,
      customMetadata: options?.customMetadata
    });
    return { key, size: bytes.byteLength };
  }

  async get(key: string) {
    const stored = this.objects.get(key);
    if (!stored) return null;
    return { key, size: stored.bytes.byteLength, body: new Blob([stored.bytes]).stream() };
  }

  async delete(keys: string | string[]) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(key);
  }
}

export const PROJECT_ID = 'huntflow-test';

export interface TestEnv extends Env {
  DB: D1Database;
  EVIDENCE: R2Bucket;
}

export function makeEnv(overrides: Partial<Env> = {}): { env: Env; db: FakeD1; bucket: FakeR2 } {
  const db = new FakeD1();
  const bucket = new FakeR2();
  const env = {
    DB: db as unknown as D1Database,
    EVIDENCE: bucket as unknown as R2Bucket,
    FIREBASE_PROJECT_ID: PROJECT_ID,
    DODO_API_BASE_URL: 'https://test.dodopayments.example',
    DODO_API_KEY: 'test-key',
    DODO_PRO_PRODUCT_ID: 'pdt_test',
    DODO_WEBHOOK_SIGNING_SECRET: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    ...overrides
  } as Env;
  return { env, db, bucket };
}

let signingKey: CryptoKey | null = null;
let otherKey: CryptoKey | null = null;

export async function installTestKeys(): Promise<void> {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  setFirebaseKeysForTesting(createLocalJWKSet({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256' }] }));
  signingKey = privateKey;
  otherKey = (await generateKeyPair('RS256')).privateKey;
}

export async function tokenFor(
  uid: string,
  options: { email?: string; audience?: string; issuer?: string; foreignKey?: boolean; expired?: boolean } = {}
): Promise<string> {
  if (!signingKey || !otherKey) throw new Error('installTestKeys() first');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: options.email ?? `${uid}@example.com`, email_verified: true, auth_time: now - 10 })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(options.issuer ?? `https://securetoken.google.com/${PROJECT_ID}`)
    .setAudience(options.audience ?? PROJECT_ID)
    .setSubject(uid)
    .setIssuedAt(options.expired ? now - 7200 : now - 10)
    .setExpirationTime(options.expired ? now - 3600 : now + 3600)
    .sign(options.foreignKey ? otherKey : signingKey);
}
