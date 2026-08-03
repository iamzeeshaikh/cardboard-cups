"""Turn the WordPress/WooCommerce exports into the clean JSON the Astro site consumes.

Reads   : wc-product-export CSV, WXR media export, localhost.sql (Yoast), live crawl
Writes  : cardboardcups-astro/src/data/{products,categories,site}.json
"""
import csv
import glob
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import sqlparse  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.abspath(os.path.join(SRC, 'cardboardcups-astro', 'src', 'data'))
SITE = 'https://cardboardcups.com'

# ---------------------------------------------------------------- html cleaning

# Wrapper markup left behind by the AI drafting tool the copy was pasted from.
JUNK_ATTRS = re.compile(r'\s(?:data-(?:start|end|message-author-role|message-id|message-model-slug|'
                        r'testid|turn-id|scroll-anchor|is-last-node|is-only-node)|dir|class|style|id)='
                        r'(?:"[^"]*"|\'[^\']*\')', re.I)
JUNK_WRAPPERS = re.compile(r'</?(?:div|span|article|section|main|figure|figcaption)\b[^>]*>', re.I)
ALLOWED = {'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'a', 'br',
           'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote'}


def unescape_newlines(s):
    """The Woo CSV writes real newlines as the two characters backslash-n."""
    return s.replace('\\n', '\n')


def _cf_decode(hexed):
    """Undo Cloudflare's email obfuscation (first byte is the XOR key)."""
    try:
        data = bytes.fromhex(hexed)
    except ValueError:
        return None
    key = data[0]
    return ''.join(chr(b ^ key) for b in data[1:])


def deobfuscate_email(s):
    """Restore addresses Cloudflare replaced with /cdn-cgi/l/email-protection links."""
    def link(m):
        addr = _cf_decode(m.group(1))
        return f'<a href="mailto:{addr}">{addr}</a>' if addr else ''
    s = re.sub(r'<a[^>]+href=["\']/cdn-cgi/l/email-protection#([0-9a-f]+)["\'][^>]*>.*?</a>',
               link, s, flags=re.S | re.I)
    s = re.sub(r'<span[^>]+class=["\']__cf_email__["\'][^>]*data-cfemail=["\']([0-9a-f]+)["\'][^>]*>.*?</span>',
               lambda m: _cf_decode(m.group(1)) or '', s, flags=re.S | re.I)
    return s


def normalise_tel(s):
    """tel: hrefs must be dialable, not the display formatting."""
    def fix(m):
        digits = re.sub(r'[^\d+]', '', m.group(1))
        if not digits.startswith('+'):
            digits = '+1' + digits.lstrip('1')
        return f'href="tel:{digits}"'
    return re.sub(r'href=["\']tel:([^"\']+)["\']', fix, s, flags=re.I)


def internalise(url):
    """Rewrite an absolute cardboardcups.com URL to a root-relative, trailing-slash path."""
    m = re.match(r'https?://(?:www\.)?cardboardcups\.com(/[^"\'\s]*)?$', url.strip(), re.I)
    if not m:
        return None
    path = m.group(1) or '/'
    path = path.split('#')[0].split('?')[0]
    if not path.endswith('/') and '.' not in path.rsplit('/', 1)[-1]:
        path += '/'
    return path


def clean_html(raw):
    """Strip builder residue and disallowed tags, keeping the semantic content intact."""
    if not raw:
        return ''
    s = unescape_newlines(raw)
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = deobfuscate_email(s)
    s = normalise_tel(s)
    s = JUNK_WRAPPERS.sub('', s)

    def fix_tag(m):
        closing, name, attrs = m.group(1), m.group(2).lower(), m.group(3) or ''
        if name not in ALLOWED:
            return ''
        if closing:
            return f'</{name}>'
        if name == 'a':
            href = re.search(r'href=["\']([^"\']+)["\']', attrs, re.I)
            if not href:
                return ''
            target = href.group(1).strip()
            rel = internalise(target)
            if rel:
                return f'<a href="{html.escape(rel)}">'
            if target.startswith(('http://', 'https://')):
                return (f'<a href="{html.escape(target)}" rel="noopener noreferrer nofollow" '
                        f'target="_blank">')
            return f'<a href="{html.escape(target)}">'
        return f'<{name}>'

    s = re.sub(r'<(/?)([a-zA-Z0-9]+)((?:\s[^>]*)?)/?>', fix_tag, s)
    # a list item wrapped in a single paragraph is builder noise, not structure
    s = re.sub(r'<li>\s*<p>(.*?)</p>\s*</li>', r'<li>\1</li>', s, flags=re.S)
    s = re.sub(r'<(p|li|h2|h3|h4|td|th)>\s*(?:&nbsp;|\s|<br>)*\s*</\1>', '', s)
    s = re.sub(r'<(p|li|h2|h3|h4)>\s*</\1>', '', s)
    # Wide tables must scroll inside their own box instead of widening the page.
    s = re.sub(r'<table>(.*?)</table>',
               r'<div class="table-scroll"><table>\1</table></div>', s, flags=re.S)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()


def text_of(raw):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', raw or ''))).strip()


def split_paragraphs(raw):
    """Short descriptions are plain text with blank-line paragraph breaks."""
    body = unescape_newlines(raw or '')
    body = re.sub(r'<[^>]+>', '', body)
    parts = [html.unescape(re.sub(r'[ \t]+', ' ', p).strip())
             for p in re.split(r'\n\s*\n', body)]
    return [p for p in parts if p]


def parse_faqs(raw):
    """`<hN>Question</hN> answer html` pairs -> [{question, answer}].

    Most products mark questions up as h3, but at least one uses h4, so the
    heading level is detected from the content rather than assumed.
    """
    s = unescape_newlines(raw or '')
    out = []
    level = '3' if re.search(r'<h3[^>]*>', s, re.I) else '4'
    parts = re.split(r'<h%s[^>]*>(.*?)</h%s>' % (level, level), s, flags=re.S | re.I)
    for i in range(1, len(parts), 2):
        q = text_of(parts[i])
        a_raw = parts[i + 1] if i + 1 < len(parts) else ''
        # answers are bare text with optional inline markup
        answer = clean_html(a_raw)
        if not re.search(r'<(p|ul|ol|table)\b', answer, re.I):
            paras = split_paragraphs(a_raw)
            answer = ''.join(f'<p>{html.escape(p)}</p>' for p in paras)
        q = re.sub(r'^\s*\d+\.\s*', '', q)      # drop the "1. " numbering prefix
        if q and text_of(answer):
            out.append({'question': q, 'answer': answer.strip()})
    return out


def parse_specs(raw):
    """The specification table -> {headers, rows} so it can be rendered responsively."""
    s = unescape_newlines(raw or '')
    if '<table' not in s.lower():
        return None
    headers = [text_of(c) for c in re.findall(r'<th[^>]*>(.*?)</th>', s, re.S | re.I)]
    rows = []
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S | re.I):
        cells = [text_of(c) for c in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S | re.I)]
        if cells:
            rows.append(cells)
    if not headers or not rows:
        return None
    return {'headers': headers, 'rows': rows}


# ---------------------------------------------------------------- sources

def yoast_meta():
    rows = sqlparse.dicts(os.path.join(SRC, 'localhost.sql'), 'dtz_yoast_indexable')
    out = {}
    for r in rows:
        link = r.get('permalink')
        if not link:
            continue
        path = internalise(link)
        if not path:
            continue
        if r.get('object_type') == 'post-type-archive' and path in out:
            continue
        out[path] = {
            'title': r.get('title') or None,
            'description': (r.get('description') or '').strip() or None,
            'og_image': (r.get('open_graph_image') or '').strip() or None,
            'focus_keyword': r.get('primary_focus_keyword') or None,
            'noindex': r.get('is_robots_noindex') == '1',
        }
    return out


def live_meta():
    p = os.path.join(HERE, '..', 'crawl', 'live-meta.json')
    raw = json.load(open(p))
    out = {}
    for v in raw.values():
        c = v.get('canonical')
        path = internalise(c) if c else None
        if path:
            out[path] = v
    return out


def media_alt():
    inv = json.load(open(os.path.join(HERE, '..', 'audit', 'media-inventory.json')))
    alts, titles = {}, {}
    for r in inv['images']:
        if r.get('alt'):
            alts[r['path']] = r['alt']
        if r.get('title'):
            titles[r['path']] = r['title']
    return alts, titles


def img_record(url, alts, titles, downloaded):
    m = re.match(r'https?://(?:www\.)?cardboardcups\.com(/wp-content/uploads/.+)$', url.strip(), re.I)
    path = m.group(1) if m else url
    path = re.sub(r'-(\d{2,4})x(\d{2,4})(?=\.(jpg|jpeg|png|gif|webp)$)', '', path, flags=re.I)
    alt = alts.get(path)
    if not alt:
        stem = os.path.splitext(os.path.basename(path))[0]
        alt = re.sub(r'[-_]+', ' ', stem).strip()
        alt = alt[0].upper() + alt[1:] if alt else ''
    return {
        'src': path,
        'alt': alt,
        'title': titles.get(path) or None,
        'available': path.lstrip('/') in downloaded,
    }


# ---------------------------------------------------------------- build

CATEGORY_ORDER = ['baking-cups', 'cup-sleeves', 'cup-types']
CATEGORY_NAMES = {'cup-types': 'Cup Types', 'baking-cups': 'Baking Cups',
                  'cup-sleeves': 'Cup Sleeves'}

# Category artwork as used on the live site: the homepage grid card and the
# hero on the category page itself. Taken from the rendered markup, not guessed.
CATEGORY_IMAGES = {
    'baking-cups': {
        'card': '/wp-content/uploads/2025/12/Muffin-Tray-Cupcake-Cups.jpg',
        'hero': '/wp-content/uploads/2025/12/Baking-Cups-Packaging.jpg',
    },
    'cup-sleeves': {
        'card': '/wp-content/uploads/2025/12/Heat-Protection-Cup-Sleeve.jpg',
        'hero': '/wp-content/uploads/2025/12/stackable-cup-sleeves.jpg',
    },
    'cup-types': {
        'card': '/wp-content/uploads/2025/12/Carry-Safe-White-Cups.jpg',
        'hero': '/wp-content/uploads/2025/12/Paperboard-Baking-Cups.jpg',
    },
}


def slug_for(name, live):
    """Recover each product's real slug from its live canonical URL."""
    for path, v in live.items():
        if path.startswith('/product/') and v.get('h1') and v['h1'][0] == name:
            return path.split('/')[2]
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def main():
    os.makedirs(OUT, exist_ok=True)
    yo, live = yoast_meta(), live_meta()
    alts, titles = media_alt()
    downloaded = {os.path.relpath(os.path.join(dp, f),
                                  os.path.join(HERE, '..', 'media'))
                  for dp, _, fs in os.walk(os.path.join(HERE, '..', 'media')) for f in fs}

    csv_path = glob.glob(os.path.join(SRC, 'wc-product-export-*.csv'))[0]
    rows = list(csv.DictReader(open(csv_path, encoding='utf-8-sig')))

    products, notes = [], []
    for row in rows:
        name = row['Name'].strip()
        slug = slug_for(name, live)
        path = f'/product/{slug}/'
        lm, ym = live.get(path, {}), yo.get(path, {})

        images = [img_record(u, alts, titles, downloaded)
                  for u in (row['Images'] or '').split(',') if u.strip()]
        cat_slug = next((c for c in CATEGORY_ORDER
                         if CATEGORY_NAMES[c] == (row['Categories'] or '').strip()), None)
        if not cat_slug:
            notes.append(f'{name}: unmapped category {row["Categories"]!r}')

        title = ym.get('title') or lm.get('title')
        desc = ym.get('description') or lm.get('description')
        if not ym.get('description'):
            notes.append(f'{path}: meta description fell back to live page source')

        products.append({
            'name': name,
            'slug': slug,
            'url': path,
            'sku': (row['SKU'] or '').strip(),
            'brand': (row['Brands'] or '').strip() or 'Cardboard Cups',
            'category': cat_slug,
            'inStock': row['In stock?'] == '1',
            'shortDescription': split_paragraphs(row['Short description']),
            'description': clean_html(row['Description']),
            'specifications': parse_specs(row['Meta: _bhww_specifications_wysiwyg']),
            'faqs': parse_faqs(row['Meta: _bhww_faqs_wysiwyg']),
            'images': images,
            'seo': {
                'title': title,
                'description': desc,
                'ogImage': images[0]['src'] if images else None,
                'focusKeyword': ym.get('focus_keyword'),
            },
        })

    # related products: same category first, then fill from the wider catalogue
    by_cat = {}
    for p in products:
        by_cat.setdefault(p['category'], []).append(p['slug'])
    order = [p['slug'] for p in products]
    for p in products:
        pool = [s for s in by_cat.get(p['category'], []) if s != p['slug']]
        extra = [s for s in order if s != p['slug'] and s not in pool]
        p['related'] = (pool + extra)[:4]

    # categories
    categories = []
    for slug in CATEGORY_ORDER:
        path = f'/product-category/{slug}/'
        lm, ym = live.get(path, {}), yo.get(path, {})
        members = [p['slug'] for p in products if p['category'] == slug]
        art = CATEGORY_IMAGES[slug]
        categories.append({
            'slug': slug,
            'name': CATEGORY_NAMES[slug],
            'url': path,
            'products': members,
            'cardImage': img_record(art['card'], alts, titles, downloaded),
            'heroImage': img_record(art['hero'], alts, titles, downloaded),
            'seo': {'title': ym.get('title') or lm.get('title'),
                    'description': ym.get('description') or lm.get('description'),
                    'focusKeyword': ym.get('focus_keyword')},
        })

    json.dump(products, open(os.path.join(OUT, 'products.json'), 'w'), indent=1)
    json.dump(categories, open(os.path.join(OUT, 'categories.json'), 'w'), indent=1)
    json.dump({'notes': notes}, open(os.path.join(HERE, '..', 'audit', 'build-notes.json'), 'w'),
              indent=1)

    print(f'products   : {len(products)}')
    print(f'categories : {len(categories)}')
    print(f'faqs       : {sum(len(p["faqs"]) for p in products)}')
    print(f'spec tables: {sum(1 for p in products if p["specifications"])}')
    print(f'images     : {sum(len(p["images"]) for p in products)}')
    missing = [i['src'] for p in products for i in p['images'] if not i['available']]
    print(f'missing img: {len(missing)} {missing[:5]}')
    for n in notes[:10]:
        print('  note:', n)


if __name__ == '__main__':
    main()
