/**
 * Cloud API client contract.
 *
 * Property 7 (carried over from the previous backend): requests made
 * while signed out never carry anyone's token and never reach the
 * network, so a post-sign-out read can't return another user's rows.
 * The server keys every row by the verified token's uid, so "no token
 * → no request" closes the client half of that contract.
 */
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true, dev: false, building: false, version: 'test' }));

type ApiModule = typeof import('./api');

async function loadApi(env: Record<string, string> = {}): Promise<ApiModule> {
  vi.resetModules();
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-api-key');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'huntflow-test');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('./api');
}

const fetchMock = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('cloudFetch', () => {
  it('sends the bearer token to the same-origin API by default', async () => {
    const api = await loadApi();
    api.setCloudTokenProvider(async () => 'token-1');
    fetchMock.mockResolvedValue(Response.json({ uid: 'u1', email: '', isPro: true, currentPeriodEnd: null }));

    const account = await api.fetchCloudAccount();
    expect(account.isPro).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/me');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-1');
    expect(init?.cache).toBe('no-store');
  });

  it('honours VITE_CLOUD_API_URL and can be switched off', async () => {
    const remote = await loadApi({ VITE_CLOUD_API_URL: 'https://huntflow.xalgorix.com/' });
    expect(remote.cloudApiBase).toBe('https://huntflow.xalgorix.com');
    expect(remote.cloudConfigured).toBe(true);
    const off = await loadApi({ VITE_CLOUD_API_URL: 'off' });
    expect(off.cloudConfigured).toBe(false);
  });

  it('retries once with a force-refreshed token after a 401', async () => {
    const api = await loadApi();
    const provider = vi.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
    api.setCloudTokenProvider(provider);
    fetchMock
      .mockResolvedValueOnce(Response.json({ error: 'expired', code: 'unauthenticated' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));

    await api.cloudJson('/me');
    expect(provider.mock.calls.map((call) => call[0])).toEqual([false, true]);
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('authorization')).toBe('Bearer fresh');
  });

  it('maps error bodies to CloudApiError with status and code', async () => {
    const api = await loadApi();
    api.setCloudTokenProvider(async () => 't');
    fetchMock.mockResolvedValue(
      Response.json({ error: 'HuntFlow Pro is required for cloud sync.', code: 'pro_required' }, { status: 402 })
    );
    const error = await api.pushSyncItems([]).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(api.CloudApiError);
    expect(error).toMatchObject({ status: 402, code: 'pro_required', message: 'HuntFlow Pro is required for cloud sync.' });
  });

  it('Property 7: signed-out requests never hit the network or carry a token', async () => {
    const api = await loadApi();
    fetchMock.mockImplementation(async () => Response.json({ items: [], cursor: '0.0', hasMore: false, head: 0, reset: false }));

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(fc.constantFrom('signOut' as const), fc.stringMatching(/^[A-Za-z0-9]{6,12}$/)), {
          minLength: 1,
          maxLength: 12
        }),
        async (events) => {
          let current: string | null = null;
          api.setCloudTokenProvider(async () => (current ? `token-for-${current}` : null));
          for (const event of events) {
            current = event === 'signOut' ? null : event;
            fetchMock.mockClear();
            const outcome = await api.fetchSyncChanges(null).then(
              () => 'ok' as const,
              (error: unknown) => error
            );
            if (current === null) {
              expect(outcome).toBeInstanceOf(api.CloudApiError);
              expect(fetchMock).not.toHaveBeenCalled();
            } else {
              expect(outcome).toBe('ok');
              const auth = new Headers(fetchMock.mock.calls[0][1]?.headers).get('authorization');
              expect(auth).toBe(`Bearer token-for-${current}`);
            }
          }
        }
      ),
      { numRuns: 60 }
    );
  });
});
