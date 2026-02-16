/**
 * Popup Script
 *
 * Manages the extension popup UI — shows article info, triggers archiving,
 * displays results and recent archives.
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const statusEl = document.getElementById('status');
  const articleCard = document.getElementById('article-card');
  const articleTitle = document.getElementById('article-title');
  const articleDomain = document.getElementById('article-domain');
  const articleWords = document.getElementById('article-words');
  const archiveBtn = document.getElementById('archive-btn');
  const resultSection = document.getElementById('result');
  const resultLink = document.getElementById('result-link');
  const copyBtn = document.getElementById('copy-link');
  const errorSection = document.getElementById('error');
  const errorMsg = document.getElementById('error-msg');
  const retryBtn = document.getElementById('retry-btn');
  const recentList = document.getElementById('recent-list');
  const spinner = document.getElementById('spinner');

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    showStatus('No active tab');
    return;
  }

  // Check if page has an article
  let isArticle = false;
  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'checkIfArticle' });
    isArticle = resp?.isArticle;
  } catch {
    isArticle = false;
  }

  // Check if already archived
  const dupResp = await chrome.runtime.sendMessage({ type: 'checkDuplicate', url: tab.url });
  if (dupResp?.exists) {
    showAlreadyArchived(dupResp.record);
  } else if (isArticle) {
    showArticleDetected(tab);
  } else {
    showStatus('No article detected on this page.');
  }

  // Load recent archives
  loadRecent();

  // --- Event handlers ---

  archiveBtn.addEventListener('click', () => doArchive(tab));
  retryBtn.addEventListener('click', () => doArchive(tab));
  copyBtn.addEventListener('click', () => {
    const link = resultLink.href;
    navigator.clipboard.writeText(link).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1500);
    });
  });

  // --- UI helpers ---

  function showStatus(msg) {
    statusEl.textContent = msg;
    statusEl.classList.remove('hidden');
    articleCard.classList.add('hidden');
  }

  function showArticleDetected(tab) {
    statusEl.classList.add('hidden');
    articleCard.classList.remove('hidden');
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');

    articleTitle.textContent = tab.title || 'Untitled';
    try {
      articleDomain.textContent = new URL(tab.url).hostname;
    } catch {
      articleDomain.textContent = '';
    }
    articleWords.textContent = '';
    archiveBtn.classList.remove('hidden');
  }

  function showAlreadyArchived(record) {
    statusEl.classList.add('hidden');
    articleCard.classList.remove('hidden');
    archiveBtn.classList.add('hidden');
    resultSection.classList.remove('hidden');
    errorSection.classList.add('hidden');

    articleTitle.textContent = record.title || 'Archived Article';
    try {
      articleDomain.textContent = new URL(record.url).hostname;
    } catch {
      articleDomain.textContent = '';
    }
    articleWords.textContent = `${record.word_count || '?'} words`;

    if (record.gateway_url) {
      resultLink.href = record.gateway_url;
      resultLink.textContent = record.gateway_url;
    } else {
      resultLink.href = '#';
      resultLink.textContent = 'Archived locally (no IPFS key set)';
    }
    document.getElementById('result-label').textContent =
      `Archived on ${new Date(record.archived_at).toLocaleDateString()}`;
  }

  async function doArchive(tab) {
    archiveBtn.classList.add('hidden');
    spinner.classList.remove('hidden');
    errorSection.classList.add('hidden');
    resultSection.classList.add('hidden');

    try {
      // Extract article via content script
      const extraction = await chrome.tabs.sendMessage(tab.id, { type: 'extractArticle' });
      if (!extraction?.article || !extraction.valid) {
        throw new Error('Could not extract article content.');
      }

      articleWords.textContent = `${extraction.article.content.split(/\s+/).length} words`;

      // Send to background for archiving
      const result = await chrome.runtime.sendMessage({
        type: 'archiveArticle',
        article: extraction.article,
        url: tab.url,
      });

      spinner.classList.add('hidden');

      if (result?.success) {
        resultSection.classList.remove('hidden');
        document.getElementById('result-label').textContent = 'Archived successfully!';
        if (result.record?.gateway_url) {
          resultLink.href = result.record.gateway_url;
          resultLink.textContent = result.record.gateway_url;
        } else {
          resultLink.href = '#';
          resultLink.textContent = 'Saved locally (set IPFS API key in settings for permanent link)';
        }
        loadRecent();
      } else {
        throw new Error(result?.error || 'Archive failed');
      }
    } catch (err) {
      spinner.classList.add('hidden');
      archiveBtn.classList.remove('hidden');
      errorSection.classList.remove('hidden');
      errorMsg.textContent = err.message;
    }
  }

  async function loadRecent() {
    const archives = await chrome.runtime.sendMessage({ type: 'getRecentArchives', limit: 5 });
    recentList.innerHTML = '';
    if (!archives || archives.length === 0) {
      recentList.innerHTML = '<li class="empty">No archives yet</li>';
      return;
    }
    for (const a of archives) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = a.gateway_url || a.url;
      link.target = '_blank';
      link.textContent = a.title || a.url;
      const date = document.createElement('span');
      date.className = 'date';
      date.textContent = new Date(a.archived_at).toLocaleDateString();
      li.appendChild(link);
      li.appendChild(date);
      recentList.appendChild(li);
    }
  }
}
