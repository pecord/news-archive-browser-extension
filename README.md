# News Archive Browser Extension

A Chrome extension that archives news articles to IPFS (decentralized, permanent storage) with one click. News sites are increasingly blocking the Internet Archive — this tool helps preserve the historical record.

## How It Works

1. Navigate to a news article
2. Click the extension icon
3. Article is extracted, fingerprinted, and uploaded to IPFS
4. You get a permanent, decentralized link

The extension uses [Readability.js](https://github.com/mozilla/readability) for article extraction, SHA-256 content fingerprinting (via SubtleCrypto), and [Pinata](https://web3.storage) for IPFS uploads. All archived articles are also stored locally in IndexedDB.

## Development

```bash
npm install
npm test          # 30 tests (quirks + fingerprinter)
npm run build     # produces dist/
npm run dev       # webpack watch mode
```

## Load in Chrome

1. `npm run build`
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right)
4. Click **Load unpacked** → select the `dist/` folder
5. Navigate to a news article — the extension badge shows `!`
6. Click the popup → **Archive to IPFS**

## IPFS Upload

To upload to IPFS, you need a [Pinata](https://pinata.cloud) API key (free tier available). Without one, articles are still fingerprinted and saved locally. Configure your JWT token in the extension's Settings page.

## Project Structure

```
src/
  lib/
    quirks.js         # 3-layer text normalization (base → extractor → site)
    extractor.js      # Readability.js article extraction
    fingerprinter.js  # SHA-256 content hashing + metadata extraction
    ipfs-storage.js   # Pinata IPFS upload
    local-index.js    # IndexedDB local archive
  background.js       # Service worker — archive orchestration
  content.js          # Article detection + extraction
  popup.js            # Popup UI
  ui/
    popup.html
    popup.css
__tests__/
  quirks.test.js
  fingerprinter.test.js
```

## Origin

The core fingerprinting logic is ported from the Python [article_fingerprinter](article-fingerprinter-repo/) library.
