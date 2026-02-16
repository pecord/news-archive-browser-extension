/**
 * Fingerprinter Tests
 *
 * Tests hash stability, sensitivity, URL cleaning, and article ID generation.
 */

const { sha256, getCanonicalUrl, extractPublishDate, generateFingerprint } = require('../src/lib/fingerprinter.js');
const { baseQuirks } = require('../src/lib/quirks.js');

// Polyfill crypto.subtle and TextEncoder for jsdom test environment
const { webcrypto } = require('crypto');
const { TextEncoder: NodeTextEncoder } = require('util');
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: true });
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = NodeTextEncoder;
}

describe('sha256', () => {
  test('produces consistent hex output', async () => {
    const hash = await sha256('hello world');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('same input produces same hash', async () => {
    const h1 = await sha256('test content');
    const h2 = await sha256('test content');
    expect(h1).toBe(h2);
  });

  test('different input produces different hash', async () => {
    const h1 = await sha256('text one');
    const h2 = await sha256('text two');
    expect(h1).not.toBe(h2);
  });
});

describe('getCanonicalUrl', () => {
  test('strips utm parameters', () => {
    const url = 'https://example.com/article?utm_source=twitter&utm_medium=social&id=123';
    const result = getCanonicalUrl(url);
    expect(result).not.toContain('utm_source');
    expect(result).not.toContain('utm_medium');
    expect(result).toContain('id=123');
  });

  test('strips fbclid', () => {
    const url = 'https://example.com/article?fbclid=abc123&page=1';
    const result = getCanonicalUrl(url);
    expect(result).not.toContain('fbclid');
    expect(result).toContain('page=1');
  });

  test('strips all tracking params', () => {
    const url = 'https://example.com/?gclid=x&mc_cid=y&mc_eid=z&_ga=w&ref=v';
    const result = getCanonicalUrl(url);
    expect(result).not.toContain('gclid');
    expect(result).not.toContain('mc_cid');
    expect(result).not.toContain('mc_eid');
    expect(result).not.toContain('_ga');
    expect(result).not.toContain('ref=');
  });

  test('returns original for invalid URL', () => {
    expect(getCanonicalUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('extractPublishDate', () => {
  test('extracts date from URL path', () => {
    expect(extractPublishDate('https://example.com/2024/01/15/article-title'))
      .toBe('2024-01-15');
  });

  test('returns empty string when no date in URL', () => {
    expect(extractPublishDate('https://example.com/article-title'))
      .toBe('');
  });
});

describe('fingerprint stability', () => {
  test('same content produces same hash', async () => {
    const text1 = 'This is a test article. It has content.';
    const text2 = 'This is a test article. It has content.';
    const processed1 = baseQuirks(text1);
    const processed2 = baseQuirks(text2);
    const hash1 = await sha256(processed1);
    const hash2 = await sha256(processed2);
    expect(hash1).toBe(hash2);
  });

  test('different content produces different hash', async () => {
    const text1 = 'This is the original article.';
    const text2 = 'This is the modified article.';
    const processed1 = baseQuirks(text1);
    const processed2 = baseQuirks(text2);
    const hash1 = await sha256(processed1);
    const hash2 = await sha256(processed2);
    expect(hash1).not.toBe(hash2);
  });
});

describe('generateFingerprint', () => {
  test('returns nested structure matching original repo', async () => {
    const article = {
      title: 'Test Article Title Here',
      content: 'This is a sufficiently long article for testing purposes. '.repeat(10),
    };
    const result = await generateFingerprint(article, 'https://example.com/2024/03/15/test');

    // Top-level shape
    expect(result).toHaveProperty('fingerprint');
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('processed_text');
    expect(result).toHaveProperty('processing_time_ms');
    expect(result).toHaveProperty('extracted_at');

    // Fingerprint fields
    const fp = result.fingerprint;
    expect(fp).toHaveProperty('article_id');
    expect(fp).toHaveProperty('content_hash');
    expect(fp).toHaveProperty('extraction_method', 'readability_with_quirks');
    expect(fp).toHaveProperty('word_count');
    expect(fp).toHaveProperty('char_count');
    expect(fp).toHaveProperty('version', '1.0');
    expect(fp.article_id).toHaveLength(16);
    expect(fp.content_hash).toMatch(/^[a-f0-9]{64}$/);

    // Metadata fields
    const meta = result.metadata;
    expect(meta).toHaveProperty('url');
    expect(meta).toHaveProperty('canonical_url');
    expect(meta).toHaveProperty('title', 'Test Article Title Here');
    expect(meta).toHaveProperty('authors');
    expect(meta).toHaveProperty('publish_date', '2024-03-15');
    expect(meta).toHaveProperty('modified_date');
    expect(meta).toHaveProperty('has_schema_org');
    expect(meta).toHaveProperty('has_opengraph');
    expect(meta).toHaveProperty('has_canonical');
  });

  test('article_id is stable for same inputs', async () => {
    const article = { title: 'Stable Title', content: 'Some article content here.' };
    const url = 'https://example.com/2024/03/15/test';
    const r1 = await generateFingerprint(article, url);
    const r2 = await generateFingerprint(article, url);
    expect(r1.fingerprint.article_id).toBe(r2.fingerprint.article_id);
    expect(r1.fingerprint.content_hash).toBe(r2.fingerprint.content_hash);
  });

  test('publish_date extracted from URL when no page metadata', async () => {
    const article = { title: 'Date Test', content: 'Some content here.' };
    const result = await generateFingerprint(article, 'https://example.com/2026/02/16/story');
    expect(result.metadata.publish_date).toBe('2026-02-16');
  });

  test('page metadata is used when provided', async () => {
    const article = { title: 'Meta Test', content: 'Some content here.' };
    const pageMeta = {
      canonical_url: 'https://example.com/canonical',
      title: 'Override Title',
      authors: ['Jane Doe'],
      publish_date: '2026-01-01T00:00:00Z',
      modified_date: '2026-01-02T00:00:00Z',
      has_schema_org: true,
      has_opengraph: true,
      has_canonical: true,
    };
    const result = await generateFingerprint(article, 'https://example.com/story', pageMeta);
    expect(result.metadata.title).toBe('Override Title');
    expect(result.metadata.authors).toEqual(['Jane Doe']);
    expect(result.metadata.publish_date).toBe('2026-01-01T00:00:00Z');
    expect(result.metadata.has_schema_org).toBe(true);
  });
});
