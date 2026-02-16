"""
Article Fingerprinter Library

A production-ready library for extracting, normalizing, and fingerprinting
web article content with high reliability and consensus validation.
"""

from .quirks import QuirksProcessor
from .extractors import ArticleExtractor
from .metadata import MetadataExtractor
from .supermajority import SupermajorityExtractor
from .fingerprinter import ArticleFingerprinter
from .reports import ReportGenerator

__version__ = "1.0.0"
__all__ = [
    "QuirksProcessor",
    "ArticleExtractor", 
    "MetadataExtractor",
    "SupermajorityExtractor",
    "ArticleFingerprinter",
    "ReportGenerator",
]
