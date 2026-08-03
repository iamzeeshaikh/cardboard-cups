"""Crawl the live cardboardcups.com site and cache raw HTML for every reachable URL."""
import os
import re
import sys
import time
import urllib.parse as up
import urllib.request
import gzip
import io

BASE = 'https://cardboardcups.com'
OUT = os.path.join(os.path.dirname(__file__), '..', 'crawl', 'pages')
os.makedirs(OUT, exist_ok=True)

HEADERS = {
    'User-Agent': ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                   '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1',
}

SKIP_EXT = re.compile(r'\.(jpg|jpeg|png|gif|webp|svg|css|js|ico|pdf|zip|woff2?|ttf|mp4)$', re.I)
SKIP_PATH = re.compile(r'/(wp-admin|wp-json|wp-content|wp-includes|feed|xmlrpc|comments)', re.I)


def fname(url):
    p = up.urlsplit(url).path
    slug = p.strip('/').replace('/', '__') or 'index'
    return os.path.join(OUT, slug + '.html')


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            raw = r.read()
            if r.headers.get('Content-Encoding') == 'gzip':
                raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
            return r.status, r.geturl(), raw.decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, url, ''
    except Exception as e:  # noqa: BLE001
        return 0, url, f'ERROR {e}'


def norm(href, cur):
    if not href or href.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'data:')):
        return None
    u = up.urljoin(cur, href)
    s = up.urlsplit(u)
    if s.netloc not in ('cardboardcups.com', 'www.cardboardcups.com'):
        return None
    if SKIP_EXT.search(s.path) or SKIP_PATH.search(s.path):
        return None
    path = s.path
    if not path.endswith('/'):
        path += '/'
    return up.urlunsplit(('https', 'cardboardcups.com', path, '', ''))


def main(seeds):
    seen, queue, log = set(), list(seeds), []
    while queue:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        status, final, html = fetch(url)
        log.append((url, status, final))
        print(f'{status} {url}' + (f'  -> {final}' if final.rstrip("/") != url.rstrip("/") else ''),
              flush=True)
        if status == 200 and html:
            with open(fname(url), 'w', encoding='utf-8') as fh:
                fh.write(html)
            for href in re.findall(r'<a[^>]+href=["\']([^"\']+)["\']', html, re.I):
                n = norm(href, url)
                if n and n not in seen:
                    queue.append(n)
        time.sleep(0.7)
    with open(os.path.join(OUT, '..', 'crawl-log.tsv'), 'w') as fh:
        for u, s, f in log:
            fh.write(f'{u}\t{s}\t{f}\n')
    print(f'\ncrawled {len(seen)} urls')


if __name__ == '__main__':
    main(sys.argv[1:] or [BASE + '/'])
