/**
 * Options / Settings Page Script
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const apiKeyInput = document.getElementById('api-key');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const testStatus = document.getElementById('test-status');
  const exportBtn = document.getElementById('export-btn');
  const clearBtn = document.getElementById('clear-btn');

  // Load existing key
  const { settings } = await chrome.storage.local.get('settings');
  if (settings?.web3StorageApiKey) {
    apiKeyInput.value = settings.web3StorageApiKey;
  }

  // Load stats
  loadStats();

  // Save API key
  saveBtn.addEventListener('click', async () => {
    const token = apiKeyInput.value.trim();
    const current = (await chrome.storage.local.get('settings')).settings || {};
    await chrome.storage.local.set({
      settings: { ...current, web3StorageApiKey: token },
    });

    if (token) {
      testStatus.textContent = 'Saved. Testing connection...';
      testStatus.className = 'test-status pending';
      const ok = await testApiKey(token);
      if (ok) {
        testStatus.textContent = 'Connected successfully';
        testStatus.className = 'test-status success';
      } else {
        testStatus.textContent = 'Saved, but connection test failed — check your token';
        testStatus.className = 'test-status fail';
      }
    } else {
      testStatus.textContent = '';
      testStatus.className = 'test-status';
      toast('API key cleared');
    }
  });

  // Test connection button
  testBtn.addEventListener('click', async () => {
    const token = apiKeyInput.value.trim();
    if (!token) {
      testStatus.textContent = 'Enter a token first';
      testStatus.className = 'test-status fail';
      return;
    }
    testStatus.textContent = 'Testing...';
    testStatus.className = 'test-status pending';
    const ok = await testApiKey(token);
    if (ok) {
      testStatus.textContent = 'Connection successful';
      testStatus.className = 'test-status success';
    } else {
      testStatus.textContent = 'Connection failed — token may be invalid or service unavailable';
      testStatus.className = 'test-status fail';
    }
  });

  // Export
  exportBtn.addEventListener('click', async () => {
    const archives = await chrome.runtime.sendMessage({ type: 'getRecentArchives', limit: 99999 });
    const blob = new Blob([JSON.stringify(archives, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `news-archive-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Export downloaded');
  });

  // Clear
  clearBtn.addEventListener('click', async () => {
    if (!confirm('Delete all locally stored archive data? This cannot be undone.')) return;
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name === 'news-archive') indexedDB.deleteDatabase(db.name);
    }
    toast('All data cleared');
    loadStats();
  });
}

/**
 * Test a Pinata JWT via the v3 API.
 */
async function testApiKey(token) {
  try {
    const resp = await fetch('https://api.pinata.cloud/v3/files?limit=1', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function loadStats() {
  const stats = await chrome.runtime.sendMessage({ type: 'getStats' });
  document.getElementById('stat-articles').textContent = stats?.totalArticles ?? 0;
  document.getElementById('stat-words').textContent = (stats?.totalWords ?? 0).toLocaleString();
  document.getElementById('stat-domains').textContent = stats?.uniqueDomains ?? 0;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}
