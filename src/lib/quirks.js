/**
 * Quirks Processing Module
 *
 * Three-layer quirks normalization:
 * 1. Base quirks: Universal formatting normalization
 * 2. Extractor quirks: Per-extractor fixes
 * 3. Site quirks: Site-specific content removal
 *
 * Ported from article_fingerprinter/quirks.py
 */

/**
 * Layer 1: Base normalization (all extractors)
 *
 * Normalizes whitespace, smart quotes, dashes, punctuation spacing,
 * non-breaking spaces, and zero-width characters.
 */
export function baseQuirks(text) {
  if (!text) return '';

  // Collapse whitespace
  text = text.split(/\s+/).join(' ');

  // Remove zero-width characters, normalize nbsp
  text = text.replace(/\xa0/g, ' ').replace(/\u200b/g, '');

  // Fix punctuation spacing: "word ." → "word."
  text = text.replace(/\s+([.,!?;:])/g, '$1');
  // "word.Next" → "word. Next"
  text = text.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2');

  // Normalize quotes (smart → straight)
  text = text.replace(/\u201c/g, '"').replace(/\u201d/g, '"');
  text = text.replace(/\u2018/g, "'").replace(/\u2019/g, "'");

  // Normalize dashes (em/en → hyphen)
  text = text.replace(/\u2014/g, '-').replace(/\u2013/g, '-');

  // Standardize sentence spacing: ".A" → ". A"
  text = text.replace(/\.([A-Z])/g, '. $1');

  // Final collapse
  return text.split(/\s+/).join(' ').trim();
}

/**
 * Layer 2: Extractor-specific quirks
 *
 * Fixes idiosyncrasies of specific extractors.
 */
export function extractorQuirks(text, extractor) {
  if (extractor === 'newspaper') {
    // Remove date headers at start
    text = text.replace(
      /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},\s+\d{4}.*?(?:ET|EST|PST|CST)\s*/i,
      ''
    );
  } else if (extractor === 'readability') {
    // Aggressive quote spacing cleanup
    text = text.replace(/"\s+/g, '"');
    text = text.replace(/\s+"/g, '"');
  } else if (extractor === 'goose') {
    // Remove photo credits
    text = text.replace(
      /\(.*?(?:Getty Images|Reuters|AFP|AP|Bloomberg)\)/gi,
      ''
    );
  }

  return text.trim();
}

/**
 * Layer 3: Site-specific quirks
 *
 * Removes known non-article content from specific sites.
 * Returns null if content should be flagged (e.g., live blogs).
 */
export function siteQuirks(text, url) {
  const domain = url.toLowerCase();

  if (domain.includes('foxnews.com')) {
    text = text.replace(/^NEW You can now listen to Fox News articles!?\s*/i, '');
    text = text.replace(/CLICK HERE TO (?:GET|DOWNLOAD) (?:THE )?FOX NEWS APP\s*/gi, '');
    text = text.replace(/Fox News['\s]+[\w\s]+contributed to this report\.?\s*$/i, '');
    text = text.replace(/[\w\s]+ is a (?:reporter|correspondent|anchor) with Fox News Digital.*?$/i, '');
    text = text.replace(/Send tips to [\w.@]+,?\s*or on (?:X|Twitter):\s*@[\w_]+\.?\s*$/i, '');
  } else if (domain.includes('cnn.com')) {
    if (url.includes('live-news') || url.includes('live-updates')) {
      return null;
    }
  }

  return text ? text.trim() : text;
}

/**
 * Apply all three layers of quirks processing.
 * Returns null on bad input.
 */
export function processAllLayers(text, extractor, url) {
  if (!text || text.startsWith('ERROR:')) {
    return null;
  }

  text = baseQuirks(text);
  text = extractorQuirks(text, extractor);
  text = siteQuirks(text, url);

  return text;
}
