"""Dump the readable main-content of a crawled live page (Elementor chrome stripped)."""
import html
import re
import sys
import os

HERE = os.path.dirname(__file__)


def clean(doc):
    doc = re.sub(r'<(script|style|noscript|svg)[^>]*>.*?</\1>', '', doc, flags=re.S | re.I)
    doc = doc.split('</head>', 1)[-1]
    return doc


def blocks(doc):
    """Yield (kind, text) for headings, paragraphs, list items, links and images in order."""
    pat = re.compile(
        r'<h([1-6])[^>]*>(?P<h>.*?)</h\1>'
        r'|<p[^>]*>(?P<p>.*?)</p>'
        r'|<li[^>]*>(?P<li>.*?)</li>'
        r'|<img[^>]*?src=["\'](?P<img>[^"\']+)["\'][^>]*?>'
        r'|<a[^>]*?href=["\'](?P<href>[^"\']+)["\'][^>]*>(?P<a>.*?)</a>',
        re.S | re.I)
    for m in pat.finditer(doc):
        if m.group('h') is not None:
            yield f'H{m.group(1)}', txt(m.group('h'))
        elif m.group('p') is not None:
            yield 'P', txt(m.group('p'))
        elif m.group('li') is not None:
            yield 'LI', txt(m.group('li'))
        elif m.group('img') is not None:
            yield 'IMG', m.group('img')
        elif m.group('a') is not None:
            t = txt(m.group('a'))
            if t:
                yield 'A', f'{t}  ->  {m.group("href")}'


def txt(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    return html.unescape(re.sub(r'\s+', ' ', s)).strip()


if __name__ == '__main__':
    for name in sys.argv[1:]:
        p = os.path.join(HERE, '..', 'crawl', 'pages', name)
        print(f'\n{"#" * 30} {name} {"#" * 30}')
        seen = set()
        for kind, t in blocks(clean(open(p, encoding='utf-8').read())):
            if not t or (kind, t) in seen:
                continue
            seen.add((kind, t))
            print(f'{kind:4} {t[:400]}')
