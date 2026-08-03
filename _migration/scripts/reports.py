"""Generate the migration deliverables by diffing the live site against the build."""
import csv
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DIST = os.path.join(ROOT, 'cardboardcups-astro', 'dist', 'client')
OUT = os.path.join(ROOT, 'cardboardcups-astro', 'reports')
SITE = 'https://cardboardcups.com'

os.makedirs(OUT, exist_ok=True)

live = json.load(open(os.path.join(HERE, '..', 'crawl', 'live-meta.json')))
products = json.load(open(os.path.join(ROOT, 'cardboardcups-astro', 'src', 'data', 'products.json')))
categories = json.load(open(os.path.join(ROOT, 'cardboardcups-astro', 'src', 'data', 'categories.json')))
media = json.load(open(os.path.join(HERE, '..', 'audit', 'media-inventory.json')))
dl = json.load(open(os.path.join(HERE, '..', 'audit', 'media-download.json')))

REDIRECTS = {
    '/cart/': ('/get-free-quote/', 'WooCommerce cart; site takes quotations, not orders'),
    '/checkout/': ('/get-free-quote/', 'WooCommerce checkout; no payment gateway was ever enabled'),
    '/my-account/': ('/contact-us/', 'No customer accounts exist; sales team handles enquiries'),
    '/brand/cardboard-cups/': ('/shop/', 'Single-brand archive duplicating /shop/ (brand == site name)'),
    '/brand/cardboard-cups/page/2/': ('/shop/', 'Paginated duplicate of the same brand archive'),
}


def strip(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    return html.unescape(re.sub(r'\s+', ' ', s)).strip()


def built_pages():
    pages = {}
    for dp, _, fs in os.walk(DIST):
        for f in fs:
            if not f.endswith('.html'):
                continue
            full = os.path.join(dp, f)
            rel = '/' + os.path.relpath(full, DIST).replace(os.sep, '/')
            url = '/404/' if rel == '/404.html' else re.sub(r'index\.html$', '', rel)
            pages[url] = open(full, encoding='utf-8').read()
    return pages


def meta_of(doc):
    def one(pat):
        m = re.search(pat, doc, re.I | re.S)
        return html.unescape(m.group(1).strip()) if m else None
    h1 = re.findall(r'<h1[^>]*>(.*?)</h1>', doc, re.I | re.S)
    return {
        'title': one(r'<title[^>]*>(.*?)</title>'),
        'description': one(r'<meta name="description" content="([^"]*)"'),
        'canonical': one(r'<link rel="canonical" href="([^"]+)"'),
        'h1': strip(h1[0]) if h1 else None,
        'h1_count': len(h1),
        'schema': re.findall(r'"@type":"([A-Za-z]+)"', doc),
    }


built = built_pages()
live_by_path = {}
for v in live.values():
    c = v.get('canonical')
    if c:
        live_by_path[c.replace(SITE, '') or '/'] = v

# ------------------------------------------------------------------ 1. URL inventory
rows = []
all_paths = sorted(set(list(live_by_path) + list(built) + list(REDIRECTS)))
for path in all_paths:
    lv = live_by_path.get(path)
    bt = built.get(path)
    bm = meta_of(bt) if bt else {}
    if path in REDIRECTS:
        status, action = '301', f'redirect -> {REDIRECTS[path][0]}'
    elif bt and path == '/404/':
        status, action = '404', 'error page (noindex, not in sitemap)'
    elif bt:
        status, action = '200', 'migrated, URL unchanged' if lv else 'migrated'
    else:
        status, action = '404', 'not recreated'
    rows.append({
        'url': path,
        'type': ('product' if path.startswith('/product/') else
                 'category' if path.startswith('/product-category/') else
                 'utility' if path in ('/404/',) else 'page'),
        'old_status': '200' if lv else ('200' if path in REDIRECTS else '-'),
        'new_status': status,
        'action': action,
        'old_title': (lv or {}).get('title') or '',
        'new_title': bm.get('title') or '',
        'old_description': (lv or {}).get('description') or '',
        'new_description': bm.get('description') or '',
        'old_h1_count': len((lv or {}).get('h1') or []),
        'new_h1_count': bm.get('h1_count', 0),
        'new_canonical': bm.get('canonical') or '',
    })

with open(os.path.join(OUT, 'url-inventory.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)

# ------------------------------------------------------------------ 2. redirect map
with open(os.path.join(OUT, 'redirect-map.csv'), 'w', newline='') as fh:
    w = csv.writer(fh)
    w.writerow(['old_url', 'new_url', 'status', 'reason'])
    for old, (new, why) in REDIRECTS.items():
        w.writerow([SITE + old, SITE + new, 301, why])
    w.writerow([f'{SITE.replace("https", "http")}/*', f'{SITE}/*', 301, 'Force HTTPS'])
    w.writerow(['https://www.cardboardcups.com/*', f'{SITE}/*', 301,
                'Canonical host is non-www (matches current live behaviour)'])
    w.writerow([f'{SITE}/<path> (no slash)', f'{SITE}/<path>/', 301,
                'Canonical trailing slash (matches current live behaviour)'])

# ------------------------------------------------------------------ 3. metadata comparison
meta_rows = []
for r in rows:
    if r['new_status'] != '200':
        continue
    t_same = r['old_title'] == r['new_title']
    d_same = r['old_description'] == r['new_description']
    meta_rows.append({
        'url': r['url'],
        'title_preserved': 'yes' if t_same else ('n/a - new page' if not r['old_title'] else 'CHANGED'),
        'old_title': r['old_title'],
        'new_title': r['new_title'],
        'description_preserved': 'yes' if d_same else ('supplied - live had none' if not r['old_description'] else 'CHANGED'),
        'old_description': r['old_description'],
        'new_description': r['new_description'],
        'old_h1_count': r['old_h1_count'],
        'new_h1_count': r['new_h1_count'],
    })
with open(os.path.join(OUT, 'metadata-comparison.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(meta_rows[0]))
    w.writeheader()
    w.writerows(meta_rows)

# ------------------------------------------------------------------ 4. assets
missing = dl['failed']
no_alt = [i['src'] for p in products for i in p['images'] if not i.get('alt')]
derived_alt = []
wxr_alt = {r['path']: r.get('alt') for r in media['images']}
for p in products:
    for i in p['images']:
        if not wxr_alt.get(i['src']):
            derived_alt.append({'product': p['name'], 'image': i['src'], 'alt_used': i['alt']})

with open(os.path.join(OUT, 'assets-report.json'), 'w') as fh:
    json.dump({
        'originals_downloaded': len(dl['ok']),
        'download_failures': missing,
        'product_images': sum(len(p['images']) for p in products),
        'images_without_any_alt': no_alt,
        'alt_text_derived_from_filename': derived_alt,
        'alt_text_from_wordpress': sum(1 for v in wxr_alt.values() if v),
    }, fh, indent=1)

# ------------------------------------------------------------------ 5. structured data
schema_rows = []
for url, doc in sorted(built.items()):
    blocks = re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', doc, re.S)
    types, ok = [], True
    for b in blocks:
        try:
            j = json.loads(b)
        except Exception:
            ok = False
            continue
        for n in (j if isinstance(j, list) else [j]):
            t = n.get('@type')
            types.append(t if isinstance(t, str) else ','.join(t or []))
    live_types = []
    lv = live_by_path.get(url)
    if lv:
        for s in lv.get('schema_types', []):
            live_types += [x for x in (s if isinstance(s, list) else [s]) if x]
    schema_rows.append({
        'url': url,
        'new_schema': ' + '.join(types),
        'old_schema': ' + '.join(live_types),
        'parses': 'yes' if ok else 'NO',
        'duplicate_product': 'YES' if types.count('Product') > 1 else 'no',
    })
with open(os.path.join(OUT, 'structured-data-report.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(schema_rows[0]))
    w.writeheader()
    w.writerows(schema_rows)

# ------------------------------------------------------------------ summary
summary = {
    'pages_migrated': sum(1 for r in rows if r['new_status'] == '200'),
    'products': len(products),
    'categories': len(categories),
    'images_migrated': len(dl['ok']),
    'webp_renditions': len([f for dp, _, fs in os.walk(os.path.join(ROOT, 'cardboardcups-astro', 'public'))
                            for f in fs if f.endswith('.webp')]),
    'unchanged_urls': sum(1 for r in rows if r['new_status'] == '200' and r['old_status'] == '200'),
    'redirects': len(REDIRECTS),
    'faqs': sum(len(p['faqs']) for p in products),
    'spec_tables': sum(1 for p in products if p['specifications']),
    'unresolved': [m['path'] for m in missing],
}
json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), indent=1)

print(json.dumps(summary, indent=1))
print('\nwrote:', ', '.join(sorted(os.listdir(OUT))))
