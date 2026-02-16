"""
Article Fingerprinter Module

Main fingerprinting orchestration with consensus validation.
"""

import hashlib
from datetime import datetime
from typing import Dict
from difflib import SequenceMatcher

from .quirks import QuirksProcessor
from .extractors import ArticleExtractor
from .metadata import MetadataExtractor
from .supermajority import SupermajorityExtractor


class ArticleFingerprinter:
    """
    Main article fingerprinting class
    
    Orchestrates the complete pipeline:
    1. Extract with multiple extractors
    2. Apply three-layer quirks normalization
    3. Calculate consensus scores
    4. Generate supermajority extraction
    5. Create stable fingerprints
    """
    
    def __init__(self):
        self.quirks = QuirksProcessor()
        self.extractor = ArticleExtractor()
        self.metadata_extractor = MetadataExtractor()
        self.supermajority = SupermajorityExtractor()
    
    def fingerprint(self, html: str, url: str) -> Dict:
        """
        Complete fingerprinting pipeline
        
        Args:
            html: Raw HTML content
            url: Article URL
            
        Returns:
            Comprehensive results dictionary with:
            - fingerprint: article_id, content_hash, confidence, etc.
            - metadata: title, authors, dates, etc.
            - extraction_stats: extractor performance
            - individual_extractions: per-extractor results
            - pairwise_similarities: consensus analysis
            - voting_stats: supermajority breakdown
            - supermajority_extraction: final consensus text
        """
        start_time = datetime.now()
        
        # Extract metadata
        metadata = self.metadata_extractor.extract_metadata(html, url)
        
        # Extract with all extractors (raw)
        raw_extractions = self.extractor.extract_all(html, url)
        
        # Process with quirks
        processed = {}
        for extractor, raw_text in raw_extractions.items():
            result = self.quirks.process_all_layers(raw_text, extractor, url)
            if result:
                processed[extractor] = result
        
        # Calculate stats after quirks
        hashes_after_quirks = {
            lib: hashlib.sha256(text.encode()).hexdigest()
            for lib, text in processed.items()
        }
        unique_hashes = len(set(hashes_after_quirks.values()))
        
        # Group by hash
        hash_groups = {}
        for lib, hash_val in hashes_after_quirks.items():
            if hash_val not in hash_groups:
                hash_groups[hash_val] = []
            hash_groups[hash_val].append(lib)
        
        # Supermajority extraction
        optimal_threshold = 3 if len(processed) >= 3 else 2
        supermaj_text, voting_stats = self.supermajority.extract(processed, optimal_threshold)
        supermaj_hash = hashlib.sha256(supermaj_text.encode()).hexdigest()
        
        # Calculate consensus scores
        similarities = []
        for i, (lib1, text1) in enumerate(processed.items()):
            for lib2, text2 in list(processed.items())[i+1:]:
                sim = SequenceMatcher(None, text1, text2).ratio()
                similarities.append({
                    'lib1': lib1,
                    'lib2': lib2,
                    'similarity': sim,
                    'wc1': len(text1.split()),
                    'wc2': len(text2.split()),
                })
        
        avg_similarity = sum(s['similarity'] for s in similarities) / len(similarities) if similarities else 0
        
        # Determine confidence
        if avg_similarity > 0.95:
            confidence = "very_high"
        elif avg_similarity > 0.90:
            confidence = "high"
        elif avg_similarity > 0.80:
            confidence = "medium"
        else:
            confidence = "low"
        
        # Build article_id
        article_id_source = f"{metadata['canonical_url']}|{metadata['publish_date']}|{metadata['title']}"
        article_id = hashlib.sha256(article_id_source.encode()).hexdigest()[:16]
        
        # Compile results
        results = {
            'fingerprint': {
                'article_id': article_id,
                'content_hash': supermaj_hash,
                'extraction_method': f'supermajority_{optimal_threshold}_of_{len(processed)}_with_quirks',
                'confidence': confidence,
                'agreement_score': avg_similarity,
                'word_count': len(supermaj_text.split()),
            },
            'metadata': metadata,
            'extraction_stats': {
                'extractors_attempted': len(raw_extractions),
                'extractors_successful': len(processed),
                'unique_hashes_after_quirks': unique_hashes,
                'hash_groups': [[lib for lib in group] for group in hash_groups.values()],
                'supermajority_threshold': f'{optimal_threshold}/{len(processed)}',
            },
            'individual_extractions': {
                lib: {
                    'raw_word_count': len(raw_extractions[lib].split()) if lib in raw_extractions and not raw_extractions[lib].startswith("ERROR:") else 0,
                    'processed_word_count': len(text.split()),
                    'hash': hashes_after_quirks[lib],
                    'preview': text[:200] + '...' if len(text) > 200 else text,
                }
                for lib, text in processed.items()
            },
            'pairwise_similarities': similarities,
            'voting_stats': voting_stats,
            'supermajority_extraction': {
                'word_count': len(supermaj_text.split()),
                'hash': supermaj_hash,
                'text': supermaj_text,
            },
            'processing_time_ms': (datetime.now() - start_time).total_seconds() * 1000,
            'extracted_at': datetime.now().isoformat(),
        }
        
        return results
