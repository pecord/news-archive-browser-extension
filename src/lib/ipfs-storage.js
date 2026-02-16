/**
 * IPFS Storage Module
 *
 * Handles uploading archived articles to IPFS via Web3.Storage.
 */

import { Web3Storage } from 'web3.storage';

/**
 * Upload an archived article manifest to IPFS.
 *
 * @param {object} article - Article data including fingerprint and metadata
 * @param {string} apiKey - Web3.Storage API token
 * @returns {Promise<object>} Upload result with CID and gateway URL
 */
export async function uploadToIPFS(article, apiKey) {
  const client = new Web3Storage({ token: apiKey });

  const manifest = {
    version: '1.0',
    schema: 'news-archive-article',
    fingerprint: {
      article_id: article.article_id,
      content_hash: article.content_hash,
      word_count: article.word_count,
      char_count: article.char_count,
    },
    metadata: {
      title: article.metadata?.title || '',
      url: article.metadata?.url || '',
      canonical_url: article.metadata?.canonical_url || '',
      authors: article.metadata?.authors || [],
      publish_date: article.metadata?.publish_date || '',
      archived_at: new Date().toISOString(),
    },
    content: {
      text: article.processed_text || '',
    },
  };

  const blob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json',
  });
  const file = new File([blob], `${article.article_id}.json`);
  const cid = await client.put([file], {
    name: `news-archive-${article.article_id}`,
    wrapWithDirectory: false,
  });

  return {
    cid,
    gatewayUrl: `https://w3s.link/ipfs/${cid}`,
    size: blob.size,
  };
}

/**
 * Verify an upload by fetching from a gateway and comparing hashes.
 *
 * @param {string} cid - The IPFS CID to verify
 * @param {string} expectedHash - Expected content hash
 * @returns {Promise<boolean>}
 */
export async function verifyUpload(cid, expectedHash) {
  try {
    const response = await fetch(`https://w3s.link/ipfs/${cid}`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.fingerprint?.content_hash === expectedHash;
  } catch {
    return false;
  }
}

/**
 * Get multiple gateway URLs for a CID.
 */
export function getGatewayUrls(cid) {
  return [
    `https://w3s.link/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`,
  ];
}
