"""
Supermajority Voting Module

Democratic consensus extraction using sentence-level voting.
"""

import re
from typing import Dict, List, Tuple


class SupermajorityExtractor:
    """Supermajority voting for sentence extraction"""
    
    @staticmethod
    def extract_sentences(text: str) -> List[str]:
        """
        Split text into sentences
        
        Filters out very short sentences (< 20 chars) to avoid noise.
        """
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if len(s.strip()) > 20]
    
    @classmethod
    def extract(cls, texts: Dict[str, str], min_extractors: int = 3) -> Tuple[str, dict]:
        """
        Extract sentences that appear in at least min_extractors
        
        Args:
            texts: Dict mapping extractor name to extracted text
            min_extractors: Minimum number of extractors that must agree
        
        Returns:
            Tuple of (reconstructed_text, voting_stats)
            
        voting_stats includes:
            - total_unique_sentences
            - sentences_kept
            - by_vote_count: {4: [...], 3: [...], 2: [...], 1: [...]}
            - threshold
        """
        sentence_to_extractors = {}
        sentence_order = []
        
        # Use first extractor for ordering
        first_lib = list(texts.keys())[0]
        first_sentences = cls.extract_sentences(texts[first_lib])
        
        # Count votes
        for lib, text in texts.items():
            if not text or text.startswith("ERROR:"):
                continue
                
            sentences = cls.extract_sentences(text)
            for sentence in sentences:
                normalized = ' '.join(sentence.split())
                
                if normalized not in sentence_to_extractors:
                    sentence_to_extractors[normalized] = set()
                    if lib == first_lib:
                        sentence_order.append(normalized)
                
                sentence_to_extractors[normalized].add(lib)
        
        # Collect sentences by vote count
        stats = {
            'total_unique_sentences': len(sentence_to_extractors),
            'by_vote_count': {4: [], 3: [], 2: [], 1: []},
        }
        
        high_confidence = []
        for sentence in sentence_order:
            vote_count = len(sentence_to_extractors[sentence])
            if vote_count >= min_extractors:
                high_confidence.append(sentence)
            stats['by_vote_count'][vote_count].append(sentence[:80] + '...' if len(sentence) > 80 else sentence)
        
        # Add other high-confidence sentences
        for sentence, extractors in sentence_to_extractors.items():
            if len(extractors) >= min_extractors and sentence not in high_confidence:
                high_confidence.append(sentence)
        
        reconstructed = '. '.join(high_confidence)
        if reconstructed and not reconstructed.endswith('.'):
            reconstructed += '.'
        
        stats['sentences_kept'] = len(high_confidence)
        stats['threshold'] = min_extractors
        
        return reconstructed, stats
