/**
 * Quirks Processing Tests
 *
 * Ported from article_fingerprinter/test_suite.py — TestQuirksProcessor + TestEncoding
 */

const { baseQuirks, extractorQuirks, siteQuirks, processAllLayers } = require('../src/lib/quirks.js');

describe('baseQuirks', () => {
  test('punctuation spacing normalization', () => {
    const text = 'Hello world . This is a test .';
    expect(baseQuirks(text)).toBe('Hello world. This is a test.');
  });

  test('smart quotes converted to straight quotes', () => {
    const text = 'He said \u201chello\u201d and \u2018goodbye\u2019';
    const result = baseQuirks(text);
    expect(result).toBe('He said "hello" and \'goodbye\'');
    expect(result).not.toContain('\u201c');
    expect(result).not.toContain('\u201d');
    expect(result).not.toContain('\u2018');
    expect(result).not.toContain('\u2019');
  });

  test('em and en dashes converted to hyphens', () => {
    const text = 'Test\u2014em dash and\u2013en dash';
    const result = baseQuirks(text);
    expect(result).toBe('Test-em dash and-en dash');
    expect(result).not.toContain('\u2014');
    expect(result).not.toContain('\u2013');
  });

  test('excessive whitespace is collapsed', () => {
    const text = 'Hello    world  \n\n  test';
    expect(baseQuirks(text)).toBe('Hello world test');
  });

  test('non-breaking spaces are removed', () => {
    const text = 'Hello\xa0world';
    expect(baseQuirks(text)).toBe('Hello world');
  });

  test('empty input returns empty string', () => {
    expect(baseQuirks('')).toBe('');
    expect(baseQuirks(null)).toBe('');
    expect(baseQuirks(undefined)).toBe('');
  });
});

describe('extractorQuirks', () => {
  test('readability extractor fixes quote spacing', () => {
    const text = 'He said " hello " to me';
    expect(extractorQuirks(text, 'readability')).toBe('He said"hello"to me');
  });

  test('newspaper extractor removes date headers', () => {
    const text = 'Feb. 15, 2026 Updated Feb. 15, 2026, 4:00 a.m. ET MUNICH, Germany...';
    const result = extractorQuirks(text, 'newspaper');
    expect(result).toContain('MUNICH');
    expect(result).not.toMatch(/Feb\. 15/);
  });

  test('unknown extractor passes through', () => {
    const text = 'Some text';
    expect(extractorQuirks(text, 'unknown')).toBe('Some text');
  });
});

describe('siteQuirks', () => {
  test('Fox News UI element removal', () => {
    const text =
      'NEW You can now listen to Fox News articles! The article begins here. CLICK HERE TO DOWNLOAD THE FOX NEWS APP More content.';
    const result = siteQuirks(text, 'https://www.foxnews.com/article');
    expect(result).not.toContain('NEW You can');
    expect(result).not.toContain('CLICK HERE');
    expect(result).toContain('The article begins here');
  });

  test('CNN live blogs are flagged as null', () => {
    const text = 'Live blog content';
    expect(siteQuirks(text, 'https://www.cnn.com/live-news/updates')).toBeNull();
  });

  test('CNN non-live pages pass through', () => {
    const text = 'Regular CNN article';
    expect(siteQuirks(text, 'https://www.cnn.com/2024/01/01/article')).toBe('Regular CNN article');
  });
});

describe('processAllLayers', () => {
  test('returns null for empty input', () => {
    expect(processAllLayers('', 'readability', 'https://example.com')).toBeNull();
  });

  test('returns null for error input', () => {
    expect(processAllLayers('ERROR: something', 'readability', 'https://example.com')).toBeNull();
  });

  test('applies all layers sequentially', () => {
    const text = 'Hello\xa0world .  Test\u2014dash';
    const result = processAllLayers(text, 'readability', 'https://example.com');
    expect(result).toBe('Hello world. Test-dash');
  });
});

describe('Unicode preservation', () => {
  test('preserves accented characters', () => {
    const text = 'Caf\u00e9 r\u00e9sum\u00e9 na\u00efve';
    expect(baseQuirks(text)).toBe(text);
  });

  test('Gizmodo smart quote regression', () => {
    const text = 'Reddit, Meta, and Google voluntarily \u201ccomplied with some of the requests\u201d for';
    const result = baseQuirks(text);
    expect(result).toBe('Reddit, Meta, and Google voluntarily "complied with some of the requests" for');
    expect(result).not.toContain('\u201c');
  });
});
