import { enableMemoryFallback, getHuntFlowDB, getMemoryDB } from './index';
import { DEFAULT_SETTINGS, type AppSettings, type Settings } from './schema';

export class SettingsDB {
  private seeded = false;

  async init(): Promise<void> {
    await this.seedDefaults();
  }

  private defaultEntries(): AppSettings[] {
    return Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }));
  }

  private async seedDefaults(): Promise<void> {
    if (this.seeded) return;

    const db = await getHuntFlowDB();
    if (!db) {
      for (const setting of this.defaultEntries()) {
        if (!getMemoryDB().settings.has(setting.key)) {
          getMemoryDB().settings.set(setting.key, setting);
        }
      }
      this.seeded = true;
      return;
    }

    try {
      const existingKeys = new Set(await db.getAllKeys('settings'));
      const tx = db.transaction('settings', 'readwrite');
      await Promise.all([
        ...this.defaultEntries()
          .filter((setting) => !existingKeys.has(setting.key))
          .map((setting) => tx.store.put(setting)),
        tx.done
      ]);
      this.seeded = true;
    } catch (error) {
      enableMemoryFallback(error);
      for (const setting of this.defaultEntries()) getMemoryDB().settings.set(setting.key, setting);
      this.seeded = true;
    }
  }

  async getAll(): Promise<AppSettings[]> {
    await this.seedDefaults();
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().settings.values());

    try {
      return await db.getAll('settings');
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().settings.values());
    }
  }

  async getById(key: string): Promise<AppSettings | undefined> {
    await this.seedDefaults();
    const db = await getHuntFlowDB();
    if (!db) return getMemoryDB().settings.get(key);

    try {
      return await db.get('settings', key);
    } catch (error) {
      enableMemoryFallback(error);
      return getMemoryDB().settings.get(key);
    }
  }

  async put(setting: AppSettings): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().settings.set(setting.key, setting);
      return;
    }

    try {
      await db.put('settings', setting);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().settings.set(setting.key, setting);
    }
  }

  async putSettings(settings: Settings): Promise<void> {
    const entries = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const db = await getHuntFlowDB();
    if (!db) {
      for (const setting of entries) getMemoryDB().settings.set(setting.key, setting);
      return;
    }

    try {
      const tx = db.transaction('settings', 'readwrite');
      await Promise.all([...entries.map((setting) => tx.store.put(setting)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const setting of entries) getMemoryDB().settings.set(setting.key, setting);
    }
  }

  async delete(key: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().settings.delete(key);
      return;
    }

    try {
      await db.delete('settings', key);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().settings.delete(key);
    }
  }

  async getSettings(): Promise<Settings> {
    const settings = await this.getAll();
    const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
    return { ...DEFAULT_SETTINGS, ...values } as Settings;
  }

  async getValue<K extends keyof Settings>(key: K): Promise<Settings[K]> {
    const setting = await this.getById(key);
    return (setting?.value ?? DEFAULT_SETTINGS[key]) as Settings[K];
  }

  async setValue<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    await this.put({ key, value });
  }
}

export const settingsDB = new SettingsDB();
