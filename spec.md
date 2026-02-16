# News Archive Browser Extension - Technical Specification

**Version:** 1.0.0  
**Last Updated:** February 16, 2026  
**Status:** Draft for Review

---

## Executive Summary

A browser extension that preserves news articles in a decentralized, permanent archive using IPFS (InterPlanetary File System) and content fingerprinting. Users can archive articles with one click, creating censorship-resistant backups that remain accessible even if the original is deleted or paywalled.

### Key Features
- One-click article archiving to IPFS
- Content fingerprinting for deduplication and verification
- Automatic detection of news articles
- Permanent, decentralized storage
- Citation generation for archived content
- Deletion detection and recovery

### Target Users
- Journalists and researchers
- Academics citing news sources
- Activists preserving evidence
- General users concerned about information preservation

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Extension                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Content    │  │  Background  │  │    Popup     │      │
│  │   Script     │  │   Worker     │  │      UI      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│         │    DOM          │    Messages      │   User       │
│         │   Access        │    & Storage     │  Interaction │
│         │                 │                  │              │
└─────────┼─────────────────┼──────────────────┼──────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │   Page   │      │   IPFS   │      │ IndexedDB│
    │   DOM    │      │ Storage  │      │  Cache   │
    └──────────┘      └──────────┘      └──────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │  Decentralized   │
                  │  IPFS Network    │
                  └──────────────────┘
```

### 1.2 Technology Stack

**Core Technologies:**
- **Manifest Version:** V3 (Chrome/Edge/Brave)
- **Language:** JavaScript (ES2022+)
- **Build Tool:** Webpack 5 + Babel
- **Testing:** Jest + Puppeteer (E2E)
- **Linting:** ESLint + Prettier

**Key Libraries:**
- **@mozilla/readability** - Article extraction
- **crypto-js** - SHA-256 hashing
- **web3.storage SDK** - IPFS storage API
- **idb** - IndexedDB wrapper
- **DOMPurify** - HTML sanitization

**Optional/Future:**
- **js-ipfs** or **Helia** - Local IPFS node (v2.0)
- **libp2p** - P2P networking (v2.0)
- **OrbitDB** - Decentralized database (v3.0)

### 1.3 Data Flow

```
User visits news article
         │
         ▼
Content script detects article
         │
         ▼
User clicks "Archive" button
         │
         ▼
Extract article content (Readability)
         │
         ▼
Apply quirks normalization
         │
         ▼
Generate content fingerprint (SHA-256)
         │
         ▼
Create article manifest (JSON)
         │
         ▼
Upload to IPFS (Web3.Storage API)
         │
         ▼
Receive CID (Content Identifier)
         │
         ▼
Store metadata in IndexedDB
         │
         ▼
Show success + IPFS link to user
```

---

## 2. Core Modules

### 2.1 Content Script (`content.js`)

**Purpose:** Runs on every webpage to detect articles and extract content

**Responsibilities:**
- Detect if page contains a news article
- Extract article DOM when requested
- Communicate with background worker
- Update extension badge icon

**Article Detection Logic:**
```javascript
function isNewsArticle(doc, url) {
  // Structural indicators
  const hasArticleTag = doc.querySelector('article');
  const hasSchemaOrg = doc.querySelector('script[type="application/ld+json"]');
  const hasOGArticle = doc.querySelector('meta[property="og:type"][content="article"]');
  
  // Domain whitelist (expandable)
  const newsDomains = [
    'nytimes.com', 'washingtonpost.com', 'theguardian.com',
    'cnn.com', 'bbc.com', 'reuters.com', 'apnews.com',
    'wsj.com', 'ft.com', 'bloomberg.com', 'axios.com',
    'politico.com', 'theatlantic.com', 'npr.org', 'pbs.org'
  ];
  
  const matchesDomain = newsDomains.some(d => url.includes(d));
  
  // URL patterns
  const hasDateInUrl = /\/\d{4}\/\d{2}\/\d{2}\//.test(url);
  const hasArticleInUrl = /\/(article|story|news|post)\//.test(url);
  
  // Word count heuristic (avoid homepage)
  const textContent = doc.body.textContent;
  const wordCount = textContent.split(/\s+/).length;
  const minWords = 200;
  
  return (hasArticleTag || hasSchemaOrg || hasOGArticle) &&
         (matchesDomain || hasDateInUrl || hasArticleInUrl) &&
         wordCount >= minWords;
}
```

**Message Handlers:**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'extractArticle':
      const article = extractArticle(document, window.location.href);
      sendResponse(article);
      break;
      
    case 'checkIfArticle':
      const isArticle = isNewsArticle(document, window.location.href);
      sendResponse({ isArticle });
      break;
  }
  return true; // Keep message channel open
});
```

**Performance Considerations:**
- Run at `document_idle` to avoid blocking page load
- Use passive event listeners
- Debounce DOM mutations
- Lazy-load heavy dependencies

---

### 2.2 Article Extractor (`extractor.js`)

**Purpose:** Extract clean article content from webpage

**Primary Method: Readability.js**

```javascript
import { Readability } from '@mozilla/readability';

class ArticleExtractor {
  /**
   * Extract article content using Mozilla's Readability
   * @param {Document} doc - DOM document
   * @param {string} url - Page URL
   * @returns {Object|null} Extracted article data
   */
  static extract(doc, url) {
    // Clone to avoid modifying live page
    const documentClone = doc.cloneNode(true);
    
    // Configure Readability
    const reader = new Readability(documentClone, {
      debug: false,
      maxElemsToParse: 0, // No limit
      nbTopCandidates: 5,
      charThreshold: 500,
      classesToPreserve: ['article', 'content', 'entry'],
    });
    
    const article = reader.parse();
    
    if (!article) {
      return null;
    }
    
    return {
      title: article.title,
      byline: article.byline,
      excerpt: article.excerpt,
      content: article.textContent, // Plain text
      html: article.content, // HTML (optional, for preview)
      length: article.length,
      siteName: article.siteName,
    };
  }
  
  /**
   * Validate extracted content
   */
  static validate(article) {
    if (!article) return false;
    if (!article.title || article.title.length < 10) return false;
    if (!article.content || article.content.length < 200) return false;
    return true;
  }
}
```

**Fallback Extractors (Future):**
- **Trafilatura** (if ported to JS/WASM)
- **Custom CSS selectors** per site
- **LLM-based extraction** (GPT-4 API for complex layouts)

---

### 2.3 Quirks Processor (`quirks.js`)

**Purpose:** Normalize text to create stable fingerprints

**Three-Layer Processing:**

```javascript
class QuirksProcessor {
  /**
   * Layer 1: Universal normalization
   */
  baseQuirks(text) {
    if (!text) return "";
    
    // 1. Collapse whitespace
    text = text.replace(/\s+/g, ' ');
    
    // 2. Remove zero-width characters
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // 3. Replace non-breaking space
    text = text.replace(/\u00A0/g, ' ');
    
    // 4. Fix punctuation spacing
    text = text.replace(/\s+([.,!?;:])/g, '$1'); // "word ." → "word."
    text = text.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2'); // "word.Next" → "word. Next"
    
    // 5. Normalize quotes (smart → straight)
    // CRITICAL: Use Unicode escapes for reliability
    text = text.replace(/\u201C/g, '"')  // " (left double)
               .replace(/\u201D/g, '"')  // " (right double)
               .replace(/\u2018/g, "'")  // ' (left single)
               .replace(/\u2019/g, "'")  // ' (right single)
               .replace(/\u201B/g, "'")  // ‛ (single reversed)
               .replace(/\u2032/g, "'")  // ′ (prime)
               .replace(/\u2033/g, '"'); // ″ (double prime)
    
    // 6. Normalize dashes
    text = text.replace(/\u2014/g, '-')  // — (em dash)
               .replace(/\u2013/g, '-')  // – (en dash)
               .replace(/\u2212/g, '-'); // − (minus sign)
    
    // 7. Normalize ellipsis
    text = text.replace(/\u2026/g, '...');
    
    // 8. Sentence spacing
    text = text.replace(/\.([A-Z])/g, '. $1');
    
    // 9. Final collapse
    return text.trim().replace(/\s+/g, ' ');
  }
  
  /**
   * Layer 2: Extractor-specific fixes
   */
  extractorQuirks(text, extractor) {
    switch (extractor) {
      case 'readability':
        // Aggressive quote spacing cleanup
        text = text.replace(/"\s+/g, '"');
        text = text.replace(/\s+"/g, '"');
        break;
        
      case 'custom':
        // Site-specific extractor quirks
        break;
    }
    return text.trim();
  }
  
  /**
   * Layer 3: Site-specific content removal
   */
  siteQuirks(text, url) {
    const domain = new URL(url).hostname.toLowerCase();
    
    // Fox News UI elements
    if (domain.includes('foxnews.com')) {
      text = text.replace(/^NEW\s+You can now listen to Fox News articles!?\s*/i, '');
      text = text.replace(/CLICK HERE TO (?:GET|DOWNLOAD) (?:THE )?FOX NEWS APP\s*/gi, '');
      text = text.replace(/Fox News['\s]+[\w\s]+contributed to this report\.?\s*$/i, '');
    }
    
    // CNN live blogs (flag for exclusion)
    if (domain.includes('cnn.com') && 
        (url.includes('live-news') || url.includes('live-updates'))) {
      return null; // Signal: don't archive live blogs
    }
    
    // Generic newsletter prompts
    text = text.replace(/Sign up for (?:our|the) (?:free )?(?:daily |weekly )?newsletter.*/gi, '');
    text = text.replace(/Subscribe to (?:our|the) newsletter.*/gi, '');
    
    return text.trim();
  }
  
  /**
   * Apply all three layers
   */
  processAll(text, extractor, url) {
    if (!text || text.startsWith("ERROR:")) {
      return null;
    }
    
    text = this.baseQuirks(text);
    text = this.extractorQuirks(text, extractor);
    text = this.siteQuirks(text, url);
    
    return text;
  }
}
```

**Quirks Testing:**
- Unit tests for each normalization step
- Regression tests for Gizmodo mojibake bug
- Cross-browser encoding tests

---

### 2.4 Fingerprinter (`fingerprinter.js`)

**Purpose:** Generate unique, stable content hashes

```javascript
import CryptoJS from 'crypto-js';

class ArticleFingerprinter {
  constructor() {
    this.quirks = new QuirksProcessor();
  }
  
  /**
   * Generate article fingerprint
   * @param {Object} extracted - Output from ArticleExtractor
   * @param {string} url - Article URL
   * @returns {Object} Fingerprint + metadata
   */
  fingerprint(extracted, url) {
    const startTime = performance.now();
    
    // Process content with quirks
    const processed = this.quirks.processAll(
      extracted.content,
      'readability',
      url
    );
    
    if (!processed) {
      return null;
    }
    
    // Generate content hash (SHA-256)
    const contentHash = CryptoJS.SHA256(processed).toString();
    
    // Generate article ID (URL + title + date)
    const articleId = this.generateArticleId(
      url,
      extracted.title,
      this.extractPublishDate(url)
    );
    
    // Calculate metrics
    const wordCount = processed.split(/\s+/).length;
    const charCount = processed.length;
    
    return {
      fingerprint: {
        article_id: articleId,
        content_hash: contentHash,
        word_count: wordCount,
        char_count: charCount,
        version: '1.0.0', // Schema version
      },
      metadata: {
        url: url,
        canonical_url: this.extractCanonicalUrl(url),
        title: extracted.title,
        byline: extracted.byline,
        excerpt: extracted.excerpt,
        site_name: extracted.siteName,
        publish_date: this.extractPublishDate(url),
      },
      content: {
        raw: extracted.content,
        processed: processed,
        html: extracted.html, // Optional
      },
      extracted_at: new Date().toISOString(),
      processing_time_ms: performance.now() - startTime,
    };
  }
  
  /**
   * Generate stable article ID
   * Combines URL + title + date for uniqueness
   */
  generateArticleId(url, title, date) {
    const canonical = this.extractCanonicalUrl(url);
    const source = `${canonical}|${date || ''}|${title}`;
    const hash = CryptoJS.SHA256(source).toString();
    return hash.substring(0, 16); // 64-bit hex
  }
  
  /**
   * Extract canonical URL (remove tracking params)
   */
  extractCanonicalUrl(url) {
    const parsed = new URL(url);
    
    // Remove common tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign',
      'utm_content', 'utm_term', 'fbclid', 'gclid',
      'mc_cid', 'mc_eid', '_ga', 'ref'
    ];
    
    trackingParams.forEach(param => {
      parsed.searchParams.delete(param);
    });
    
    return parsed.toString();
  }
  
  /**
   * Extract publish date from URL or metadata
   * Returns ISO date string or null
   */
  extractPublishDate(url) {
    // Try URL pattern: /2026/02/15/article
    const dateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    if (dateMatch) {
      return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }
    
    // Try meta tags (done in metadata extraction)
    return null;
  }
}
```

**Hash Stability Guarantees:**
- Same content → Same hash (idempotent)
- Whitespace changes → Same hash
- Quote style changes → Same hash
- Tracking params → Same article_id
- Minor edits → Different hash (version detection)

---

### 2.5 IPFS Storage (`ipfs-storage.js`)

**Purpose:** Store articles to IPFS via Web3.Storage

**Storage Providers (Priority Order):**
1. **Web3.Storage** (Primary) - NFT.Storage fork, generous free tier
2. **Pinata** (Fallback) - Reliable, good free tier
3. **Filebase** (Future) - S3-compatible IPFS storage
4. **Local IPFS node** (v2.0) - For power users

```javascript
class IPFSStorage {
  constructor(config = {}) {
    this.provider = config.provider || 'web3storage';
    this.apiKey = config.apiKey;
    this.endpoints = {
      web3storage: 'https://api.web3.storage',
      pinata: 'https://api.pinata.cloud',
    };
  }
  
  /**
   * Store article to IPFS
   * @param {Object} article - Fingerprinted article
   * @returns {Promise<string>} CID (Content Identifier)
   */
  async store(article) {
    // Create article manifest
    const manifest = this.createManifest(article);
    
    // Convert to File/Blob
    const blob = new Blob(
      [JSON.stringify(manifest, null, 2)],
      { type: 'application/json' }
    );
    
    const file = new File(
      [blob],
      `article-${article.fingerprint.article_id}.json`,
      { type: 'application/json' }
    );
    
    // Upload to IPFS
    const cid = await this.upload(file);
    
    return cid;
  }
  
  /**
   * Create article manifest for storage
   */
  createManifest(article) {
    return {
      version: '1.0.0',
      schema: 'news-archive-article',
      fingerprint: article.fingerprint,
      metadata: article.metadata,
      content: article.content.processed, // Store normalized text
      extracted_at: article.extracted_at,
      archived_by: 'news-archive-extension',
      // Optional: include HTML for rendering
      html: article.content.html,
    };
  }
  
  /**
   * Upload to Web3.Storage
   */
  async uploadWeb3Storage(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${this.endpoints.web3storage}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.cid;
  }
  
  /**
   * Upload to Pinata
   */
  async uploadPinata(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${this.endpoints.pinata}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        'pinata_api_key': this.apiKey,
        'pinata_secret_api_key': this.secretKey,
      },
      body: formData,
    });
    
    const data = await response.json();
    return data.IpfsHash;
  }
  
  /**
   * Upload dispatcher
   */
  async upload(file) {
    switch (this.provider) {
      case 'web3storage':
        return await this.uploadWeb3Storage(file);
      case 'pinata':
        return await this.uploadPinata(file);
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }
  }
  
  /**
   * Get IPFS gateway URLs
   */
  getUrls(cid) {
    return {
      web3storage: `https://w3s.link/ipfs/${cid}`,
      ipfs_io: `https://ipfs.io/ipfs/${cid}`,
      cloudflare: `https://cloudflare-ipfs.com/ipfs/${cid}`,
      dweb: `https://dweb.link/ipfs/${cid}`,
      native: `ipfs://${cid}`,
    };
  }
  
  /**
   * Verify uploaded content
   */
  async verify(cid, expectedHash) {
    const url = `https://w3s.link/ipfs/${cid}`;
    const response = await fetch(url);
    const data = await response.json();
    
    return data.fingerprint.content_hash === expectedHash;
  }
}
```

**Storage Optimization:**
- Compress JSON with gzip (if supported)
- Deduplicate by content hash before upload
- Batch uploads for multiple articles
- Cache upload queue in IndexedDB

---

### 2.6 Background Worker (`background.js`)

**Purpose:** Service worker handling storage, indexing, and coordination

```javascript
// background.js

import { IPFSStorage } from './ipfs-storage.js';
import { LocalIndex } from './local-index.js';

let ipfsStorage;
let localIndex;

/**
 * Initialize on extension install/update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('News Archive installed:', details.reason);
  
  // Initialize IndexedDB
  localIndex = new LocalIndex();
  await localIndex.init();
  
  // Load config
  const config = await chrome.storage.sync.get(['apiKey', 'provider']);
  if (config.apiKey) {
    ipfsStorage = new IPFSStorage({
      provider: config.provider || 'web3storage',
      apiKey: config.apiKey,
    });
  } else {
    // Prompt for API key on first run
    if (details.reason === 'install') {
      chrome.tabs.create({ url: 'onboarding.html' });
    }
  }
  
  // Set up context menu
  chrome.contextMenus.create({
    id: 'archive-article',
    title: 'Archive this article',
    contexts: ['page'],
  });
});

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'archive-article') {
    archiveCurrentTab(tab.id);
  }
});

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'newsPageDetected':
      updateBadge(sender.tab.id, true);
      break;
      
    case 'archiveArticle':
      archiveArticle(request.article)
        .then(result => sendResponse({ success: true, ...result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Async
      
    case 'getArchived':
      localIndex.getAll()
        .then(articles => sendResponse({ articles }))
        .catch(err => sendResponse({ error: err.message }));
      return true; // Async
      
    case 'searchArchive':
      localIndex.search(request.query)
        .then(results => sendResponse({ results }))
        .catch(err => sendResponse({ error: err.message }));
      return true; // Async
  }
});

/**
 * Archive an article
 */
async function archiveArticle(article) {
  // Check for duplicates
  const existing = await localIndex.findByHash(
    article.fingerprint.content_hash
  );
  
  if (existing) {
    return {
      cid: existing.cid,
      duplicate: true,
      message: 'Article already archived',
    };
  }
  
  // Upload to IPFS
  const cid = await ipfsStorage.store(article);
  
  // Verify upload
  const verified = await ipfsStorage.verify(
    cid,
    article.fingerprint.content_hash
  );
  
  if (!verified) {
    throw new Error('Upload verification failed');
  }
  
  // Save to local index
  await localIndex.add({
    cid,
    article_id: article.fingerprint.article_id,
    content_hash: article.fingerprint.content_hash,
    url: article.metadata.url,
    title: article.metadata.title,
    byline: article.metadata.byline,
    excerpt: article.metadata.excerpt,
    word_count: article.fingerprint.word_count,
    archived_at: article.extracted_at,
  });
  
  // Update badge
  incrementArchiveCount();
  
  return {
    cid,
    urls: ipfsStorage.getUrls(cid),
    duplicate: false,
  };
}

/**
 * Update extension badge
 */
function updateBadge(tabId, isArticle) {
  if (isArticle) {
    chrome.action.setBadgeText({ text: '📰', tabId });
    chrome.action.setBadgeBackgroundColor({ 
      color: '#007bff',
      tabId 
    });
  }
}

/**
 * Increment total archive count
 */
async function incrementArchiveCount() {
  const { archiveCount = 0 } = await chrome.storage.local.get(['archiveCount']);
  await chrome.storage.local.set({ archiveCount: archiveCount + 1 });
  chrome.action.setBadgeText({ text: String(archiveCount + 1) });
}
```

---

### 2.7 Local Index (`local-index.js`)

**Purpose:** IndexedDB wrapper for local archive metadata

```javascript
import { openDB } from 'idb';

class LocalIndex {
  constructor() {
    this.dbName = 'news-archive';
    this.version = 1;
    this.db = null;
  }
  
  /**
   * Initialize database
   */
  async init() {
    this.db = await openDB(this.dbName, this.version, {
      upgrade(db) {
        // Articles store
        const articles = db.createObjectStore('articles', {
          keyPath: 'article_id',
        });
        
        articles.createIndex('cid', 'cid', { unique: true });
        articles.createIndex('content_hash', 'content_hash', { unique: false });
        articles.createIndex('url', 'url', { unique: false });
        articles.createIndex('archived_at', 'archived_at', { unique: false });
        articles.createIndex('title', 'title', { unique: false });
        
        // Full-text search (simple)
        articles.createIndex('title_lower', 'title_lower', { unique: false });
      },
    });
  }
  
  /**
   * Add article to index
   */
  async add(article) {
    // Add lowercase title for search
    article.title_lower = article.title.toLowerCase();
    
    const tx = this.db.transaction('articles', 'readwrite');
    await tx.store.put(article);
    await tx.done;
  }
  
  /**
   * Get all archived articles
   */
  async getAll(options = {}) {
    const {
      orderBy = 'archived_at',
      direction = 'prev', // 'prev' = descending
      limit = 100,
    } = options;
    
    const tx = this.db.transaction('articles', 'readonly');
    const index = tx.store.index(orderBy);
    
    let cursor = await index.openCursor(null, direction);
    const results = [];
    
    while (cursor && results.length < limit) {
      results.push(cursor.value);
      cursor = await cursor.continue();
    }
    
    return results;
  }
  
  /**
   * Find by content hash (deduplication)
   */
  async findByHash(contentHash) {
    const tx = this.db.transaction('articles', 'readonly');
    const index = tx.store.index('content_hash');
    return await index.get(contentHash);
  }
  
  /**
   * Search by title (simple text search)
   */
  async search(query) {
    const lowerQuery = query.toLowerCase();
    const all = await this.getAll({ limit: 1000 });
    
    return all.filter(article => 
      article.title_lower.includes(lowerQuery) ||
      (article.byline && article.byline.toLowerCase().includes(lowerQuery)) ||
      (article.excerpt && article.excerpt.toLowerCase().includes(lowerQuery))
    );
  }
  
  /**
   * Get statistics
   */
  async getStats() {
    const all = await this.getAll({ limit: 10000 });
    
    const totalWordCount = all.reduce((sum, a) => sum + a.word_count, 0);
    const domains = {};
    
    all.forEach(a => {
      const domain = new URL(a.url).hostname;
      domains[domain] = (domains[domain] || 0) + 1;
    });
    
    return {
      total_articles: all.length,
      total_words: totalWordCount,
      domains: Object.entries(domains)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      oldest: all[all.length - 1],
      newest: all[0],
    };
  }
  
  /**
   * Export all data (for backup)
   */
  async exportAll() {
    const all = await this.getAll({ limit: 100000 });
    return {
      version: this.version,
      exported_at: new Date().toISOString(),
      articles: all,
    };
  }
  
  /**
   * Import data (from backup)
   */
  async importAll(data) {
    const tx = this.db.transaction('articles', 'readwrite');
    for (const article of data.articles) {
      await tx.store.put(article);
    }
    await tx.done;
  }
}
```

---

## 3. User Interface

### 3.1 Popup (`popup.html`)

**Layout:**

```
┌────────────────────────────────────┐
│  📰 News Archive                   │
├────────────────────────────────────┤
│                                    │
│  ┌──────────────────────────────┐ │
│  │  Current Article             │ │
│  │  ─────────────────────────── │ │
│  │  Title: "Breaking News..."   │ │
│  │  Domain: nytimes.com         │ │
│  │  Words: 1,234                │ │
│  │  Hash: a3f2d1...             │ │
│  └──────────────────────────────┘ │
│                                    │
│  [ Archive to IPFS ]  ✓ Archived  │
│                                    │
│  ──────────────────────────────── │
│                                    │
│  Recently Archived (5)             │
│  • Article Title 1      [View]    │
│  • Article Title 2      [View]    │
│  • Article Title 3      [View]    │
│                                    │
│  [View All (234) →]                │
│                                    │
│  ──────────────────────────────── │
│  Stats: 234 articles, 456k words  │
│  [Settings] [Help]                 │
└────────────────────────────────────┘
```

**States:**

1. **Article Detected**
   - Show article preview
   - "Archive" button enabled
   
2. **No Article**
   - "No article detected on this page"
   - Show recent archives list
   
3. **Archiving**
   - Progress indicator
   - "Archiving..." button disabled
   
4. **Archived**
   - Success message with IPFS link
   - "View on IPFS" button
   
5. **Already Archived**
   - "This article was archived on [date]"
   - Link to existing archive
   
6. **Error**
   - Error message
   - "Retry" button

### 3.2 Archive Browser (`archive.html`)

**Full-page view of all archived articles**

```
┌─────────────────────────────────────────────────────┐
│  🗄️  News Archive Browser                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Search archives...]              [⚙️ Settings]   │
│                                                     │
│  Filters: [All Sites ▼] [All Dates ▼] [Sort: Date▼]│
│                                                     │
│  ─────────────────────────────────────────────────│
│                                                     │
│  📰 Article Title Goes Here                         │
│     By Author Name • nytimes.com • Feb 15, 2026    │
│     Excerpt of the article appears here to give    │
│     context about what was archived...             │
│     [View on IPFS] [View Original] [Copy CID]      │
│                                                     │
│  📰 Another Article Title                           │
│     By Author • theguardian.com • Feb 14, 2026     │
│     ...                                            │
│                                                     │
│  [Load More...]                                    │
│                                                     │
│  ─────────────────────────────────────────────────│
│  Statistics                                        │
│  Total: 234 articles • 456,789 words               │
│  Top Sites: NYT (45), Guardian (32), WSJ (28)      │
│  [Export Data] [Import Backup]                     │
└─────────────────────────────────────────────────────┘
```

### 3.3 Settings (`settings.html`)

```
General Settings
  ├─ IPFS Provider: [Web3.Storage ▼]
  ├─ API Key: [••••••••••••••] [Change]
  ├─ Auto-archive: [ ] Enable automatic archiving
  └─ Archive delay: [10] seconds after page load

Storage
  ├─ Local cache: 45 MB / 500 MB
  ├─ [Clear Cache]
  └─ [Export All Data]

Privacy
  ├─ [ ] Share anonymous usage statistics
  └─ [ ] Include article HTML (larger uploads)

Advanced
  ├─ [ ] Enable debug logging
  ├─ [ ] Use local IPFS node (requires setup)
  └─ Custom gateway: [https://ipfs.io] [Test]

About
  ├─ Version: 1.0.0
  ├─ [View Changelog]
  ├─ [Report Issue]
  └─ [Privacy Policy]
```

### 3.4 Onboarding (`onboarding.html`)

**First-run experience:**

```
Step 1: Welcome
  - What is News Archive?
  - How it works (diagram)
  - [Get Started →]

Step 2: Get API Key
  - Visit Web3.Storage
  - Create free account
  - Copy API key
  - [I have my key →]

Step 3: Enter Key
  - [Paste API key here...]
  - [Verify & Save]

Step 4: Done!
  - You're all set
  - [Archive Your First Article]
```

---

## 4. Advanced Features

### 4.1 Deletion Detection

**Monitor archived articles for deletion/changes:**

```javascript
class DeletionMonitor {
  /**
   * Check if article still exists at original URL
   */
  async checkStatus(url) {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors', // Avoid CORS issues
      });
      
      if (response.status === 404) return 'deleted';
      if (response.status === 403) return 'blocked';
      if (response.status === 410) return 'gone';
      if (response.status >= 200 && response.status < 300) return 'available';
      
      return 'unknown';
    } catch (err) {
      return 'unreachable';
    }
  }
  
  /**
   * Periodically check archived articles
   * (run in background once per day)
   */
  async monitorAll() {
    const articles = await localIndex.getAll();
    const results = [];
    
    for (const article of articles) {
      const status = await this.checkStatus(article.url);
      
      if (status === 'deleted' || status === 'gone') {
        results.push({
          article,
          status,
          checked_at: new Date().toISOString(),
        });
        
        // Update article metadata
        await localIndex.update(article.article_id, {
          deletion_detected: true,
          deleted_at: new Date().toISOString(),
        });
      }
      
      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
  
  /**
   * Notify user of deletions
   */
  notifyDeletions(deletedArticles) {
    if (deletedArticles.length === 0) return;
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Articles Deleted',
      message: `${deletedArticles.length} archived articles were deleted from their original sources.`,
      buttons: [
        { title: 'View Archives' }
      ],
    });
  }
}
```

**UI Indicator:**
- Red badge on deleted articles
- "⚠️ Original deleted" label
- Prominent "View Archive" button

### 4.2 Citation Generator

```javascript
class CitationGenerator {
  /**
   * Generate citations in multiple formats
   */
  generate(article, cid) {
    const author = article.byline || 'Unknown Author';
    const title = article.title;
    const site = new URL(article.url).hostname.replace('www.', '');
    const date = new Date(article.archived_at);
    const year = date.getFullYear();
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const day = date.getDate();
    
    return {
      apa: `${author}. (${year}, ${month} ${day}). ${title}. ${site}. Archived at ipfs://${cid}`,
      
      mla: `${author}. "${title}." ${site}, ${day} ${month} ${year}, ipfs://${cid}. Accessed ${new Date().toLocaleDateString()}.`,
      
      chicago: `${author}, "${title}," ${site}, ${month} ${day}, ${year}, ipfs://${cid}.`,
      
      bibtex: `@article{${cid.substring(0, 8)},
  author = {${author}},
  title = {${title}},
  journal = {${site}},
  year = {${year}},
  note = {Archived at \\url{ipfs://${cid}}}
}`,
      
      // Permanent links
      permalink_ipfs: `ipfs://${cid}`,
      permalink_http: `https://w3s.link/ipfs/${cid}`,
    };
  }
  
  /**
   * Copy citation to clipboard
   */
  async copy(citation, format) {
    await navigator.clipboard.writeText(citation[format]);
    return true;
  }
}
```

### 4.3 Automatic Archiving

**Background archiving mode:**

```javascript
class AutoArchiver {
  constructor(config) {
    this.enabled = config.enabled || false;
    this.delay = config.delay || 10000; // 10 seconds
    this.whitelist = config.whitelist || []; // Specific domains
  }
  
  /**
   * Monitor page navigation
   */
  init() {
    chrome.webNavigation.onCompleted.addListener((details) => {
      if (!this.enabled) return;
      if (details.frameId !== 0) return; // Main frame only
      
      // Check if URL matches whitelist
      if (this.whitelist.length > 0) {
        const match = this.whitelist.some(domain => 
          details.url.includes(domain)
        );
        if (!match) return;
      }
      
      // Schedule archiving
      setTimeout(() => {
        this.autoArchive(details.tabId);
      }, this.delay);
    });
  }
  
  /**
   * Archive current page automatically
   */
  async autoArchive(tabId) {
    // Check if page is an article
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'checkIfArticle'
    });
    
    if (!response.isArticle) return;
    
    // Extract and archive
    const article = await chrome.tabs.sendMessage(tabId, {
      action: 'extractArticle'
    });
    
    if (article) {
      await archiveArticle(article);
      
      // Show subtle notification
      chrome.action.setBadgeText({ text: '✓', tabId });
      chrome.action.setBadgeBackgroundColor({ 
        color: '#28a745',
        tabId 
      });
    }
  }
}
```

### 4.4 Social Sharing

**Share archived articles:**

```javascript
class ShareManager {
  /**
   * Generate shareable link
   */
  getShareLink(cid, title) {
    return {
      ipfs: `ipfs://${cid}`,
      gateway: `https://w3s.link/ipfs/${cid}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`📰 Archived: "${title}"`)}&url=https://w3s.link/ipfs/${cid}`,
      reddit: `https://reddit.com/submit?url=https://w3s.link/ipfs/${cid}&title=${encodeURIComponent(title)}`,
    };
  }
  
  /**
   * Copy shareable markdown
   */
  getMarkdown(article, cid) {
    return `# ${article.title}

By ${article.byline || 'Unknown'} • ${new Date(article.archived_at).toLocaleDateString()}

**Original:** ${article.url}  
**Archive:** https://w3s.link/ipfs/${cid}  
**IPFS:** \`ipfs://${cid}\`

${article.excerpt || ''}
`;
  }
}
```

### 4.5 Browser Integration

**Page Action (when article detected):**

```javascript
// Show "Archive" button in address bar
chrome.action.onClicked.addListener((tab) => {
  // Quick archive from address bar
  archiveCurrentTab(tab.id);
});

// Keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'archive-page') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      archiveCurrentTab(tabs[0].id);
    });
  }
});
```

**Manifest entry:**
```json
{
  "commands": {
    "archive-page": {
      "suggested_key": {
        "default": "Ctrl+Shift+A",
        "mac": "Command+Shift+A"
      },
      "description": "Archive current article"
    }
  }
}
```

---

## 5. Performance & Optimization

### 5.1 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Article extraction | < 500ms | performance.now() |
| Fingerprint generation | < 100ms | performance.now() |
| IPFS upload | < 5 sec | API response time |
| IndexedDB query | < 50ms | idb timing |
| Extension size | < 500 KB | Webpack bundle |
| Memory usage | < 50 MB | Chrome DevTools |

### 5.2 Bundle Optimization

**Webpack Configuration:**

```javascript
// webpack.config.js
module.exports = {
  mode: 'production',
  entry: {
    background: './src/background.js',
    content: './src/content.js',
    popup: './src/popup.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: true, // Remove console.log in production
        },
      },
    })],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
        },
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
};
```

### 5.3 Lazy Loading

**Load heavy libraries only when needed:**

```javascript
// Don't import at top level
// import CryptoJS from 'crypto-js'; // ❌

// Import dynamically when needed
async function generateHash(text) {
  const CryptoJS = await import('crypto-js'); // ✓
  return CryptoJS.SHA256(text).toString();
}
```

### 5.4 Caching Strategy

```javascript
class CacheManager {
  constructor() {
    this.extractionCache = new Map();
    this.maxCacheSize = 50;
  }
  
  /**
   * Cache article extractions
   */
  cacheExtraction(url, article) {
    if (this.extractionCache.size >= this.maxCacheSize) {
      // Remove oldest entry (FIFO)
      const firstKey = this.extractionCache.keys().next().value;
      this.extractionCache.delete(firstKey);
    }
    
    this.extractionCache.set(url, {
      article,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Get cached extraction (if fresh)
   */
  getCached(url, maxAge = 60000) { // 1 minute
    const cached = this.extractionCache.get(url);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) {
      this.extractionCache.delete(url);
      return null;
    }
    
    return cached.article;
  }
}
```

---

## 6. Security & Privacy

### 6.1 Content Security Policy

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### 6.2 Data Sanitization

**Always sanitize HTML before display:**

```javascript
import DOMPurify from 'dompurify';

function sanitizeHTML(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href'],
  });
}
```

### 6.3 API Key Storage

**Never expose API keys in code:**

```javascript
// ❌ BAD
const API_KEY = 'sk_1234567890abcdef';

// ✓ GOOD - User provides their own key
const { apiKey } = await chrome.storage.sync.get(['apiKey']);
```

### 6.4 Privacy Guarantees

**What we collect:**
- Nothing! All data stored locally
- Optional: Anonymous usage stats (if user opts in)

**What we DON'T collect:**
- URLs visited
- Article content
- Reading habits
- Personal information

**Data locations:**
- Extension: IndexedDB (local)
- IPFS: User's chosen provider
- No third-party analytics

### 6.5 Permissions Justification

| Permission | Justification |
|------------|---------------|
| `activeTab` | Extract article from current page |
| `storage` | Store settings and archive index |
| `scripting` | Inject content scripts |
| `host_permissions` | Access article HTML |

**No unnecessary permissions requested**

---

## 7. Testing Strategy

### 7.1 Unit Tests (Jest)

```javascript
// __tests__/quirks.test.js
import { QuirksProcessor } from '../src/quirks';

describe('QuirksProcessor', () => {
  let quirks;
  
  beforeEach(() => {
    quirks = new QuirksProcessor();
  });
  
  test('converts smart quotes to straight', () => {
    const input = 'He said "hello" and 'goodbye'';
    const output = quirks.baseQuirks(input);
    expect(output).toBe('He said "hello" and \'goodbye\'');
  });
  
  test('normalizes whitespace', () => {
    const input = 'Hello    world  \n\n  test';
    const output = quirks.baseQuirks(input);
    expect(output).toBe('Hello world test');
  });
  
  test('fixes punctuation spacing', () => {
    const input = 'Hello world . Next sentence';
    const output = quirks.baseQuirks(input);
    expect(output).toBe('Hello world. Next sentence');
  });
});

// __tests__/fingerprinter.test.js
describe('ArticleFingerprinter', () => {
  test('generates stable hashes', () => {
    const article1 = { content: 'Test article content', title: 'Test' };
    const article2 = { content: 'Test article content', title: 'Test' };
    
    const fp1 = fingerprinter.fingerprint(article1, 'http://test.com');
    const fp2 = fingerprinter.fingerprint(article2, 'http://test.com');
    
    expect(fp1.fingerprint.content_hash).toBe(fp2.fingerprint.content_hash);
  });
});
```

### 7.2 Integration Tests (Puppeteer)

```javascript
// __tests__/e2e/archive-flow.test.js
const puppeteer = require('puppeteer');

describe('Archive Flow E2E', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    page = await browser.newPage();
  });
  
  test('archives article from NYT', async () => {
    await page.goto('https://nytimes.com/article-example');
    
    // Wait for content script
    await page.waitForSelector('article');
    
    // Open extension popup
    const extensionId = await getExtensionId();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Click archive button
    await page.click('#archive-btn');
    
    // Wait for success message
    await page.waitForSelector('.success');
    
    const successText = await page.$eval('.success', el => el.textContent);
    expect(successText).toContain('Archived!');
  });
});
```

### 7.3 Test Coverage Goals

- **Unit tests:** 80%+ coverage
- **Integration tests:** Critical paths covered
- **Manual testing:** All browsers, all major news sites

### 7.4 Browser Testing Matrix

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 120+ | ✓ Primary |
| Edge | 120+ | ✓ Supported |
| Brave | Latest | ✓ Supported |
| Firefox | 115+ | 🔄 Planned v1.1 |
| Safari | N/A | ❌ Not possible (no Manifest V3) |

---

## 8. Deployment & Distribution

### 8.1 Build Pipeline

```bash
# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build
# Output: dist/ folder

# Package for Chrome Web Store
npm run package
# Output: news-archive-v1.0.0.zip
```

### 8.2 Chrome Web Store Submission

**Required Assets:**
- Icon: 128x128px PNG
- Promotional images: 1280x800px, 640x400px
- Screenshots: 1280x800px (3-5 images)
- Privacy policy URL
- Description (132 char + full)

**Listing Content:**

**Title:** News Archive - Preserve Articles Forever

**Short Description:**
Archive news articles to permanent, decentralized storage. One-click backup prevents censorship and link rot.

**Long Description:**
Never lose access to important journalism again. News Archive preserves articles using IPFS (InterPlanetary File System), creating permanent, censorship-resistant backups.

**Features:**
✓ One-click archiving to IPFS
✓ Permanent, decentralized storage
✓ Content fingerprinting for verification
✓ Automatic duplicate detection
✓ Citation generator (APA, MLA, Chicago)
✓ Track deleted articles
✓ Works on all major news sites
✓ Free and open source

**How It Works:**
1. Visit any news article
2. Click the extension icon
3. Article is extracted, fingerprinted, and uploaded to IPFS
4. Receive permanent link that works forever

**Privacy:**
All data stays on your device. No tracking, no analytics, no data collection.

**Requirements:**
Free Web3.Storage account (5GB free tier)

### 8.3 Release Schedule

**v1.0.0** (MVP) - Q2 2026
- Core extraction + fingerprinting
- Web3.Storage integration
- Basic UI
- Chrome only

**v1.1.0** - Q3 2026
- Firefox support
- Deletion monitoring
- Citation generator
- Export/import

**v1.2.0** - Q4 2026
- Auto-archiving
- Social sharing
- Advanced search
- Statistics dashboard

**v2.0.0** - 2027
- Local IPFS node support
- P2P distribution
- Collaborative archives
- Browser history integration

### 8.4 Monetization (Optional)

**Free Tier:**
- All core features
- User provides own API key
- Community support

**Premium ($2.99/month):**
- Managed IPFS hosting
- No API key needed
- Priority support
- 50GB storage

**Academic/Nonprofit ($0):**
- Free premium for researchers
- Free for journalists
- Grant-funded

---

## 9. Open Questions & Future Work

### 9.1 Technical Decisions

**Q:** Should we support multiple extractors for consensus?
**A:** Start with Readability only (proven, lightweight). Add consensus in v2.0.

**Q:** Local IPFS node vs API-only?
**A:** API-only for v1.0 (simpler UX). Local node optional in v2.0.

**Q:** Store full HTML or just text?
**A:** Text by default (smaller, faster). HTML optional setting.

**Q:** How to handle paywalled content?
**A:** Extract what's visible. Don't bypass paywalls (ethical/legal).

### 9.2 Feature Requests

- [ ] Browser history integration (archive as you read)
- [ ] Archive.org integration (cross-post to Wayback Machine)
- [ ] Reddit bot (auto-archive linked articles)
- [ ] Mobile app (iOS/Android)
- [ ] Decentralized search index (OrbitDB)
- [ ] Collaborative collections (shared reading lists)
- [ ] Version tracking (detect article edits)
- [ ] Image archival (inline images to IPFS)

### 9.3 Research Needed

- **Legal:** Copyright implications of archival
- **Ethical:** Publisher relationships, revenue impact
- **Technical:** IPFS performance at scale
- **UX:** Optimal onboarding flow
- **Economics:** Sustainable funding model

---

## 10. Success Metrics

### 10.1 KPIs (Key Performance Indicators)

**User Acquisition:**
- Downloads: 10K in first 3 months
- Active users: 5K MAU (Monthly Active Users)
- Retention: 40% 30-day retention

**Engagement:**
- Articles archived: 100K in first 3 months
- Archives per user: 20 median
- Archive success rate: >95%

**Quality:**
- Extraction accuracy: >90% (manual audit)
- Fingerprint stability: >99.9% (same content = same hash)
- Bug reports: <10 per 1K users

**Performance:**
- Page load impact: <100ms
- Memory usage: <50 MB
- Upload success rate: >98%

### 10.2 User Feedback Channels

- GitHub issues (bugs/features)
- Chrome Web Store reviews
- Email: support@newsarchive.org
- Twitter: @NewsArchiveExt
- Discord community (for power users)

---

## 11. Appendix

### 11.1 File Structure

```
news-archive-extension/
├── src/
│   ├── background.js          # Service worker
│   ├── content.js             # Content script
│   ├── popup.js               # Popup UI logic
│   ├── archive.js             # Archive browser logic
│   ├── settings.js            # Settings page logic
│   ├── onboarding.js          # First-run experience
│   ├── lib/
│   │   ├── quirks.js          # Text normalization
│   │   ├── extractor.js       # Article extraction
│   │   ├── fingerprinter.js   # Content fingerprinting
│   │   ├── ipfs-storage.js    # IPFS upload
│   │   ├── local-index.js     # IndexedDB wrapper
│   │   ├── citation.js        # Citation generator
│   │   └── utils.js           # Shared utilities
│   └── ui/
│       ├── popup.html
│       ├── archive.html
│       ├── settings.html
│       ├── onboarding.html
│       └── styles/
│           └── main.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── __tests__/
│   ├── unit/
│   └── e2e/
├── manifest.json
├── webpack.config.js
├── package.json
├── README.md
└── LICENSE
```

### 11.2 Dependencies

```json
{
  "dependencies": {
    "@mozilla/readability": "^0.4.4",
    "crypto-js": "^4.2.0",
    "web3.storage": "^4.5.5",
    "idb": "^7.1.1",
    "dompurify": "^3.0.6"
  },
  "devDependencies": {
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "babel-loader": "^9.1.3",
    "@babel/core": "^7.23.5",
    "@babel/preset-env": "^7.23.5",
    "terser-webpack-plugin": "^5.3.9",
    "jest": "^29.7.0",
    "puppeteer": "^21.6.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.1"
  }
}
```

### 11.3 API Documentation

**Web3.Storage API:**
- Docs: https://web3.storage/docs/
- Free tier: 5GB
- Signup: https://web3.storage/login/

**IPFS Gateways:**
- w3s.link (Web3.Storage's gateway)
- ipfs.io (Protocol Labs)
- cloudflare-ipfs.com (Cloudflare)
- dweb.link (Protocol Labs)

### 11.4 Resources

**Standards:**
- Manifest V3: https://developer.chrome.com/docs/extensions/mv3/
- IPFS specs: https://specs.ipfs.tech/
- Schema.org Article: https://schema.org/Article

**Libraries:**
- Readability.js: https://github.com/mozilla/readability
- js-ipfs: https://github.com/ipfs/js-ipfs
- Helia: https://github.com/ipfs/helia

**Inspiration:**
- Internet Archive: https://archive.org/
- Perma.cc: https://perma.cc/
- archive.today: https://archive.today/

---

## 12. Changelog

**v1.0.0 - Draft**
- Initial specification
- Core feature set defined
- Architecture finalized
- Ready for development

---

## 13. Contributors

**Specification Authors:**
- Patrick (Product/Engineering)
- Claude (Technical Architecture)

**License:** MIT

**Repository:** TBD

**Contact:** TBD

---

**END OF SPECIFICATION**

*This document is a living specification and will be updated as development progresses.*