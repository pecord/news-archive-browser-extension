/**
 * Content Script
 *
 * Injected into every page. Detects news articles and handles extraction
 * requests from the popup / background service worker.
 */

import { extractArticle, validateExtraction } from './lib/extractor.js';
import { extractMetadata } from './lib/fingerprinter.js';

const NEWS_DOMAINS = [
  'nytimes.com', 'theguardian.com', 'washingtonpost.com', 'cnn.com',
  'bbc.com', 'bbc.co.uk', 'reuters.com', 'apnews.com', 'foxnews.com',
  'nbcnews.com', 'abcnews.go.com', 'cbsnews.com', 'politico.com',
  'thehill.com', 'axios.com', 'npr.org', 'usatoday.com', 'latimes.com',
  'wsj.com', 'bloomberg.com', 'economist.com', 'theatlantic.com',
  'newyorker.com', 'wired.com', 'arstechnica.com', 'theverge.com',
  'vox.com', 'slate.com', 'salon.com', 'dailybeast.com', 'buzzfeednews.com',
  'propublica.com', 'theintercept.com', 'motherjones.com',
];

/**
 * Detect whether the current page is likely a news article.
 */
function isArticlePage() {
  // Check for <article> tag
  if (document.querySelector('article')) return true;

  // Check Schema.org JSON-LD for Article type
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of ldScripts) {
    try {
      const data = JSON.parse(script.textContent);
      if (data && String(data['@type'] || '').includes('Article')) return true;
    } catch { /* ignore */ }
  }

  // Check og:type
  const ogType = document.querySelector('meta[property="og:type"]');
  if (ogType && ogType.getAttribute('content') === 'article') return true;

  // Known news domain check
  const hostname = window.location.hostname;
  if (NEWS_DOMAINS.some((d) => hostname.includes(d))) {
    // Additional word-count heuristic for known domains
    const mainContent = document.querySelector('article, [role="main"], main, .article-body, .story-body');
    if (mainContent) {
      const words = (mainContent.textContent || '').split(/\s+/).length;
      if (words >= 200) return true;
    }
  }

  return false;
}

// Notify background script if we're on an article page
if (isArticlePage()) {
  chrome.runtime.sendMessage({ type: 'newsPageDetected', url: window.location.href });
}

// Listen for messages from popup / background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'checkIfArticle') {
    sendResponse({ isArticle: isArticlePage() });
    return false;
  }

  if (message.type === 'extractArticle') {
    const result = extractArticle(document);
    const valid = validateExtraction(result);
    const metadata = extractMetadata(document, window.location.href);
    sendResponse({ article: result, valid, metadata });
    return false;
  }

  return false;
});
