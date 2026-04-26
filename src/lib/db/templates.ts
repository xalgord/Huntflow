import { enableMemoryFallback, getHuntFlowDB, getMemoryDB } from './index';
import { BUILT_IN_TEMPLATES, type NoteTemplate, type TemplateCategory } from './schema';

export class TemplateDB {
  private seeded = false;

  async init(): Promise<void> {
    await this.seedBuiltIns();
  }

  private async seedBuiltIns(): Promise<void> {
    if (this.seeded) return;

    const db = await getHuntFlowDB();
    if (!db) {
      for (const template of BUILT_IN_TEMPLATES) {
        if (!getMemoryDB().templates.has(template.id)) {
          getMemoryDB().templates.set(template.id, template);
        }
      }
      this.seeded = true;
      return;
    }

    try {
      const tx = db.transaction('templates', 'readwrite');
      await Promise.all([...BUILT_IN_TEMPLATES.map((template) => tx.store.put(template)), tx.done]);
      this.seeded = true;
    } catch (error) {
      enableMemoryFallback(error);
      for (const template of BUILT_IN_TEMPLATES) getMemoryDB().templates.set(template.id, template);
      this.seeded = true;
    }
  }

  async getAll(): Promise<NoteTemplate[]> {
    await this.seedBuiltIns();
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().templates.values());

    try {
      return await db.getAll('templates');
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().templates.values());
    }
  }

  async getById(id: string): Promise<NoteTemplate | undefined> {
    await this.seedBuiltIns();
    const db = await getHuntFlowDB();
    if (!db) return getMemoryDB().templates.get(id);

    try {
      return await db.get('templates', id);
    } catch (error) {
      enableMemoryFallback(error);
      return getMemoryDB().templates.get(id);
    }
  }

  async put(template: NoteTemplate): Promise<void> {
    await this.seedBuiltIns();
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().templates.set(template.id, template);
      return;
    }

    try {
      await db.put('templates', template);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().templates.set(template.id, template);
    }
  }

  async putBatch(templates: NoteTemplate[]): Promise<void> {
    await this.seedBuiltIns();
    const db = await getHuntFlowDB();
    if (!db) {
      for (const template of templates) getMemoryDB().templates.set(template.id, template);
      return;
    }

    try {
      const tx = db.transaction('templates', 'readwrite');
      await Promise.all([...templates.map((template) => tx.store.put(template)), tx.done]);
    } catch (error) {
      enableMemoryFallback(error);
      for (const template of templates) getMemoryDB().templates.set(template.id, template);
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getHuntFlowDB();
    if (!db) {
      getMemoryDB().templates.delete(id);
      return;
    }

    try {
      await db.delete('templates', id);
    } catch (error) {
      enableMemoryFallback(error);
      getMemoryDB().templates.delete(id);
    }
  }

  async getByCategory(category: TemplateCategory): Promise<NoteTemplate[]> {
    await this.seedBuiltIns();
    const db = await getHuntFlowDB();
    if (!db) return Array.from(getMemoryDB().templates.values()).filter((t) => t.category === category);

    try {
      return await db.getAllFromIndex('templates', 'by-category', category);
    } catch (error) {
      enableMemoryFallback(error);
      return Array.from(getMemoryDB().templates.values()).filter((t) => t.category === category);
    }
  }
}

export const templateDB = new TemplateDB();
