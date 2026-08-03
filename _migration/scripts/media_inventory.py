"""Build the master media inventory from WXR attachments, product CSV and crawled pages."""
import csv
import glob
import html
import json
import os
import re
import xml.etree.ElementTree as ET

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, '..', '..')
NS = {'wp': 'http://wordpress.org/export/1.2/',
      'content': 'http://purl.org/rss/1.0/modules/content/',
      'excerpt': 'http://wordpress.org/export/1.2/excerpt/'}

UPLOAD_RE = re.compile(r'https?://(?:www\.)?cardboardcups\.com(/wp-content/uploads/[^\s"\'<>)\\]+)', re.I)
SIZED = re.compile(r'-(\d{2,4})x(\d{2,4})(?=\.(?:jpg|jpeg|png|gif|webp)$)', re.I)


def original(path):
    """Strip a WordPress -WxH size suffix to get the original upload path."""
    return SIZED.sub('', path)


def from_wxr():
    """Attachment id -> {url, alt, title, caption} from the media export."""
    out = {}
    tree = ET.parse(os.path.join(SRC, 'cardboardcups.WordPress.2026-07-30 2.xml'))
    for it in tree.getroot().find('channel').findall('item'):
        if it.find('wp:post_type', NS).text != 'attachment':
            continue
        pid = it.find('wp:post_id', NS).text
        url = (it.find('wp:attachment_url', NS).text or '').strip()
        alt = None
        for m in it.findall('wp:postmeta', NS):
            if m.find('wp:meta_key', NS).text == '_wp_attachment_image_alt':
                alt = (m.find('wp:meta_value', NS).text or '').strip()
        out[pid] = {
            'id': pid,
            'url': url,
            'alt': alt,
            'title': (it.find('title').text or '').strip(),
            'caption': (it.find('excerpt:encoded', NS).text or '').strip(),
        }
    return out


def main():
    atts = from_wxr()
    by_path = {}

    def add(path, **kw):
        p = original(path)
        rec = by_path.setdefault(p, {'path': p, 'alt': None, 'sources': set(), 'products': set(),
                                     'pages': set(), 'variants': set()})
        if path != p:
            rec['variants'].add(path)
        for k, v in kw.items():
            if k in ('sources', 'products', 'pages'):
                rec[k].add(v)
            elif v and not rec.get(k):
                rec[k] = v
        return rec

    # 1. every attachment in the media export
    for a in atts.values():
        m = UPLOAD_RE.match(a['url'])
        if m:
            add(m.group(1), alt=a['alt'], title=a['title'], sources='wxr-attachment')

    # 2. product gallery order from the WooCommerce CSV
    prod_images = {}
    csv_path = glob.glob(os.path.join(SRC, 'wc-product-export-*.csv'))[0]
    for row in csv.DictReader(open(csv_path, encoding='utf-8-sig')):
        slug_imgs = []
        for u in (row['Images'] or '').split(','):
            u = u.strip()
            m = UPLOAD_RE.match(u)
            if m:
                p = original(m.group(1))
                slug_imgs.append(p)
                add(m.group(1), sources='product-csv', products=row['Name'])
        prod_images[row['Name']] = slug_imgs

    # 3. anything referenced by the crawled live pages (theme art, page images, srcset)
    for f in glob.glob(os.path.join(HERE, '..', 'crawl', 'pages', '*.html')):
        page = os.path.basename(f)[:-5]
        doc = open(f, encoding='utf-8').read()
        for m in UPLOAD_RE.finditer(doc):
            add(html.unescape(m.group(1)), sources='live-html', pages=page)

    for r in by_path.values():
        r['sources'] = sorted(r['sources'])
        r['products'] = sorted(r['products'])
        r['pages'] = sorted(r['pages'])
        r['variants'] = sorted(r['variants'])

    out = {
        'images': sorted(by_path.values(), key=lambda r: r['path']),
        'product_images': prod_images,
        'attachments': list(atts.values()),
    }
    dest = os.path.join(HERE, '..', 'audit', 'media-inventory.json')
    json.dump(out, open(dest, 'w'), indent=1)
    print(f'unique originals : {len(by_path)}')
    print(f'wxr attachments  : {len(atts)}')
    print(f'with alt text    : {sum(1 for r in by_path.values() if r.get("alt"))}')
    print(f'products w/ imgs : {sum(1 for v in prod_images.values() if v)}')
    print('wrote', dest)


if __name__ == '__main__':
    main()
