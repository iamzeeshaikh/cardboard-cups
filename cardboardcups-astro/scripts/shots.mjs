/**
 * Screenshots the local build at the required breakpoints, and (with --live)
 * the same routes on the production site for side-by-side comparison.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, '..', '_migration', 'qa');
const LOCAL = process.env.BASE ?? 'http://127.0.0.1:4321';
const LIVE = 'https://cardboardcups.com';

const WIDTHS = [320, 375, 768, 1024, 1440];
const ROUTES = [
  ['home', '/'],
  ['category', '/product-category/cup-types/'],
  ['product', '/product/cardboard-cups-for-hot-drinks/'],
  ['contact', '/contact-us/'],
  ['about', '/about-us/'],
  ['quote', '/get-free-quote/'],
  ['shop', '/shop/'],
  ['privacy', '/privacy-policy/'],
  ['404', '/this-page-does-not-exist/'],
];

const args = process.argv.slice(2);
const doLive = args.includes('--live');
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const fullPage = !args.includes('--viewport');

const browser = await chromium.launch();

async function shoot(label, base, route, width, dir) {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });
  try {
    const res = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 });
    // force lazy images to resolve before capturing a full-page shot
    await page.evaluate(async () => {
      await new Promise((r) => {
        let y = 0;
        const step = () => {
          window.scrollTo(0, y);
          y += window.innerHeight;
          if (y < document.body.scrollHeight) setTimeout(step, 60);
          else { window.scrollTo(0, 0); setTimeout(r, 300); }
        };
        step();
      });
    });
    await page.waitForTimeout(400);
    const file = path.join(dir, `${label}-${width}.png`);
    await page.screenshot({ path: file, fullPage });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(
      `${String(res?.status() ?? '---').padEnd(4)} ${String(width).padEnd(5)} ${label.padEnd(10)}` +
      (overflow > 1 ? `  ⚠ horizontal overflow ${overflow}px` : ''),
    );
    return { label, width, status: res?.status(), overflow };
  } finally {
    await page.close();
  }
}

const report = [];
for (const [target, base] of doLive ? [['live', LIVE], ['local', LOCAL]] : [['local', LOCAL]]) {
  const dir = path.join(OUT, target);
  await mkdir(dir, { recursive: true });
  console.log(`\n--- ${target} (${base}) ---`);
  for (const [label, route] of ROUTES) {
    if (only && label !== only) continue;
    if (target === 'live' && label === '404') continue;
    for (const width of WIDTHS) {
      try {
        report.push({ target, ...(await shoot(label, base, route, width, dir)) });
      } catch (e) {
        console.log(`ERR  ${width} ${label}: ${e.message.split('\n')[0]}`);
      }
    }
  }
}

await browser.close();

const overflows = report.filter((r) => r.overflow > 1);
console.log(
  overflows.length
    ? `\n${overflows.length} viewport(s) overflow horizontally:\n` +
      overflows.map((o) => `  ${o.target} ${o.label} @ ${o.width}px  +${o.overflow}px`).join('\n')
    : '\nno horizontal overflow at any breakpoint',
);
