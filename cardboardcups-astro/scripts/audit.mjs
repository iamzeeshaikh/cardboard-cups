/**
 * Accessibility (axe-core, WCAG 2.2 AA) and page-weight audit against the
 * running build. Exits non-zero on any serious/critical a11y violation.
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4401';
const AXE = path.join(import.meta.dirname, '..', 'node_modules', 'axe-core', 'axe.min.js');
const axeSource = await readFile(AXE, 'utf8');

const ROUTES = [
  ['home', '/'],
  ['shop', '/shop/'],
  ['category', '/product-category/cup-types/'],
  ['product', '/product/cardboard-cups-for-hot-drinks/'],
  ['about', '/about-us/'],
  ['contact', '/contact-us/'],
  ['quote', '/get-free-quote/'],
  ['privacy', '/privacy-policy/'],
  ['terms', '/terms-conditions/'],
];

const browser = await chromium.launch();
let serious = 0;
const weights = [];

for (const [label, route] of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const bytes = { total: 0, js: 0, css: 0, img: 0, font: 0, html: 0 };
  page.on('response', async (res) => {
    try {
      const buf = await res.body();
      const type = res.request().resourceType();
      bytes.total += buf.length;
      if (type === 'script') bytes.js += buf.length;
      else if (type === 'stylesheet') bytes.css += buf.length;
      else if (type === 'image') bytes.img += buf.length;
      else if (type === 'font') bytes.font += buf.length;
      else if (type === 'document') bytes.html += buf.length;
    } catch { /* redirects and aborted requests have no body */ }
  });

  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 });
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () =>
    // @ts-ignore - axe is injected above
    await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    }),
  );

  const bad = result.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  const minor = result.violations.filter((v) => !['serious', 'critical'].includes(v.impact));
  serious += bad.length;
  weights.push({ label, ...bytes });

  const kb = (n) => `${(n / 1024).toFixed(0)}kB`;
  console.log(
    `${label.padEnd(9)} a11y: ${bad.length ? `${bad.length} SERIOUS` : 'clean'}` +
    `${minor.length ? ` (+${minor.length} minor)` : ''}` +
    `   weight ${kb(bytes.total).padStart(6)}  js ${kb(bytes.js)}  css ${kb(bytes.css)}  img ${kb(bytes.img)}  font ${kb(bytes.font)}`,
  );
  for (const v of bad) {
    console.log(`   ✗ [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) console.log(`       ${n.html.slice(0, 120)}`);
  }
  for (const v of minor) console.log(`   · [${v.impact}] ${v.id}: ${v.help}`);

  await page.close();
}

await browser.close();

const avgJs = weights.reduce((s, w) => s + w.js, 0) / weights.length;
console.log(`\naverage JavaScript per page: ${(avgJs / 1024).toFixed(1)} kB`);
console.log(serious ? `\n${serious} serious/critical a11y violation(s)` : '\nno serious or critical a11y violations');
process.exit(serious ? 1 : 0);
