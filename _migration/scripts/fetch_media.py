"""Download every original upload listed in the media inventory, preserving filenames."""
import json
import os
import time
import urllib.request
import urllib.error

HERE = os.path.dirname(__file__)
INV = os.path.join(HERE, '..', 'audit', 'media-inventory.json')
DEST = os.path.join(HERE, '..', 'media')
BASE = 'https://cardboardcups.com'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

inv = json.load(open(INV))
os.makedirs(DEST, exist_ok=True)
report = {'ok': [], 'failed': []}

for rec in inv['images']:
    path = rec['path']
    out = os.path.join(DEST, path.lstrip('/'))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if os.path.exists(out) and os.path.getsize(out) > 0:
        report['ok'].append(path)
        continue
    req = urllib.request.Request(BASE + path, headers={'User-Agent': UA, 'Referer': BASE + '/'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        if not data:
            raise ValueError('empty body')
        with open(out, 'wb') as fh:
            fh.write(data)
        report['ok'].append(path)
        print(f'ok   {len(data):>9,}  {path}', flush=True)
    except Exception as e:  # noqa: BLE001
        code = getattr(e, 'code', type(e).__name__)
        report['failed'].append({'path': path, 'error': str(code)})
        print(f'FAIL {code}  {path}', flush=True)
    time.sleep(0.25)

json.dump(report, open(os.path.join(HERE, '..', 'audit', 'media-download.json'), 'w'), indent=1)
print(f'\ndownloaded {len(report["ok"])}  failed {len(report["failed"])}')
