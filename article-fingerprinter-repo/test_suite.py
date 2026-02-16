#!/usr/bin/env python3
"""
Test Suite for Article Fingerprinter Library

Comprehensive tests for all modules.
"""

import unittest
import hashlib
import tempfile
import os

# Import from library
from article_fingerprinter import (
    QuirksProcessor,
    ArticleExtractor,
    SupermajorityExtractor,
    ArticleFingerprinter,
    ReportGenerator,
    MetadataExtractor
)


class TestQuirksProcessor(unittest.TestCase):
    """Test the three-layer quirks processing"""
    
    def setUp(self):
        self.quirks = QuirksProcessor()
    
    def test_base_quirks_punctuation_spacing(self):
        """Test punctuation spacing normalization"""
        text = "Hello world . This is a test ."
        result = self.quirks.base_quirks(text)
        self.assertEqual(result, "Hello world. This is a test.")
    
    def test_base_quirks_smart_quotes_to_straight(self):
        """Test smart quotes are converted to straight quotes"""
        text = "He said \u201chello\u201d and \u2018goodbye\u2019"
        result = self.quirks.base_quirks(text)
        self.assertEqual(result, 'He said "hello" and \'goodbye\'')
        
        # Verify no smart quotes remain
        self.assertNotIn('\u201c', result)
        self.assertNotIn('\u201d', result)
        self.assertNotIn('\u2018', result)
        self.assertNotIn('\u2019', result)
    
    def test_base_quirks_dashes(self):
        """Test em and en dashes converted to hyphens"""
        text = "Test\u2014em dash and\u2013en dash"
        result = self.quirks.base_quirks(text)
        self.assertEqual(result, "Test-em dash and-en dash")
        
        # Verify no fancy dashes remain
        self.assertNotIn('\u2014', result)
        self.assertNotIn('\u2013', result)
    
    def test_base_quirks_whitespace_collapse(self):
        """Test excessive whitespace is collapsed"""
        text = "Hello    world  \n\n  test"
        result = self.quirks.base_quirks(text)
        self.assertEqual(result, "Hello world test")
    
    def test_base_quirks_nbsp_removal(self):
        """Test non-breaking spaces are removed"""
        text = "Hello\xa0world"
        result = self.quirks.base_quirks(text)
        self.assertEqual(result, "Hello world")
    
    def test_extractor_quirks_newspaper_date_removal(self):
        """Test newspaper extractor removes date headers"""
        text = "Feb. 15, 2026 Updated Feb. 15, 2026, 4:00 a.m. ET MUNICH, Germany..."
        result = self.quirks.extractor_quirks(text, 'newspaper')
        self.assertIn("MUNICH", result)
        self.assertNotIn("Feb. 15", result)
    
    def test_extractor_quirks_readability_quote_spacing(self):
        """Test readability extractor fixes quote spacing"""
        text = 'He said " hello " to me'
        result = self.quirks.extractor_quirks(text, 'readability')
        self.assertEqual(result, 'He said"hello"to me')
    
    def test_site_quirks_fox_news(self):
        """Test Fox News UI element removal"""
        text = "NEW You can now listen to Fox News articles! The article begins here. CLICK HERE TO DOWNLOAD THE FOX NEWS APP More content."
        result = self.quirks.site_quirks(text, "https://www.foxnews.com/article")
        self.assertNotIn("NEW You can", result)
        self.assertNotIn("CLICK HERE", result)
        self.assertIn("The article begins here", result)
    
    def test_site_quirks_cnn_live_blog_flag(self):
        """Test CNN live blogs are flagged"""
        text = "Live blog content"
        result = self.quirks.site_quirks(text, "https://www.cnn.com/live-news/updates")
        self.assertIsNone(result)


class TestSupermajorityExtractor(unittest.TestCase):
    """Test supermajority voting"""
    
    def test_supermajority_basic(self):
        """Test basic supermajority extraction"""
        texts = {
            'ext1': "This is sentence number one. This is sentence number two. This is sentence number three.",
            'ext2': "This is sentence number one. This is sentence number two. This is a different sentence.",
            'ext3': "This is sentence number one. This is sentence number two. This is another different sentence.",
            'ext4': "This is sentence number one. This is sentence number two. This is yet another sentence.",
        }
        
        result, stats = SupermajorityExtractor.extract(texts, min_extractors=3)
        
        # All 4 have these sentences
        self.assertIn("This is sentence number one", result)
        self.assertIn("This is sentence number two", result)
        
        # Only 1 extractor has each of the others (filtered out)
        self.assertNotIn("sentence number three", result)
    
    def test_supermajority_threshold(self):
        """Test different thresholds"""
        texts = {
            'ext1': "All extractors have this sentence. Three extractors have this sentence. Two extractors have this one. Only one extractor has this sentence.",
            'ext2': "All extractors have this sentence. Three extractors have this sentence. Two extractors have this one. This is a different final sentence.",
            'ext3': "All extractors have this sentence. Three extractors have this sentence. This is another different sentence. Yet another different sentence here.",
            'ext4': "All extractors have this sentence. This is completely different. Another different sentence. More different sentences.",
        }
        
        # 4/4 threshold
        result_4, _ = SupermajorityExtractor.extract(texts, min_extractors=4)
        self.assertIn("All extractors have this sentence", result_4)
        self.assertNotIn("Three extractors have this sentence", result_4)
        
        # 3/4 threshold
        result_3, _ = SupermajorityExtractor.extract(texts, min_extractors=3)
        self.assertIn("All extractors have this sentence", result_3)
        self.assertIn("Three extractors have this sentence", result_3)
        self.assertNotIn("Two extractors have this one", result_3)


class TestEncoding(unittest.TestCase):
    """Test proper encoding handling"""
    
    def test_unicode_preservation(self):
        """Test Unicode characters are preserved correctly"""
        quirks = QuirksProcessor()
        text = "Café résumé naïve"
        result = quirks.base_quirks(text)
        self.assertEqual(result, text)
    
    def test_smart_quote_normalization_encoding(self):
        """Test smart quotes don't create mojibake"""
        quirks = QuirksProcessor()
        text = 'He said \u201chello\u201d'
        result = quirks.base_quirks(text)
        
        # Should be ASCII straight quote
        self.assertIn('"', result)
        
        # Encode to UTF-8 and verify no mojibake
        encoded = result.encode('utf-8')
        decoded = encoded.decode('utf-8')
        self.assertEqual(result, decoded)
        
        # Verify it's just ASCII quote (0x22)
        self.assertIn(b'\x22', encoded)
        self.assertNotIn(b'\xe2\x80\x9c', encoded)


class TestFingerprinting(unittest.TestCase):
    """Test complete fingerprinting pipeline"""
    
    def test_fingerprint_stability(self):
        """Test same content produces same hash"""
        quirks = QuirksProcessor()
        
        text1 = "This is a test article. It has content."
        text2 = "This is a test article. It has content."
        
        processed1 = quirks.base_quirks(text1)
        processed2 = quirks.base_quirks(text2)
        
        hash1 = hashlib.sha256(processed1.encode()).hexdigest()
        hash2 = hashlib.sha256(processed2.encode()).hexdigest()
        
        self.assertEqual(hash1, hash2)
    
    def test_fingerprint_detects_changes(self):
        """Test different content produces different hash"""
        quirks = QuirksProcessor()
        
        text1 = "This is the original article."
        text2 = "This is the modified article."
        
        processed1 = quirks.base_quirks(text1)
        processed2 = quirks.base_quirks(text2)
        
        hash1 = hashlib.sha256(processed1.encode()).hexdigest()
        hash2 = hashlib.sha256(processed2.encode()).hexdigest()
        
        self.assertNotEqual(hash1, hash2)


class TestGizmodoRegressionBug(unittest.TestCase):
    """Regression test for Gizmodo mojibake bug"""
    
    def test_gizmodo_article_no_mojibake_in_processing(self):
        """Test that Gizmodo article doesn't produce mojibake during processing"""
        quirks = QuirksProcessor()
        
        # Exact text from Gizmodo with smart quotes
        text_with_smart_quotes = 'Reddit, Meta, and Google voluntarily \u201ccomplied with some of the requests\u201d for'
        
        # Process it
        result = quirks.base_quirks(text_with_smart_quotes)
        
        # Should have straight quotes
        self.assertEqual(result, 'Reddit, Meta, and Google voluntarily "complied with some of the requests" for')
        
        # Should NOT have mojibake characters
        self.assertNotIn('â', result)
        self.assertNotIn('\u201c', result)
    
    def test_write_to_file_no_mojibake(self):
        """CRITICAL: Test that writing processed text to file doesn't create mojibake"""
        quirks = QuirksProcessor()
        
        # Process text with smart quotes
        text = 'voluntarily \u201ccomplied with\u201d requests'
        result = quirks.base_quirks(text)
        
        # Write to file
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', delete=False, suffix='.md') as f:
            md_line = f"| test | {result} |"
            f.write(md_line)
            temp_path = f.name
        
        try:
            # Check actual bytes in file
            with open(temp_path, 'rb') as f:
                file_bytes = f.read()
            
            # Should NOT have double-encoded UTF-8 mojibake
            self.assertNotIn(b'\xc3\xa2\xc2\x80\xc2\x9c', file_bytes, 
                           f"File has mojibake! Bytes: {file_bytes.hex()}")
            
            # Should have correct ASCII quote (0x22)
            self.assertIn(b'\x22', file_bytes, "File missing ASCII quote")
            
        finally:
            os.unlink(temp_path)


def run_tests():
    """Run all tests and generate report"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestQuirksProcessor))
    suite.addTests(loader.loadTestsFromTestCase(TestSupermajorityExtractor))
    suite.addTests(loader.loadTestsFromTestCase(TestEncoding))
    suite.addTests(loader.loadTestsFromTestCase(TestFingerprinting))
    suite.addTests(loader.loadTestsFromTestCase(TestGizmodoRegressionBug))
    
    # Run with verbose output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    
    if result.wasSuccessful():
        print("\n✓ ALL TESTS PASSED!")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED")
        return 1


if __name__ == '__main__':
    import sys
    sys.exit(run_tests())
