# Article Fingerprinter Library

A production-ready Python library for extracting, normalizing, and fingerprinting web article content with high reliability and consensus validation.

## Features

✅ **Multi-Extractor Consensus** - Uses 4 extraction libraries (Newspaper3k, Readability, Trafilatura, Goose3)  
✅ **Three-Layer Quirks Normalization** - Base → Extractor → Site-specific cleaning  
✅ **Supermajority Voting** - Democratic sentence-level consensus (3/4 threshold)  
✅ **Stable Fingerprints** - Content hashing with metadata-based article IDs  
✅ **Comprehensive Reports** - HTML and Markdown output with full analysis  
✅ **99%+ Consensus** - Achieves very high agreement on well-structured articles  

## Installation

```bash
pip install newspaper3k readability-lxml trafilatura goose3 beautifulsoup4 lxml requests
```

## Quick Start

### As a Library

```python
from article_fingerprinter import ArticleFingerprinter
import requests

# Fetch article
response = requests.get('https://example.com/article')
html = response.text

# Fingerprint it
fingerprinter = ArticleFingerprinter()
results = fingerprinter.fingerprint(html, 'https://example.com/article')

# Access results
print(f"Article ID: {results['fingerprint']['article_id']}")
print(f"Content Hash: {results['fingerprint']['content_hash']}")
print(f"Confidence: {results['fingerprint']['confidence']}")
print(f"Agreement: {results['fingerprint']['agreement_score']:.2%}")
```

### As a CLI Tool

```bash
# Generate HTML report
python fingerprint https://example.com/article

# Generate markdown report
python fingerprint https://example.com/article --output markdown

# Get JSON output
python fingerprint https://example.com/article --output json
```

## Architecture

### Core Modules

**`quirks.py`** - Three-layer text normalization
- Base quirks: Smart quotes → straight, whitespace collapse, punctuation spacing
- Extractor quirks: Per-extractor idiosyncrasies (date headers, photo credits)
- Site quirks: Known UI elements (Fox News CTAs, CNN live blog detection)

**`extractors.py`** - Multi-library extraction
- Newspaper3k, Readability, Trafilatura, Goose3
- Unified interface with error handling

**`metadata.py`** - Structured metadata extraction
- Schema.org JSON-LD
- Open Graph tags
- Canonical URLs and dates

**`supermajority.py`** - Democratic consensus
- Sentence-level voting
- 3/4 threshold (configurable)
- Filters extractor-specific junk

**`fingerprinter.py`** - Main orchestration
- Coordinates all modules
- Consensus scoring
- Confidence determination

**`reports.py`** - Report generation
- HTML with embedded CSS
- Markdown for portability
- Shows extraction analysis

## Example Results

### High-Quality Site (Gizmodo)
```
Confidence: VERY_HIGH
Agreement: 99.63%
Word Count: 339 words
Unique Hashes: 3/4
Identical Pairs: 2 extractors (newspaper + goose)
```

### Lower-Quality Site (Fox News)
```
Confidence: HIGH  
Agreement: 81.58%
Word Count: 364 words
Site Quirks Applied: UI removal, CTA filtering
```

## Fingerprint Structure

```python
{
    'fingerprint': {
        'article_id': 'a9a2ee5f32b815db',  # Stable identifier
        'content_hash': '62c996214...',     # Content fingerprint
        'confidence': 'very_high',
        'agreement_score': 0.9963,
        'word_count': 339
    },
    'metadata': {
        'title': 'Article Title',
        'authors': ['Author Name'],
        'publish_date': '2026-02-15T10:00:31+00:00',
        'canonical_url': '...'
    },
    'extraction_stats': {
        'extractors_successful': 4,
        'unique_hashes_after_quirks': 3,
        'hash_groups': [['newspaper', 'goose'], ['readability'], ['trafilatura']]
    }
}
```

## Testing

```bash
# Run test suite
python test_suite.py

# Results: 17 tests, all passing
# - Quirks processing: 9 tests
# - Supermajority: 2 tests  
# - Encoding: 2 tests
# - Fingerprinting: 2 tests
# - Regression: 2 tests
```

## Use Cases

- **Content Deduplication** - Same article_id + content_hash = duplicate
- **Change Detection** - Hash changes = content modified
- **Citation Systems** - Stable identifiers for academic/legal references
- **Archival** - High-quality extraction with provenance
- **News Monitoring** - Track article versions over time

## Performance

- Processing time: ~300ms per article (4 extractors + quirks + supermajority)
- Memory efficient: Sentence-level processing
- Network: Single HTTP request

## License

MIT License - See LICENSE file

## Version

1.0.0 - Production Release
