/**
 * Background Service Worker
 *
 * Handles archiving orchestration, local index management,
 * and badge updates.
 */

import { generateFingerprint } from './lib/fingerprinter.js';
import { uploadToIPFS } from './lib/ipfs-storage.js';
import * as localIndex from './lib/local-index.js';

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.local.get('settings', (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: { web3StorageApiKey: '', autoArchive: false },
      });
    }
  });
});

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({
    id: 'archive-article',
    title: 'Archive this article',
    contexts: ['page'],
  });
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'archive-article' && tab?.id) {
    handleArchiveRequest(tab.id);
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'newsPageDetected') {
    // Update badge to show an article was detected
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.action.setBadgeText({ text: '!', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#2563eb', tabId });
    }
    return false;
  }

  if (message.type === 'archiveArticle') {
    handleArchive(message).then(sendResponse);
    return true; // async response
  }

  if (message.type === 'getRecentArchives') {
    localIndex.getAll({ limit: message.limit || 5 }).then(sendResponse);
    return true;
  }

  if (message.type === 'getStats') {
    localIndex.getStats().then(sendResponse);
    return true;
  }

  if (message.type === 'checkDuplicate') {
    localIndex.findByUrl(message.url).then((existing) => {
      sendResponse({ exists: !!existing, record: existing || null });
    });
    return true;
  }

  return false;
});

async function handleArchiveRequest(tabId) {
  chrome.tabs.sendMessage(tabId, { type: 'extractArticle' }, async (response) => {
    if (response?.article && response.valid) {
      const url = (await chrome.tabs.get(tabId)).url;
      const result = await handleArchive({ article: response.article, url });
      if (result.success) {
        chrome.action.setBadgeText({ text: '\u2713', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#16a34a', tabId });
      }
    }
  });
}

async function handleArchive({ article, url }) {
  try {
    // Check for duplicate
    const existing = await localIndex.findByUrl(url);
    if (existing) {
      return { success: true, duplicate: true, record: existing };
    }

    // Generate fingerprint
    const fingerprint = await generateFingerprint(article, url);

    // Check if content hash already exists
    const hashDup = await localIndex.findByHash(fingerprint.content_hash);
    if (hashDup) {
      return { success: true, duplicate: true, record: hashDup };
    }

    // Upload to IPFS
    let ipfsResult = null;
    const { settings } = await chrome.storage.local.get('settings');
    if (settings?.web3StorageApiKey) {
      ipfsResult = await uploadToIPFS(fingerprint, settings.web3StorageApiKey);
    }

    // Save to local index
    const record = {
      article_id: fingerprint.article_id,
      content_hash: fingerprint.content_hash,
      url,
      title: article.title || fingerprint.metadata?.title || '',
      word_count: fingerprint.word_count,
      char_count: fingerprint.char_count,
      cid: ipfsResult?.cid || null,
      gateway_url: ipfsResult?.gatewayUrl || null,
      metadata: fingerprint.metadata,
    };
    await localIndex.add(record);

    return { success: true, duplicate: false, record };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
