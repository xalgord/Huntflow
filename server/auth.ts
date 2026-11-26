/**
 * Firebase ID token verification for the HuntFlow API.
 *
 * The browser signs in with Firebase Auth and sends its ID token as
 * `Authorization: Bearer <token>`. We verify it the way Google
 * documents for third-party backends: RS256 signature against the
 * securetoken JWKS, `iss` = https://securetoken.google.com/<project>,
 * `aud` = <project>, a non-empty `sub` of at most 128 chars, and an
 * `auth_time` that is not in the future. `jose` caches the key set
 * per isolate, so a warm Function verifies without a network hop.
 */
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

import { envValue, type Env } from './env';
import { HttpError } from './http';

const GOOGLE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CLOCK_TOLERANCE_SECONDS = 60;

export interface AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}

let remoteKeys: JWTVerifyGetKey | null = null;
let keyOverride: JWTVerifyGetKey | null = null;

/** Tests inject a local key set so they can mint tokens offline. */
export function setFirebaseKeysForTesting(keys: JWTVerifyGetKey | null): void {
  keyOverride = keys;
}

function signingKeys(): JWTVerifyGetKey {
  if (keyOverride) return keyOverride;
  if (!remoteKeys) remoteKeys = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  return remoteKeys;
}

export async function verifyFirebaseIdToken(token: string, projectId: string): Promise<AuthUser> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, signingKeys(), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
      clockTolerance: CLOCK_TOLERANCE_SECONDS
    }));
  } catch {
    throw new HttpError(401, 'unauthenticated', 'Your session has expired. Sign in again.');
  }

  const uid = typeof payload.sub === 'string' ? payload.sub : '';
  if (!uid || uid.length > 128) {
    throw new HttpError(401, 'unauthenticated', 'Your session has expired. Sign in again.');
  }
  const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : 0;
  if (authTime > Math.floor(Date.now() / 1000) + CLOCK_TOLERANCE_SECONDS) {
    throw new HttpError(401, 'unauthenticated', 'Your session has expired. Sign in again.');
  }

  return {
    uid,
    email: typeof payload.email === 'string' ? payload.email : '',
    emailVerified: payload.email_verified === true
  };
}

export async function requireUser(request: Request, env: Env): Promise<AuthUser> {
  const projectId = envValue(env, 'FIREBASE_PROJECT_ID');
  if (!projectId) {
    throw new HttpError(503, 'not_configured', 'Cloud accounts are not configured on this deployment.');
  }
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, 'unauthenticated', 'Sign in to use cloud features.');
  return verifyFirebaseIdToken(match[1].trim(), projectId);
}
