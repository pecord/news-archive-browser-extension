"""
Article Extractors Module

Provides unified interface to multiple article extraction libraries.
"""

from typing import Dict
from newspaper import Article as NewspaperArticle
from readability import Document as ReadabilityDocument
from bs4 import BeautifulSoup
import trafilatura
from goose3 import Goose


class ArticleExtractor:
    """Extract article content using multiple extraction libraries"""
    
    @staticmethod
    def extract_newspaper(html: str, url: str) -> str:
        """Extract using Newspaper3k"""
        article = NewspaperArticle(url)
        article.download_state = 2
        article.html = html
        article.parse()
        return article.text or ""
    
    @staticmethod
    def extract_readability(html: str) -> str:
        """Extract using Python-Readability"""
        doc = ReadabilityDocument(html)
        content_html = doc.summary()
        soup = BeautifulSoup(content_html, 'lxml')
        return soup.get_text(separator=' ', strip=True)
    
    @staticmethod
    def extract_trafilatura(html: str) -> str:
        """Extract using Trafilatura"""
        return trafilatura.extract(
            html,
            include_comments=False,
            include_tables=True,
            no_fallback=False,
            favor_recall=True
        ) or ""
    
    @staticmethod
    def extract_goose(html: str) -> str:
        """Extract using Goose3"""
        g = Goose()
        article = g.extract(raw_html=html)
        return article.cleaned_text or ""
    
    @classmethod
    def extract_all(cls, html: str, url: str) -> Dict[str, str]:
        """
        Extract with all available extractors
        
        Returns:
            Dict mapping extractor name to extracted text
        """
        extractors = {
            'newspaper': cls.extract_newspaper,
            'readability': cls.extract_readability,
            'trafilatura': cls.extract_trafilatura,
            'goose': cls.extract_goose,
        }
        
        results = {}
        for name, extractor_func in extractors.items():
            try:
                if name == 'newspaper':
                    text = extractor_func(html, url)
                else:
                    text = extractor_func(html)
                results[name] = text
            except Exception as e:
                results[name] = f"ERROR: {str(e)}"
        
        return results
