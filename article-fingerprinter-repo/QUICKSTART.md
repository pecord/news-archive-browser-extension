# Quick Start Guide

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Make CLI executable
chmod +x fingerprint
```

## Usage

### 1. CLI - Generate Reports

```bash
# HTML report (default)
./fingerprint https://example.com/article

# Markdown report
./fingerprint https://example.com/article --output markdown

# JSON output
./fingerprint https://example.com/article --output json
```

### 2. Library - Python API

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
print(f"Word Count: {results['fingerprint']['word_count']} words")
```

### 3. Individual Components

```python
# Just normalize text
from article_fingerprinter import QuirksProcessor
quirks = QuirksProcessor()
clean_text = quirks.base_quirks(raw_text)

# Just extract metadata
from article_fingerprinter import MetadataExtractor
metadata = MetadataExtractor.extract_metadata(html, url)

# Just use supermajority voting
from article_fingerprinter import SupermajorityExtractor
consensus, stats = SupermajorityExtractor.extract(texts, min_extractors=3)
```

## Testing

```bash
# Run all tests
python test_suite.py

# Expected output: 17 tests, all passing ✓
```

## Examples

### Example 1: Basic Fingerprinting

```python
from article_fingerprinter import ArticleFingerprinter
import requests

url = "https://www.nytimes.com/2026/02/15/world/article.html"
html = requests.get(url).text

fingerprinter = ArticleFingerprinter()
results = fingerprinter.fingerprint(html, url)

# Check quality
if results['fingerprint']['confidence'] == 'very_high':
    print(f"High quality extraction: {results['fingerprint']['agreement_score']:.2%} agreement")
    print(f"Content: {results['supermajority_extraction']['text'][:200]}...")
```

### Example 2: Generate Report

```python
from article_fingerprinter import ArticleFingerprinter, ReportGenerator
import requests

html = requests.get(url).text
fingerprinter = ArticleFingerprinter()
results = fingerprinter.fingerprint(html, url)

# Generate HTML report
reporter = ReportGenerator()
html_report = reporter.generate_html(results)

# Save it
with open('report.html', 'w', encoding='utf-8') as f:
    f.write(html_report)
```

### Example 3: Content Deduplication

```python
from article_fingerprinter import ArticleFingerprinter
import requests

def get_article_hash(url):
    html = requests.get(url).text
    fingerprinter = ArticleFingerprinter()
    results = fingerprinter.fingerprint(html, url)
    return results['fingerprint']['content_hash']

# Compare two URLs
hash1 = get_article_hash("https://site1.com/article")
hash2 = get_article_hash("https://site2.com/article")

if hash1 == hash2:
    print("Same article!")
else:
    print("Different articles")
```

## Next Steps

- Read [README.md](README.md) for full documentation
- See [REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md) for architecture details
- Check out the test suite in `test_suite.py` for more examples
