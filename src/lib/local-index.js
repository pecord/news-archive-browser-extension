/**
 * Local Index Module
 *
 * IndexedDB wrapper for storing archived article records locally.
 * Uses the `idb` library for a promise-based API.
 */

import { openDB } from 'idb';

const DB_NAME = 'news-archive';
const DB_VERSION = 1;
const STORE_NAME = 'articles';

function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'article_id' });
        store.createIndex('cid', 'cid', { unique: true });
        store.createIndex('content_hash', 'content_hash', { unique: false });
        store.createIndex('url', 'url', { unique: false });
        store.createIndex('archived_at', 'archived_at', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    },
  });
}

/**
 * Add an archived article to the local index.
 */
export async function add(article) {
  const db = await getDb();
  const record = {
    ...article,
    archived_at: article.archived_at || new Date().toISOString(),
  };
  await db.put(STORE_NAME, record);
  return record;
}

/**
 * Get all archived articles, sorted by archived_at descending.
 */
export async function getAll({ limit = 100, order = 'desc' } = {}) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('archived_at');
  const direction = order === 'desc' ? 'prev' : 'next';
  const results = [];
  let cursor = await index.openCursor(null, direction);
  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }
  return results;
}

/**
 * Find an article by its content hash (deduplication lookup).
 */
export async function findByHash(contentHash) {
  const db = await getDb();
  return db.getFromIndex(STORE_NAME, 'content_hash', contentHash);
}

/**
 * Find an article by URL.
 */
export async function findByUrl(url) {
  const db = await getDb();
  return db.getFromIndex(STORE_NAME, 'url', url);
}

/**
 * Get aggregate statistics about the archive.
 */
export async function getStats() {
  const db = await getDb();
  const all = await db.getAll(STORE_NAME);
  const domains = new Set(all.map((a) => {
    try { return new URL(a.url).hostname; } catch { return 'unknown'; }
  }));
  return {
    totalArticles: all.length,
    totalWords: all.reduce((sum, a) => sum + (a.word_count || 0), 0),
    uniqueDomains: domains.size,
  };
}

/**
 * Remove an article from the index.
 */
export async function remove(articleId) {
  const db = await getDb();
  await db.delete(STORE_NAME, articleId);
}

/**
 * Export all records for backup.
 */
export async function exportAll() {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

/**
 * Import records from a backup, merging with existing data.
 */
export async function importAll(data) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const record of data) {
    await tx.store.put(record);
  }
  await tx.done;
}
