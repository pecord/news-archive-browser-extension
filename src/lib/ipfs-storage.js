/**
 * IPFS Storage Module
 *
 * Handles uploading archived articles to IPFS via Pinata.
 * https://docs.pinata.cloud/api-reference
 */

const PINATA_API = 'https://api.pinata.cloud';

/**
 * Upload an archived article manifest to IPFS via Pinata.
 *
 * @param {object} article - Article data including fingerprint and metadata
 * @param {string} jwt - Pinata JWT token
 * @returns {Promise<object>} Upload result with CID and gateway URL
 */
export async function uploadToIPFS(article, jwt) {
  const fp = article.article_id ? article : article.fingerprint || {};
  const meta = article.metadata || {};

  const manifest = {
    version: '1.0',
    schema: 'news-archive-article',
    fingerprint: {
      article_id: fp.article_id,
      content_hash: fp.content_hash,
      extraction_method: fp.extraction_method || 'readability_with_quirks',
      word_count: fp.word_count,
      char_count: fp.char_count,
    },
    metadata: {
      title: meta.title || '',
      url: meta.url || '',
      canonical_url: meta.canonical_url || '',
      authors: meta.authors || [],
      publish_date: meta.publish_date || '',
      modified_date: meta.modified_date || '',
      archived_at: new Date().toISOString(),
    },
    content: {
      text: article.processed_text || '',
    },
  };

  const resp = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: manifest,
      pinataMetadata: {
        name: `news-archive-${fp.article_id}`,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Pinata upload failed (${resp.status}): ${body}`);
  }

  const data = await resp.json();
  const cid = data.IpfsHash;

  return {
    cid,
    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
    size: data.PinSize || 0,
  };
}

/**
 * Test a Pinata JWT by hitting the auth test endpoint.
 * @param {string} jwt - Pinata JWT token
 * @returns {Promise<boolean>}
 */
export async function testConnection(jwt) {
  try {
    const resp = await fetch(`${PINATA_API}/data/testAuthentication`, {
      headers: { Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(8000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Verify an upload by fetching from a gateway and comparing hashes.
 */
export async function verifyUpload(cid, expectedHash) {
  try {
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`, {
      signal: AbortSignal.timeout(10000),
    });
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
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://ipfs.io/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`,
    `https://dweb.link/ipfs/${cid}`,
  ];
}
