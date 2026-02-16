/**
 * Article Fingerprinter Module
 *
 * Generates stable content fingerprints for articles.
 * Ported from article_fingerprinter/fingerprinter.py (simplified for single-extractor v1).
 */

import { processAllLayers } from './quirks.js';

/**
 * SHA-256 hash using Web Crypto API. Returns hex string.
 */
export async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Strip tracking parameters from a URL to get a canonical form.
 */
export function getCanonicalUrl(url) {
  try {
    const u = new URL(url);
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_cid', 'mc_eid', '_ga', 'ref',
    ];
    for (const param of trackingParams) {
      u.searchParams.delete(param);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Try to extract a publish date from the URL path.
 * Returns ISO date string or empty string.
 */
export function extractPublishDate(url) {
  const match = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return '';
}

/**
 * Extract metadata from the document and URL.
 * Checks Schema.org JSON-LD, OpenGraph tags, canonical link, and title tag.
 */
export function extractMetadata(doc, url) {
  const metadata = {
    url,
    canonical_url: url,
    title: null,
    authors: [],
    publish_date: null,
    modified_date: null,
    has_schema_org: false,
    has_opengraph: false,
    has_canonical: false,
  };

  // Schema.org JSON-LD
  const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of ldScripts) {
    try {
      const data = JSON.parse(script.textContent);
      if (data && typeof data === 'object' && String(data['@type'] || '').includes('Article')) {
        metadata.has_schema_org = true;
        metadata.title = metadata.title || data.headline || null;
        metadata.publish_date = metadata.publish_date || data.datePublished || null;
        metadata.modified_date = metadata.modified_date || data.dateModified || null;

        const author = data.author;
        if (author && typeof author === 'object' && !Array.isArray(author)) {
          if (author.name) metadata.authors.push(author.name);
        } else if (Array.isArray(author)) {
          for (const a of author) {
            if (a && a.name) metadata.authors.push(a.name);
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Open Graph
  const ogTitle = doc.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    metadata.has_opengraph = true;
    metadata.title = metadata.title || ogTitle.getAttribute('content');
  }

  const ogPub = doc.querySelector('meta[property="article:published_time"]');
  if (ogPub) {
    metadata.publish_date = metadata.publish_date || ogPub.getAttribute('content');
  }

  const ogMod = doc.querySelector('meta[property="article:modified_time"]');
  if (ogMod) {
    metadata.modified_date = metadata.modified_date || ogMod.getAttribute('content');
  }

  // Canonical link
  const canonical = doc.querySelector('link[rel="canonical"]');
  if (canonical) {
    metadata.has_canonical = true;
    metadata.canonical_url = canonical.getAttribute('href') || url;
  }

  // Fallback title
  if (!metadata.title) {
    const titleTag = doc.querySelector('title');
    metadata.title = titleTag ? titleTag.textContent : 'Unknown';
  }

  // Fallback publish date from URL
  if (!metadata.publish_date) {
    metadata.publish_date = extractPublishDate(url);
  }

  return metadata;
}

/**
 * Generate a fingerprint for an extracted article.
 * Output structure aligns with the Python article_fingerprinter library.
 *
 * @param {object} article - Extracted article with at least { content, title }
 * @param {string} url - The article URL
 * @param {object} [pageMetadata] - Pre-extracted metadata from the content script
 * @returns {Promise<object>} Fingerprint result matching original repo structure
 */
export async function generateFingerprint(article, url, pageMetadata) {
  const startTime = Date.now();

  // Apply quirks normalization
  const processedText = processAllLayers(article.content, 'readability', url);
  if (!processedText) {
    throw new Error('Quirks processing returned null — content may be invalid');
  }

  // Content hash
  const contentHash = await sha256(processedText);

  // Build full metadata — use page-extracted metadata if available, fill gaps
  const metadata = {
    url,
    canonical_url: pageMetadata?.canonical_url || getCanonicalUrl(url),
    title: pageMetadata?.title || article.title || 'Unknown',
    authors: pageMetadata?.authors || [],
    publish_date: pageMetadata?.publish_date || extractPublishDate(url) || null,
    modified_date: pageMetadata?.modified_date || null,
    has_schema_org: pageMetadata?.has_schema_org || false,
    has_opengraph: pageMetadata?.has_opengraph || false,
    has_canonical: pageMetadata?.has_canonical || false,
  };

  const canonicalUrl = getCanonicalUrl(metadata.canonical_url);
  const publishDate = metadata.publish_date || '';
  const title = metadata.title;

  // Article ID: first 16 hex chars of SHA-256(canonical_url|publish_date|title)
  const articleIdSource = `${canonicalUrl}|${publishDate}|${title}`;
  const fullHash = await sha256(articleIdSource);
  const articleId = fullHash.slice(0, 16);

  const words = processedText.split(/\s+/).filter(Boolean);

  return {
    fingerprint: {
      article_id: articleId,
      content_hash: contentHash,
      extraction_method: 'readability_with_quirks',
      word_count: words.length,
      char_count: processedText.length,
      version: '1.0',
    },
    metadata,
    processed_text: processedText,
    processing_time_ms: Date.now() - startTime,
    extracted_at: new Date().toISOString(),
  };
}
