"""
Quirks Processing Module

Three-layer quirks normalization:
1. Base quirks: Universal formatting normalization
2. Extractor quirks: Per-extractor fixes
3. Site quirks: Site-specific content removal
"""

import re
from typing import Optional


class QuirksProcessor:
    """Three-layer quirks processing for article text normalization"""
    
    @staticmethod
    def base_quirks(text: str) -> str:
        """
        Layer 1: Base normalization (all extractors)
        
        Normalizes:
        - Whitespace collapse
        - Smart quotes → straight quotes
        - Em/en dashes → hyphens
        - Punctuation spacing
        - Non-breaking spaces
        """
        if not text:
            return ""
        
        # Collapse whitespace
        text = ' '.join(text.split())
        
        # Remove zero-width characters
        text = text.replace('\xa0', ' ').replace('\u200b', '')
        
        # Fix punctuation spacing
        text = re.sub(r'\s+([.,!?;:])', r'\1', text)  # "word ." → "word."
        text = re.sub(r'([.,!?;:])([A-Za-z])', r'\1 \2', text)  # "word.Next" → "word. Next"
        
        # Normalize quotes (smart → straight) - use Unicode codes to be explicit
        text = text.replace('\u201c', '"').replace('\u201d', '"')  # " and " → "
        text = text.replace('\u2018', "'").replace('\u2019', "'")  # ' and ' → '
        
        # Normalize dashes (em/en → hyphen)
        text = text.replace('\u2014', '-').replace('\u2013', '-')  # — and – → -
        
        # Standardize sentence spacing
        text = re.sub(r'\.([A-Z])', r'. \1', text)
        
        return ' '.join(text.split()).strip()
    
    @staticmethod
    def extractor_quirks(text: str, extractor: str) -> str:
        """
        Layer 2: Extractor-specific quirks
        
        Fixes idiosyncrasies of specific extractors:
        - newspaper: Remove date headers
        - readability: Fix quote spacing
        - goose: Remove photo credits
        """
        
        if extractor == 'newspaper':
            # Remove date headers at start
            text = re.sub(
                r'^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},\s+\d{4}.*?(?:ET|EST|PST|CST)\s*',
                '', text, flags=re.IGNORECASE
            )
            
        elif extractor == 'readability':
            # Aggressive quote spacing cleanup
            text = re.sub(r'"\s+', '"', text)
            text = re.sub(r'\s+"', '"', text)
            
        elif extractor == 'goose':
            # Remove photo credits
            text = re.sub(
                r'\(.*?(?:Getty Images|Reuters|AFP|AP|Bloomberg)\)',
                '', text, flags=re.IGNORECASE
            )
        
        return text.strip()
    
    @staticmethod
    def site_quirks(text: str, url: str) -> Optional[str]:
        """
        Layer 3: Site-specific quirks
        
        Removes known non-article content from specific sites.
        Returns None if content should be flagged (e.g., live blogs).
        """
        
        domain = url.lower()
        
        if 'foxnews.com' in domain:
            # Fox News UI elements
            text = re.sub(r'^NEW You can now listen to Fox News articles!?\s*', '', text, flags=re.IGNORECASE)
            text = re.sub(r'CLICK HERE TO (?:GET|DOWNLOAD) (?:THE )?FOX NEWS APP\s*', '', text, flags=re.IGNORECASE)
            text = re.sub(r"Fox News['\s]+[\w\s]+contributed to this report\.?\s*$", '', text, flags=re.IGNORECASE)
            text = re.sub(r'[\w\s]+ is a (?:reporter|correspondent|anchor) with Fox News Digital.*?$', '', text, flags=re.IGNORECASE)
            text = re.sub(r'Send tips to [\w.@]+,?\s*or on (?:X|Twitter):\s*@[\w_]+\.?\s*$', '', text, flags=re.IGNORECASE)
            
        elif 'cnn.com' in domain:
            # Flag live blogs
            if 'live-news' in url or 'live-updates' in url:
                return None  # Signal: this is a live blog
                
        return text.strip() if text else text
    
    def process_all_layers(self, text: str, extractor: str, url: str) -> Optional[str]:
        """Apply all three layers of quirks processing"""
        if not text or text.startswith("ERROR:"):
            return None
        
        text = self.base_quirks(text)
        text = self.extractor_quirks(text, extractor)
        text = self.site_quirks(text, url)
        
        return text
