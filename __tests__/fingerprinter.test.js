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
  test('returns expected shape', async () => {
    const article = {
      title: 'Test Article Title Here',
      content: 'This is a sufficiently long article for testing purposes. '.repeat(10),
    };
    const fp = await generateFingerprint(article, 'https://example.com/2024/03/15/test');
    expect(fp).toHaveProperty('article_id');
    expect(fp).toHaveProperty('content_hash');
    expect(fp).toHaveProperty('word_count');
    expect(fp).toHaveProperty('char_count');
    expect(fp).toHaveProperty('version', '1.0');
    expect(fp.article_id).toHaveLength(16);
    expect(fp.content_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('article_id is stable for same inputs', async () => {
    const article = { title: 'Stable Title', content: 'Some article content here.' };
    const url = 'https://example.com/2024/03/15/test';
    const fp1 = await generateFingerprint(article, url);
    const fp2 = await generateFingerprint(article, url);
    expect(fp1.article_id).toBe(fp2.article_id);
    expect(fp1.content_hash).toBe(fp2.content_hash);
  });
});
