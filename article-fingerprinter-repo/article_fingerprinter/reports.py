"""
Report Generation Module

Generates HTML and Markdown reports from fingerprinting results.
"""

import html as html_module
from typing import Dict


class ReportGenerator:
    """Generate HTML and Markdown reports"""
    
    @staticmethod
    def generate_markdown(results: Dict) -> str:
        """Generate Markdown report"""
        fp = results['fingerprint']
        meta = results['metadata']
        stats = results['extraction_stats']
        
        md = f"""# Article Fingerprint Report

## Primary Fingerprint

- **Article ID:** `{fp['article_id']}`
- **Content Hash:** `{fp['content_hash']}`
- **Confidence:** {fp['confidence'].upper()}
- **Agreement Score:** {fp['agreement_score']:.2%}
- **Word Count:** {fp['word_count']:,} words
- **Method:** {fp['extraction_method']}

## Metadata

- **URL:** {meta['url']}
- **Canonical:** {meta['canonical_url']}
- **Title:** {meta['title']}
- **Authors:** {', '.join(meta['authors']) if meta['authors'] else 'None'}
- **Published:** {meta['publish_date'] or 'Not found'}
- **Modified:** {meta['modified_date'] or 'Not found'}
- **Schema.org:** {'✓' if meta['has_schema_org'] else '✗'}
- **Open Graph:** {'✓' if meta['has_opengraph'] else '✗'}
- **Canonical Tag:** {'✓' if meta['has_canonical'] else '✗'}

## Extraction Statistics

- Extractors successful: {stats['extractors_successful']}/{stats['extractors_attempted']}
- Unique hashes (after quirks): {stats['unique_hashes_after_quirks']}
- Identical hash pairs: {stats['extractors_successful'] - stats['unique_hashes_after_quirks']}
- Supermajority threshold: {stats['supermajority_threshold']}

### Hash Groups (After Quirks)

"""
        for i, group in enumerate(stats['hash_groups'], 1):
            md += f"{i}. {', '.join(group)}\n"
        
        md += "\n## Individual Extractions\n\n"
        md += "| Extractor | Raw Words | After Quirks | Hash | Preview |\n"
        md += "|-----------|-----------|--------------|------|----------|\n"
        
        for lib, data in results['individual_extractions'].items():
            preview = data['preview'].replace('|', '\\|')[:100]
            md += f"| {lib} | {data['raw_word_count']:,} | {data['processed_word_count']:,} | `{data['hash'][:16]}...` | {preview}... |\n"
        
        md += "\n## Pairwise Similarities\n\n"
        md += "| Extractor 1 | Extractor 2 | Similarity | Words 1 | Words 2 | Difference |\n"
        md += "|-------------|-------------|------------|---------|---------|------------|\n"
        
        for sim in results['pairwise_similarities']:
            md += f"| {sim['lib1']} | {sim['lib2']} | {sim['similarity']:.2%} | {sim['wc1']:,} | {sim['wc2']:,} | {abs(sim['wc1'] - sim['wc2']):,} |\n"
        
        md += "\n## Supermajority Voting\n\n"
        
        for vote_count in [4, 3, 2, 1]:
            sentences = results['voting_stats']['by_vote_count'][vote_count]
            if sentences:
                md += f"### {vote_count}/4 Extractors ({len(sentences)} sentences)\n\n"
                for sent in sentences[:5]:
                    md += f"- {sent}\n"
                if len(sentences) > 5:
                    md += f"- *... and {len(sentences) - 5} more*\n"
                md += "\n"
        
        md += f"""## Final Supermajority Extraction

- **Threshold:** {stats['supermajority_threshold']} extractors
- **Word Count:** {results['supermajority_extraction']['word_count']:,} words
- **Hash:** `{results['supermajority_extraction']['hash']}`

### Content

{results['supermajority_extraction']['text']}

---

*Generated: {results['extracted_at']}*  
*Processing Time: {results['processing_time_ms']:.2f}ms*
"""
        
        return md
    
    @staticmethod
    def generate_html(results: Dict) -> str:
        """Generate HTML report with embedded CSS"""
        fp = results['fingerprint']
        meta = results['metadata']
        stats = results['extraction_stats']
        
        # Build components
        hash_groups_html = ""
        for i, group in enumerate(stats['hash_groups'], 1):
            hash_groups_html += f"<div class='hash-group'>Group {i}: {', '.join(group)}</div>\n"
        
        extractions_html = ""
        for lib, data in results['individual_extractions'].items():
            preview_escaped = html_module.escape(data['preview'])
            extractions_html += f"""
            <tr>
                <td>{lib}</td>
                <td>{data['raw_word_count']:,}</td>
                <td>{data['processed_word_count']:,}</td>
                <td class='hash'>{data['hash'][:32]}...</td>
                <td class='preview'>{preview_escaped}</td>
            </tr>"""
        
        similarities_html = ""
        for sim in results['pairwise_similarities']:
            color = 'green' if sim['similarity'] > 0.95 else 'orange' if sim['similarity'] > 0.80 else 'red'
            similarities_html += f"""
            <tr>
                <td>{sim['lib1']}</td>
                <td>{sim['lib2']}</td>
                <td style='color: {color}; font-weight: bold;'>{sim['similarity']:.2%}</td>
                <td>{sim['wc1']:,}</td>
                <td>{sim['wc2']:,}</td>
                <td>{abs(sim['wc1'] - sim['wc2']):,}</td>
            </tr>"""
        
        voting_html = ""
        for vote_count in [4, 3, 2, 1]:
            sentences = results['voting_stats']['by_vote_count'][vote_count]
            if sentences:
                voting_html += f"<h4>{vote_count}/4 Extractors ({len(sentences)} sentences)</h4>\n<ul>\n"
                for sent in sentences[:5]:
                    voting_html += f"<li>{html_module.escape(sent)}</li>\n"
                if len(sentences) > 5:
                    voting_html += f"<li><em>... and {len(sentences) - 5} more</em></li>\n"
                voting_html += "</ul>\n"
        
        conf_colors = {'very_high': '#28a745', 'high': '#5cb85c', 'medium': '#ffc107', 'low': '#dc3545'}
        conf_color = conf_colors.get(fp['confidence'], '#6c757d')
        
        # Complete HTML (CSS embedded for brevity - in production, use external CSS)
        return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Article Fingerprint Report</title>
<style>
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:1200px;margin:40px auto;padding:20px;background:#f5f5f5}}
.container{{background:white;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,0.1)}}
h1{{color:#333;border-bottom:3px solid #007bff;padding-bottom:10px}}
h2{{color:#555;margin-top:30px;border-bottom:2px solid #e0e0e0;padding-bottom:8px}}
.fingerprint-box{{background:#f8f9fa;border-left:4px solid #007bff;padding:20px;margin:20px 0;border-radius:4px}}
.fingerprint-box .item{{margin:8px 0}}
.fingerprint-box .label{{font-weight:bold;color:#555;display:inline-block;width:180px}}
.confidence-badge{{display:inline-block;padding:4px 12px;border-radius:12px;color:white;font-weight:bold;text-transform:uppercase;font-size:0.85em}}
table{{width:100%;border-collapse:collapse;margin:20px 0}}
th{{background:#007bff;color:white;padding:12px;text-align:left}}
td{{padding:10px;border-bottom:1px solid #e0e0e0}}
tr:hover{{background:#f8f9fa}}
.hash{{font-family:'Courier New',monospace;font-size:0.9em;color:#666}}
.preview{{font-size:0.9em;color:#555}}
.hash-group{{background:#e7f3ff;padding:8px 12px;margin:5px 0;border-radius:4px;border-left:3px solid #007bff}}
.metadata{{background:#f8f9fa;padding:15px;border-radius:4px;margin:10px 0}}
.metadata div{{margin:5px 0}}
.metadata .key{{font-weight:bold;color:#555;display:inline-block;width:150px}}
</style>
</head>
<body><div class="container">
<h1>📰 Article Fingerprint Report</h1>
<div class="fingerprint-box"><h3>Primary Fingerprint</h3>
<div class="item"><span class="label">Article ID:</span><span>{fp['article_id']}</span></div>
<div class="item"><span class="label">Content Hash:</span><span>{fp['content_hash']}</span></div>
<div class="item"><span class="label">Confidence:</span><span class="confidence-badge" style="background-color:{conf_color};">{fp['confidence']}</span></div>
<div class="item"><span class="label">Agreement Score:</span><span>{fp['agreement_score']:.2%}</span></div>
<div class="item"><span class="label">Word Count:</span><span>{fp['word_count']:,} words</span></div>
</div>
<h2>📋 Metadata</h2>
<div class="metadata">
<div><span class="key">URL:</span> {html_module.escape(meta['url'])}</div>
<div><span class="key">Title:</span> {html_module.escape(meta['title'])}</div>
<div><span class="key">Published:</span> {html_module.escape(meta['publish_date']) if meta['publish_date'] else 'Not found'}</div>
</div>
<h2>📊 Extraction Statistics</h2>
<h3>Hash Groups</h3>{hash_groups_html}
<h2>🔍 Individual Extractions</h2>
<table><tr><th>Extractor</th><th>Raw Words</th><th>After Quirks</th><th>Hash</th><th>Preview</th></tr>{extractions_html}</table>
<h2>🔗 Pairwise Similarities</h2>
<table><tr><th>Extractor 1</th><th>Extractor 2</th><th>Similarity</th><th>Words 1</th><th>Words 2</th><th>Difference</th></tr>{similarities_html}</table>
<h2>🗳️ Supermajority Voting</h2>{voting_html}
<div class="fingerprint-box"><h3>Final Supermajority Extraction</h3>
<p><strong>Word Count:</strong> {results['supermajority_extraction']['word_count']:,} words</p>
<p style="white-space:pre-wrap">{html_module.escape(results['supermajority_extraction']['text'][:500])}...</p>
</div>
<p style="text-align:center;color:#999;margin-top:30px">Generated: {results['extracted_at']}<br>Processing Time: {results['processing_time_ms']:.2f}ms</p>
</div></body></html>"""

