# Repository Contents

## 📦 Files

```
article-fingerprinter/
├── LICENSE                      - MIT License
├── README.md                    - Full documentation
├── QUICKSTART.md                - Quick start guide
├── REFACTORING_SUMMARY.md       - Architecture details
├── requirements.txt             - Python dependencies
├── .gitignore                   - Git ignore file
│
├── article_fingerprinter/       - Core library
│   ├── __init__.py             - Public API
│   ├── quirks.py               - 3-layer normalization
│   ├── extractors.py           - Multi-extractor interface
│   ├── metadata.py             - Metadata extraction
│   ├── supermajority.py        - Democratic voting
│   ├── fingerprinter.py        - Main orchestration
│   └── reports.py              - HTML/Markdown generation
│
├── fingerprint                  - CLI script (executable)
└── test_suite.py               - Comprehensive tests (17 tests)
```

## 🚀 Getting Started

1. **Extract the zip**
   ```bash
   unzip article-fingerprinter.zip
   cd article-fingerprinter-repo/
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run tests**
   ```bash
   python test_suite.py
   # Should see: 17 tests, all passing ✓
   ```

4. **Try it out**
   ```bash
   # CLI usage
   python fingerprint https://example.com/article
   
   # Or as library
   python
   >>> from article_fingerprinter import ArticleFingerprinter
   >>> # See QUICKSTART.md for examples
   ```

## 📚 Documentation

- **QUICKSTART.md** - Get up and running in 5 minutes
- **README.md** - Complete documentation with examples
- **REFACTORING_SUMMARY.md** - Architecture and design decisions

## ✅ What's Included

- ✅ Production-ready library
- ✅ 17 comprehensive tests (all passing)
- ✅ HTML and Markdown report generation
- ✅ CLI tool for quick fingerprinting
- ✅ Full documentation
- ✅ MIT License (use freely!)

## 🎯 Key Features

- **Multi-Extractor Consensus** (4 extractors)
- **3-Layer Quirks Normalization**
- **Supermajority Voting** (democratic consensus)
- **Stable Content Fingerprints**
- **99%+ Agreement** on quality articles

## 📊 Stats

- **Lines of code:** ~1,300
- **Modules:** 6 core modules
- **Tests:** 17 (100% pass rate)
- **Dependencies:** 7 packages
- **License:** MIT

## 🔧 Module Overview

**quirks.py** (125 lines)
- Base quirks: Smart quotes, whitespace, punctuation
- Extractor quirks: Per-extractor fixes
- Site quirks: Known UI element removal

**extractors.py** (76 lines)
- Newspaper3k, Readability, Trafilatura, Goose3
- Unified interface with error handling

**metadata.py** (94 lines)
- Schema.org JSON-LD
- Open Graph tags
- Canonical URLs

**supermajority.py** (99 lines)
- Sentence-level voting
- 3/4 threshold consensus
- Filters extractor-specific junk

**fingerprinter.py** (158 lines)
- Orchestrates all modules
- Consensus scoring
- Confidence determination

**reports.py** (217 lines)
- HTML with embedded CSS
- Markdown for portability
- Complete extraction analysis

## 💡 Use Cases

- Content deduplication
- Change detection
- Citation systems
- News archival
- Article monitoring

Enjoy! 🎉
