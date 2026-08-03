"""Extract head metadata, headings, schema and images from the crawled live pages."""
import glob
import html
import json
import os
import re

PAGES = os.path.join(os.path.dirname(__file__), '..', 'crawl', 'pages')


def tag(doc, pattern):
    m = re.search(pattern, doc, re.I | re.S)
    return html.unescape(m.group(1).strip()) if m else None


def meta(doc, name, attr='name'):
    m = re.search(r'<meta[^>]+%s=["\']%s["\'][^>]+content=["\'](.*?)["\']' % (attr, re.escape(name)),
                  doc, re.I | re.S)
    if not m:
        m = re.search(r'<meta[^>]+content=["\'](.*?)["\'][^>]+%s=["\']%s["\']' % (attr, re.escape(name)),
                      doc, re.I | re.S)
    return html.unescape(m.group(1).strip()) if m else None


def strip_tags(s):
    s = re.sub(r'<[^>]+>', '', s)
    return html.unescape(re.sub(r'\s+', ' ', s)).strip()


def _types(node):
    """Collect @type values from an arbitrary JSON-LD node (object, list or @graph)."""
    if isinstance(node, list):
        return [t for n in node for t in _types(n)]
    if isinstance(node, dict):
        if '@graph' in node:
            return _types(node['@graph'])
        t = node.get('@type')
        if isinstance(t, list):
            return t
        return [t] if t else []
    return []


def analyse(path):
    doc = open(path, encoding='utf-8').read()
    body = doc.split('</head>', 1)[-1]
    headings = [(h[0], strip_tags(h[1]))
                for h in re.findall(r'<h([1-6])[^>]*>(.*?)</h\1>', body, re.I | re.S)]
    schemas = []
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', doc, re.I | re.S):
        raw = m.group(1).strip()
        try:
            schemas.append(json.loads(raw))
        except Exception:  # noqa: BLE001
            schemas.append({'__PARSE_ERROR__': raw[:200]})
    imgs = []
    for m in re.finditer(r'<img[^>]*>', body, re.I):
        t = m.group(0)
        src = re.search(r'\ssrc=["\']([^"\']+)["\']', t)
        alt = re.search(r'\salt=["\']([^"\']*)["\']', t)
        if src:
            imgs.append({'src': src.group(1), 'alt': html.unescape(alt.group(1)) if alt else None})
    return {
        'file': os.path.basename(path),
        'title': tag(doc, r'<title[^>]*>(.*?)</title>'),
        'description': meta(doc, 'description'),
        'robots': meta(doc, 'robots'),
        'canonical': tag(doc, r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\'](.*?)["\']'),
        'og_title': meta(doc, 'og:title', 'property'),
        'og_description': meta(doc, 'og:description', 'property'),
        'og_image': meta(doc, 'og:image', 'property'),
        'og_type': meta(doc, 'og:type', 'property'),
        'twitter_card': meta(doc, 'twitter:card'),
        'h1': [t for lvl, t in headings if lvl == '1'],
        'headings': headings,
        'schema_types': [_types(s) for s in schemas],
        'schemas': schemas,
        'images': imgs,
        'has_add_to_cart': bool(re.search(r'add[_-]to[_-]cart|add to cart', body, re.I)),
        'price_tags': list(dict.fromkeys(re.findall(
            r'<[^>]*class=["\'][^"\']*woocommerce-Price-amount[^"\']*["\'][^>]*>(.*?)</span>',
            body, re.I | re.S)))[:5],
    }


if __name__ == '__main__':
    out = {}
    for p in sorted(glob.glob(os.path.join(PAGES, '*.html'))):
        out[os.path.basename(p)] = analyse(p)
    dest = os.path.join(PAGES, '..', 'live-meta.json')
    json.dump(out, open(dest, 'w'), indent=1)
    print('wrote', dest, len(out), 'pages')
    for k, v in out.items():
        print(f"\n### {k}")
        print("  title :", v['title'])
        print("  desc  :", (v['description'] or '')[:150])
        print("  canon :", v['canonical'], "| robots:", v['robots'])
        print("  h1    :", v['h1'])
        print("  schema:", v['schema_types'])
        print("  cart  :", v['has_add_to_cart'], "| prices:", [strip_tags(x) for x in v['price_tags']])
