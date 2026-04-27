import { BaseDB } from './baseStore';
import type { Bookmark, BookmarkCategory } from './schema';

class BookmarkDB extends BaseDB<Bookmark> {
  constructor() {
    super('bookmarks', 'bookmarks');
  }

  getByCategory(category: BookmarkCategory): Promise<Bookmark[]> {
    return this.getByIndex('by-category', category);
  }
}

export const bookmarkDB = new BookmarkDB();
