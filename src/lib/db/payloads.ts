import { BaseDB } from './baseStore';
import type { Payload, PayloadCategory } from './schema';

class PayloadDB extends BaseDB<Payload> {
  constructor() {
    super('payloads', 'payloads');
  }

  getByCategory(category: PayloadCategory): Promise<Payload[]> {
    return this.getByIndex('by-category', category);
  }
}

export const payloadDB = new PayloadDB();
