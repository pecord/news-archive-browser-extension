/**
 * Article Extractor Module
 *
 * Uses @mozilla/readability to extract article content from DOM.
 */

import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

/**
 * Extract article content from a document.
 * @param {Document} doc - The document to extract from
 * @returns {object|null} Extracted article or null if extraction fails
 */
export function extractArticle(doc) {
  // Clone so Readability doesn't mutate the live DOM
  const clone = doc.cloneNode(true);
  const reader = new Readability(clone);
  const article = reader.parse();

  if (!article) return null;

  // Sanitize HTML content
  const cleanHtml = DOMPurify.sanitize(article.content);

  // Extract plain text from the HTML
  const temp = doc.createElement('div');
  temp.innerHTML = cleanHtml;
  const textContent = temp.textContent || temp.innerText || '';

  return {
    title: article.title || '',
    byline: article.byline || '',
    excerpt: article.excerpt || '',
    content: textContent.trim(),
    html: cleanHtml,
    siteName: article.siteName || '',
    length: article.length || 0,
  };
}

/**
 * Validate that an extraction result meets minimum quality thresholds.
 * @param {object} result - Extraction result from extractArticle
 * @returns {boolean}
 */
export function validateExtraction(result) {
  if (!result) return false;
  if (!result.title || result.title.length < 10) return false;
  if (!result.content || result.content.length < 200) return false;
  return true;
}
