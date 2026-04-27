import { BaseDB } from './baseStore';
import type { ChecklistInstance, ChecklistKind, ChecklistTemplate } from './schema';

class ChecklistTemplateDB extends BaseDB<ChecklistTemplate> {
  constructor() {
    super('checklistTemplates', 'checklistTemplates');
  }

  getByKind(kind: ChecklistKind): Promise<ChecklistTemplate[]> {
    return this.getByIndex('by-kind', kind);
  }
}

class ChecklistInstanceDB extends BaseDB<ChecklistInstance> {
  constructor() {
    super('checklistInstances', 'checklistInstances');
  }

  getByTarget(targetId: string): Promise<ChecklistInstance[]> {
    return this.getByIndex('by-target', targetId);
  }

  getByTemplate(templateId: string): Promise<ChecklistInstance[]> {
    return this.getByIndex('by-template', templateId);
  }
}

export const checklistTemplateDB = new ChecklistTemplateDB();
export const checklistInstanceDB = new ChecklistInstanceDB();
