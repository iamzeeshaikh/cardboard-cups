"""Extract clean semantic HTML for the policy/company pages from the live crawl."""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from build_data import clean_html, internalise, text_of  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = os.path.join(HERE, '..', 'crawl', 'pages')
OUT = os.path.abspath(os.path.join(HERE, '..', '..', 'cardboardcups-astro', 'src', 'data'))

# Elementor renders each text block inside .elementor-widget-text-editor; the policy
# pages are a single such widget, which is exactly the body copy we want.
WIDGET = re.compile(
    r'<div class="elementor-widget-container">\s*(.*?)\s*</div>\s*</div>',
    re.S)


def main_content(doc):
    doc = re.sub(r'<(script|style|noscript)[^>]*>.*?</\1>', '', doc, flags=re.S | re.I)
    # keep only the <main>/#content region so header, footer and popups drop out
    m = re.search(r'<main[^>]*>(.*?)</main>', doc, re.S | re.I)
    if m:
        doc = m.group(1)
    # drop the sitewide CTA section and the popup form, which repeat on every page
    doc = re.sub(r'<div[^>]+data-elementor-type="popup".*?$', '', doc, flags=re.S | re.I)
    return doc


def page_body(doc):
    """Policy pages use the plain theme template: .page-header h1 + .page-content."""
    h1 = re.search(r'<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>(.*?)</h1>', doc, re.S | re.I)
    body = re.search(r'<div class="page-content">(.*?)</div>\s*</main>', doc, re.S | re.I)
    if not body:
        body = re.search(r'<div class="page-content">(.*)$', doc, re.S | re.I)
    return (text_of(h1.group(1)) if h1 else None,
            body.group(1) if body else '')


def collect(name):
    doc = open(os.path.join(PAGES, name), encoding='utf-8').read()
    heading, frag = page_body(main_content(doc))
    return heading, clean_html(frag)


if __name__ == '__main__':
    out = {}
    for slug, fname in [('privacy-policy', 'privacy-policy.html'),
                        ('terms-conditions', 'terms-conditions.html')]:
        heading, c = collect(fname)
        out[slug] = {'h1': heading, 'body': c}
        heads = re.findall(r'<h([23])>(.*?)</h\1>', c)
        print(f'{slug:20} h1={heading!r:26} {len(c):>7} chars  '
              f'h2={sum(1 for l, _ in heads if l == "2")} '
              f'h3={sum(1 for l, _ in heads if l == "3")}  '
              f'p={c.count("<p>")} li={c.count("<li>")}')
    json.dump(out, open(os.path.join(OUT, 'policies.json'), 'w'), indent=1)
    print('wrote policies.json')
