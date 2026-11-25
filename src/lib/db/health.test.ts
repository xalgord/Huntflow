import 'fake-indexeddb/auto';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true, dev: false, building: false, version: 'test' }));

function domError(name: string, message = name): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe('classifyStorageError', () => {
  it('distinguishes connection, quota and fatal failures', async () => {
    const { classifyStorageError } = await import('./health');
    expect(classifyStorageError(domError('InvalidStateError', 'The database connection is closing.'))).toBe('connection');
    expect(classifyStorageError(domError('TransactionInactiveError'))).toBe('connection');
    expect(classifyStorageError(domError('QuotaExceededError'))).toBe('quota');
    expect(classifyStorageError(domError('UnknownError', 'Internal error opening backing store'))).toBe('fatal');
    expect(classifyStorageError(new Error('IndexedDB is not available in this environment'))).toBe('fatal');
  });
});

describe('storage health reporting', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('never lets a milder state mask a more serious one', async () => {
    const { reportStorageHealth, storageHealth, clearStorageHealth } = await import('./health');
    reportStorageHealth('memory', 'boom');
    reportStorageHealth('blocked');
    expect(get(storageHealth).state).toBe('memory');
    clearStorageHealth('blocked');
    expect(get(storageHealth).state).toBe('memory');
  });
});

describe('enableMemoryFallback policy', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('rethrows connection errors without switching to memory', async () => {
    const db = await import('./index');
    const { storageHealth } = await import('./health');
    expect(() => db.enableMemoryFallback(domError('InvalidStateError', 'The database connection is closing.'))).toThrow();
    expect(db.isMemoryFallback()).toBe(false);
    expect(get(storageHealth).state).toBe('ok');
  });

  it('surfaces quota errors and rethrows so writes are retried', async () => {
    const db = await import('./index');
    const { storageHealth } = await import('./health');
    expect(() => db.enableMemoryFallback(domError('QuotaExceededError'))).toThrow();
    expect(db.isMemoryFallback()).toBe(false);
    expect(get(storageHealth).state).toBe('quota');
  });

  it('switches to memory loudly on fatal errors', async () => {
    const db = await import('./index');
    const { storageHealth } = await import('./health');
    db.enableMemoryFallback(domError('UnknownError', 'backing store corrupted'));
    expect(db.isMemoryFallback()).toBe(true);
    expect(get(storageHealth)).toMatchObject({ state: 'memory' });
    expect(get(storageHealth).detail).toContain('backing store corrupted');
  });
});

describe('resilient connection', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reopens and retries a single operation after the connection closes', async () => {
    const db = await import('./index');
    const first = await db.getHuntFlowDB();
    expect(first).not.toBeNull();
    await first!.put('settings', { key: 'probe', value: 1 });

    // Simulate the browser dropping the handle (e.g. tab backgrounded).
    first!.close();

    // The same (now closed) handle transparently reconnects and retries.
    await expect(first!.get('settings', 'probe')).resolves.toEqual({ key: 'probe', value: 1 });
    await first!.put('settings', { key: 'probe', value: 2 });

    const second = await db.getHuntFlowDB();
    await expect(second!.get('settings', 'probe')).resolves.toEqual({ key: 'probe', value: 2 });
    expect(db.isMemoryFallback()).toBe(false);
  });
});
