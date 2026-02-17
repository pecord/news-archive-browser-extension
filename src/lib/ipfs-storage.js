/**
 * IPFS Storage Module
 *
 * Handles uploading archived articles to IPFS via Pinata v3 API.
 * https://docs.pinata.cloud/files/uploading-files
 */

const PINATA_UPLOAD_API = 'https://uploads.pinata.cloud/v3';
const PINATA_API = 'https://api.pinata.cloud/v3';

/**
 * Upload an archived article manifest to IPFS via Pinata v3.
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

  // v3 API uses multipart/form-data with a File object
  const json = JSON.stringify(manifest, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const file = new File([blob], `${fp.article_id}.json`, { type: 'application/json' });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('network', 'public');
  formData.append('name', `news-archive-${fp.article_id}`);

  const resp = await fetch(`${PINATA_UPLOAD_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Pinata upload failed (${resp.status}): ${body}`);
  }

  const data = await resp.json();
  const cid = data.data?.cid;

  return {
    cid,
    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
    size: data.data?.size || blob.size,
  };
}

/**
 * Test a Pinata JWT by listing files (lightweight v3 call).
 * @param {string} jwt - Pinata JWT token
 * @returns {Promise<boolean>}
 */
export async function testConnection(jwt) {
  try {
    const resp = await fetch(`${PINATA_API}/files?limit=1`, {
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
