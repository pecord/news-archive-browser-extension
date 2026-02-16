/**
 * Options / Settings Page Script
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const apiKeyInput = document.getElementById('api-key');
  const saveBtn = document.getElementById('save-btn');
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
    const current = (await chrome.storage.local.get('settings')).settings || {};
    await chrome.storage.local.set({
      settings: { ...current, web3StorageApiKey: apiKeyInput.value.trim() },
    });
    toast('Settings saved');
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
    // Clear IndexedDB by deleting the database
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name === 'news-archive') indexedDB.deleteDatabase(db.name);
    }
    toast('All data cleared');
    loadStats();
  });
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
