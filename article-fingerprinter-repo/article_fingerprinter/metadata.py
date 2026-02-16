"""
Metadata Extraction Module

Extracts structured metadata from HTML documents including:
- Schema.org JSON-LD
- Open Graph tags
- Canonical URLs
- Publication dates
"""

import json
from typing import Dict
from bs4 import BeautifulSoup


class MetadataExtractor:
    """Extract article metadata from HTML"""
    
    @staticmethod
    def extract_metadata(html: str, url: str) -> Dict:
        """
        Extract comprehensive metadata from HTML
        
        Returns:
            Dictionary with metadata fields:
            - url, canonical_url
            - title, authors[]
            - publish_date, modified_date
            - has_schema_org, has_opengraph, has_canonical
        """
        soup = BeautifulSoup(html, 'lxml')
        metadata = {
            'url': url,
            'canonical_url': url,
            'title': None,
            'authors': [],
            'publish_date': None,
            'modified_date': None,
            'has_schema_org': False,
            'has_opengraph': False,
            'has_canonical': False,
        }
        
        # Schema.org JSON-LD
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string)
                if isinstance(data, dict) and 'Article' in str(data.get('@type', '')):
                    metadata['has_schema_org'] = True
                    metadata['title'] = metadata['title'] or data.get('headline')
                    metadata['publish_date'] = metadata['publish_date'] or data.get('datePublished')
                    metadata['modified_date'] = metadata['modified_date'] or data.get('dateModified')
                    
                    # Authors
                    author = data.get('author')
                    if isinstance(author, dict):
                        metadata['authors'].append(author.get('name'))
                    elif isinstance(author, list):
                        metadata['authors'].extend([a.get('name') for a in author if isinstance(a, dict)])
            except:
                continue
        
        # Open Graph
        og_title = soup.find('meta', property='og:title')
        if og_title:
            metadata['has_opengraph'] = True
            metadata['title'] = metadata['title'] or og_title.get('content')
        
        og_pub = soup.find('meta', property='article:published_time')
        if og_pub:
            metadata['publish_date'] = metadata['publish_date'] or og_pub.get('content')
        
        og_mod = soup.find('meta', property='article:modified_time')
        if og_mod:
            metadata['modified_date'] = metadata['modified_date'] or og_mod.get('content')
        
        # Canonical
        canonical = soup.find('link', rel='canonical')
        if canonical:
            metadata['has_canonical'] = True
            metadata['canonical_url'] = canonical.get('href', url)
        
        # Fallback title
        if not metadata['title']:
            title_tag = soup.find('title')
            metadata['title'] = title_tag.get_text() if title_tag else 'Unknown'
        
        return metadata
