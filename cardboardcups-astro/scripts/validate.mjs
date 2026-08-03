/**
 * Post-build validation. Reads dist/client and asserts URL parity, SEO
 * integrity, link/image health, schema validity and content hygiene.
 *
 * Exits non-zero if any FAIL is recorded.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist', 'client');
const SITE = 'https://cardboardcups.com';

const { INDEXABLE, REDIRECTS, NOINDEX_PAGES } = await import('../src/lib/routes.ts');
const products = JSON.parse(await readFile(path.join(ROOT, 'src/data/products.json'), 'utf8'));
const categories = JSON.parse(await readFile(path.join(ROOT, 'src/data/categories.json'), 'utf8'));

const results = [];
const check = (name, ok, detail = '') =>
  results.push({ name, ok, detail: Array.isArray(detail) ? detail.slice(0, 8).join('; ') : detail,
                 count: Array.isArray(detail) ? detail.length : 0 });

// ---------------------------------------------------------------- load pages

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = await walk(DIST);
const pages = new Map();
for (const file of files) {
  const rel = '/' + path.relative(DIST, file).split(path.sep).join('/');
  const url = rel === '/404.html' ? '/404/' : rel.replace(/index\.html$/, '');
  pages.set(url, { file, html: await readFile(file, 'utf8') });
}

const one = (html, re) => (html.match(re) ?? [])[1]?.trim();
const all = (html, re) => [...html.matchAll(re)].map((m) => m[1]);
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

const bodyOf = (html) => {
  const b = html.split('</head>')[1] ?? html;
  return b.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '');
};

// ---------------------------------------------------------------- 1. URL parity

const built = [...pages.keys()];
const missing = INDEXABLE.filter((u) => !pages.has(u));
check('every indexable URL was built', missing.length === 0, missing);

const orphan = built.filter((u) => !NOINDEX_PAGES.includes(u) && !INDEXABLE.includes(u));
check('no unexpected extra pages built', orphan.length === 0, orphan);

check('utility pages are built but never indexable',
  NOINDEX_PAGES.every((u) => pages.has(u) && !INDEXABLE.includes(u)),
  NOINDEX_PAGES.filter((u) => !pages.has(u) || INDEXABLE.includes(u)));

check('redirect sources are not also built as pages',
  Object.keys(REDIRECTS).every((u) => !pages.has(u)),
  Object.keys(REDIRECTS).filter((u) => pages.has(u)));

const redirectTargetsResolve = Object.values(REDIRECTS).filter((t) => !pages.has(t));
check('every redirect target is a real 200 page', redirectTargetsResolve.length === 0, redirectTargetsResolve);

check('no redirect chains (targets are never themselves sources)',
  Object.values(REDIRECTS).every((t) => !(t in REDIRECTS)),
  Object.values(REDIRECTS).filter((t) => t in REDIRECTS));

// ---------------------------------------------------------------- 2. head metadata

const canonicals = new Map();
const titleProblems = [], descProblems = [], canonProblems = [], h1Problems = [], robotsProblems = [];

for (const [url, { html }] of pages) {
  const indexable = INDEXABLE.includes(url);
  const title = one(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = one(html, /<meta name="description" content="([^"]*)"/i);
  const canon = all(html, /<link rel="canonical" href="([^"]+)"/gi);
  const robots = one(html, /<meta name="robots" content="([^"]*)"/i);
  const h1s = all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(strip).filter(Boolean);

  if (!title || title.length < 10) titleProblems.push(`${url} (${title ?? 'none'})`);
  if (!desc || desc.length < 50) descProblems.push(`${url} (${desc?.length ?? 0} chars)`);
  if (canon.length !== 1) canonProblems.push(`${url} has ${canon.length} canonicals`);
  else {
    if (!canon[0].startsWith(SITE)) canonProblems.push(`${url} -> ${canon[0]}`);
    if (canonicals.has(canon[0])) canonProblems.push(`duplicate canonical ${canon[0]} on ${url}`);
    canonicals.set(canon[0], url);
    const expected = new URL(url, SITE).href;
    if (indexable && canon[0] !== expected) canonProblems.push(`${url} canonical ${canon[0]} != ${expected}`);
  }
  if (h1s.length !== 1) h1Problems.push(`${url} has ${h1s.length} h1`);
  if (indexable && /noindex/i.test(robots ?? '')) robotsProblems.push(url);
  if (NOINDEX_PAGES.includes(url) && !/noindex/i.test(robots ?? '')) {
    robotsProblems.push(`${url} is missing noindex`);
  }
}

check('every page has a usable <title>', titleProblems.length === 0, titleProblems);
check('every page has a meta description of 50+ chars', descProblems.length === 0, descProblems);
check('exactly one valid, unique canonical per page', canonProblems.length === 0, canonProblems);
check('exactly one H1 per page', h1Problems.length === 0, h1Problems);
check('noindex only on utility pages, never on content', robotsProblems.length === 0, robotsProblems);

const ogProblems = [];
for (const [url, { html }] of pages) {
  for (const tag of ['og:title', 'og:description', 'og:url', 'og:type']) {
    if (!html.includes(`property="${tag}"`)) ogProblems.push(`${url} missing ${tag}`);
  }
  if (!html.includes('name="twitter:card"')) ogProblems.push(`${url} missing twitter:card`);
}
check('Open Graph and Twitter tags present', ogProblems.length === 0, ogProblems);

// ---------------------------------------------------------------- 3. links & images

const badLinks = [], badImages = [], unsafeExternal = [];
const assetExists = (p) => existsSync(path.join(DIST, decodeURIComponent(p).replace(/^\//, '')));

for (const [url, { html }] of pages) {
  const body = bodyOf(html);

  for (const href of all(body, /<a[^>]+href="([^"]+)"/gi)) {
    if (/^(#|mailto:|tel:|https?:\/\/(?!cardboardcups\.com))/i.test(href)) continue;
    const clean = href.replace(SITE, '').split('#')[0].split('?')[0];
    if (!clean || clean.startsWith('//')) continue;
    if (!clean.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(clean)) {
      badLinks.push(`${url} -> ${href} (no trailing slash)`);
      continue;
    }
    if (pages.has(clean) || clean in REDIRECTS || assetExists(clean)) {
      if (clean in REDIRECTS) badLinks.push(`${url} -> ${href} (links to a redirect)`);
      continue;
    }
    badLinks.push(`${url} -> ${href}`);
  }

  for (const m of body.matchAll(/<(img|source)[^>]*>/gi)) {
    const tag = m[0];
    for (const attr of ['src', 'srcset']) {
      const v = tag.match(new RegExp(`\\s${attr}="([^"]+)"`))?.[1];
      if (!v) continue;
      for (const cand of v.split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean)) {
        if (/^(https?:|data:)/i.test(cand)) { badImages.push(`${url} remote ${cand}`); continue; }
        if (!assetExists(cand)) badImages.push(`${url} missing ${cand}`);
      }
    }
    if (m[1].toLowerCase() === 'img') {
      // A bare `alt` is HTML's empty alt — correct for decorative images.
      if (!/\salt(?:="|[\s>/])/.test(tag)) badImages.push(`${url} img without alt: ${tag.slice(0, 90)}`);
      if (!/\swidth="\d/.test(tag) || !/\sheight="\d/.test(tag)) {
        badImages.push(`${url} img without dimensions: ${tag.slice(0, 90)}`);
      }
    }
  }

  for (const m of body.matchAll(/<a[^>]+target="_blank"[^>]*>/gi)) {
    if (!/rel="[^"]*noopener/i.test(m[0])) unsafeExternal.push(`${url} ${m[0].slice(0, 80)}`);
  }
}

check('no broken internal links', badLinks.length === 0, badLinks);
check('no broken, remote or undimensioned images', badImages.length === 0, badImages);
check('external links carry rel="noopener"', unsafeExternal.length === 0, unsafeExternal);

// ---------------------------------------------------------------- 4. sitemap & robots

const sitemap = await readFile(path.join(DIST, 'sitemap.xml'), 'utf8');
const sitemapUrls = all(sitemap, /<loc>([^<]+)<\/loc>/g);
const sitemapPaths = sitemapUrls.map((u) => u.replace(SITE, ''));

check('sitemap exists at /sitemap.xml', sitemapUrls.length > 0);
check('sitemap has no duplicates', new Set(sitemapUrls).size === sitemapUrls.length);
check('every sitemap URL is a built 200 page',
  sitemapPaths.every((p) => pages.has(p)), sitemapPaths.filter((p) => !pages.has(p)));
check('sitemap covers every indexable URL',
  INDEXABLE.every((u) => sitemapPaths.includes(u)), INDEXABLE.filter((u) => !sitemapPaths.includes(u)));
check('sitemap excludes redirects, utility pages and the API',
  !sitemapPaths.some((p) => p in REDIRECTS || NOINDEX_PAGES.includes(p) || p.startsWith('/api')),
  sitemapPaths.filter((p) => p in REDIRECTS || NOINDEX_PAGES.includes(p) || p.startsWith('/api')));
check('sitemap URLs all use https and a trailing slash',
  sitemapUrls.every((u) => u.startsWith('https://') && (u.endsWith('/') || u.endsWith('.xml'))));

const robots = await readFile(path.join(DIST, 'robots.txt'), 'utf8');
check('robots.txt references the sitemap', robots.includes(`${SITE}/sitemap.xml`));
check('robots.txt does not block CSS/JS/images',
  !/Disallow:\s*\/(wp-content|assets|_astro|.*\.(css|js|jpg|png|webp))/i.test(robots));

// ---------------------------------------------------------------- 5. structured data

const schemaProblems = [], faqMismatch = [];
for (const [url, { html }] of pages) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const types = [];
  for (const b of blocks) {
    let json;
    try { json = JSON.parse(b[1]); }
    catch (e) { schemaProblems.push(`${url} unparseable JSON-LD: ${e.message}`); continue; }
    const nodes = Array.isArray(json) ? json : [json];
    for (const n of nodes) {
      types.push(n['@type']);
      const text = JSON.stringify(n);
      for (const banned of ['aggregateRating', '"review"', 'ratingValue', 'reviewCount', 'priceValidUntil']) {
        if (text.includes(banned)) schemaProblems.push(`${url} schema contains ${banned}`);
      }
      if (n['@type'] === 'Product' && n.offers?.price !== undefined) {
        schemaProblems.push(`${url} Product offer claims a price`);
      }
    }
  }
  if (types.filter((t) => t === 'Product').length > 1) schemaProblems.push(`${url} has duplicate Product schema`);

  // FAQ schema must match the FAQs actually rendered on the page.
  const faqBlock = blocks.map((b) => { try { return JSON.parse(b[1]); } catch { return null; } })
    .find((j) => j && j['@type'] === 'FAQPage');
  if (faqBlock) {
    const body = strip(bodyOf(html));
    const absent = faqBlock.mainEntity
      .map((q) => q.name)
      .filter((q) => !body.includes(strip(q)));
    if (absent.length) faqMismatch.push(`${url}: ${absent.length} FAQ question(s) not visible`);
  }
}
check('all JSON-LD parses and invents no ratings, reviews or prices', schemaProblems.length === 0, schemaProblems);
check('FAQ schema matches the visible FAQs', faqMismatch.length === 0, faqMismatch);

check('every product page carries Product schema',
  products.every((p) => pages.get(p.url)?.html.includes('"@type":"Product"')),
  products.filter((p) => !pages.get(p.url)?.html.includes('"@type":"Product"')).map((p) => p.url));

// ---------------------------------------------------------------- 6. content hygiene

const placeholders = [/lorem ipsum/i, /\bTODO\b/, /\bFIXME\b/, /\bplaceholder text\b/i, /\bXXX\b/];
const dupHeading = [], placeholderHits = [], hostLeaks = [], secretLeaks = [];

for (const [url, { html }] of pages) {
  const body = bodyOf(html);
  const headings = all(body, /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi).map((h) => strip(h).toLowerCase());
  for (const label of ['description', 'related products', 'specifications', 'faqs']) {
    if (headings.filter((h) => h === label).length > 1) dupHeading.push(`${url}: duplicate "${label}"`);
  }
  for (const re of placeholders) if (re.test(body)) placeholderHits.push(`${url} ${re}`);
  for (const re of [/localhost:\d+/, /127\.0\.0\.1/, /\.vercel\.app/, /\.netlify\.app/, /cardboardcups\.local/]) {
    if (re.test(html)) hostLeaks.push(`${url} ${re}`);
  }
  for (const re of [/SMTP_PASS/, /SMTP_USER/, /password\s*[:=]\s*["'][^"']{4,}/i, /api[_-]?key\s*[:=]/i]) {
    if (re.test(html)) secretLeaks.push(`${url} ${re}`);
  }
}
check('no duplicate Description / Related Products / Specifications / Faqs headings',
  dupHeading.length === 0, dupHeading);
check('no placeholder text in output', placeholderHits.length === 0, placeholderHits);
check('no development hostname in output', hostLeaks.length === 0, hostLeaks);
check('no credentials in built output', secretLeaks.length === 0, secretLeaks);

// WordPress residue
const residue = [];
for (const [url, { html }] of pages) {
  for (const re of [/\[\/?[a-z_]+[^\]]*\]/i, /data-elementor/i, /elementor-widget/i, /wp-block-/i, /data-message-author-role/i, /class="markdown/i]) {
    if (re.test(bodyOf(html))) residue.push(`${url} ${re}`);
  }
}
check('no WordPress/Elementor/builder residue in markup', residue.length === 0, residue);

// ---------------------------------------------------------------- 7. catalogue integrity

check('no duplicate product slugs', new Set(products.map((p) => p.slug)).size === products.length);
check('no duplicate product SKUs', new Set(products.map((p) => p.sku)).size === products.length);
check('every product belongs to a known category',
  products.every((p) => categories.some((c) => c.slug === p.category)),
  products.filter((p) => !categories.some((c) => c.slug === p.category)).map((p) => p.name));
check('every category lists only real products',
  categories.every((c) => c.products.every((s) => products.some((p) => p.slug === s))));
check('every product is reachable from a category page',
  products.every((p) => categories.some((c) => c.products.includes(p.slug))),
  products.filter((p) => !categories.some((c) => c.products.includes(p.slug))).map((p) => p.slug));
check('every product has at least one image', products.every((p) => p.images.length > 0),
  products.filter((p) => !p.images.length).map((p) => p.slug));
check('related products never point at themselves',
  products.every((p) => !p.related.includes(p.slug)),
  products.filter((p) => p.related.includes(p.slug)).map((p) => p.slug));

// every product must be internally linked from somewhere other than its own page
const linkedFrom = new Map(products.map((p) => [p.url, 0]));
for (const [url, { html }] of pages) {
  for (const href of new Set(all(bodyOf(html), /<a[^>]+href="([^"]+)"/gi))) {
    const clean = href.replace(SITE, '').split('#')[0].split('?')[0];
    if (linkedFrom.has(clean) && clean !== url) linkedFrom.set(clean, linkedFrom.get(clean) + 1);
  }
}
const unlinked = [...linkedFrom].filter(([, n]) => n === 0).map(([u]) => u);
check('every product is internally linked', unlinked.length === 0, unlinked);

// ---------------------------------------------------------------- report

const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
let failed = 0;
console.log(`\n  validating ${pages.size} built pages\n`);
for (const r of results) {
  if (!r.ok) failed++;
  const tag = r.ok ? '  PASS' : '  FAIL';
  console.log(`${tag}  ${pad(r.name, 62)}${r.ok ? '' : `\n         ${r.count ? `(${r.count}) ` : ''}${r.detail}`}`);
}
console.log(`\n  ${results.length - failed}/${results.length} checks passed\n`);
process.exit(failed ? 1 : 0);
