/**
 * Vitest setup hook — runs before every test file.
 *
 * Stubs `VITE_FIREBASE_*` env vars so `src/lib/cloud/firebase.ts`
 * passes its `firebaseConfigured` check at module-load time. The
 * actual Firebase SDK is mocked per-spec; these values are only
 * inspected for presence.
 */

import { vi } from 'vitest';

vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com');
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
vi.stubEnv('VITE_FIREBASE_APP_ID', '1:1234:web:abcd');
