type StorageArea = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>;

const memory = new Map<string, string>();

const memoryStorage: StorageArea = {
  getItem(key) {
    return memory.get(key) ?? null;
  },
  setItem(key, value) {
    memory.set(key, value);
  },
  removeItem(key) {
    memory.delete(key);
  },
  clear() {
    memory.clear();
  }
};

function getStorage(): StorageArea {
  try {
    if (!globalThis.localStorage) return memoryStorage;

    const testKey = '__huntflow_storage_test__';
    globalThis.localStorage.setItem(testKey, testKey);
    globalThis.localStorage.removeItem(testKey);
    return globalThis.localStorage;
  } catch {
    return memoryStorage;
  }
}

export function getJSON<T>(key: string, fallback: T): T {
  const raw = getStorage().getItem(key);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON<T>(key: string, value: T): void {
  getStorage().setItem(key, JSON.stringify(value));
}

export function removeJSON(key: string): void {
  getStorage().removeItem(key);
}

export function clearJSONStorage(): void {
  getStorage().clear();
}

export const jsonStorage = {
  get: getJSON,
  set: setJSON,
  remove: removeJSON,
  clear: clearJSONStorage
};
