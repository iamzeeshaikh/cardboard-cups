/**
 * Smoke-tests a deployed URL: status codes, redirects, security headers and
 * sitemap integrity. Run against a preview or production deployment.
 *
 *   node scripts/smoke.mjs https://cardboard-cups.vercel.app
 *
 * Exists because the local build can be correct while the host's routing is
 * not — the trailing-slash redirects 404'd on Vercel while passing locally.
 */
const BASE = (process.argv[2] ?? process.env.BASE ?? 'http://127.0.0.1:4401').replace(/\/$/, '');

const { INDEXABLE, REDIRECTS, NOINDEX_PAGES } = await import('../src/lib/routes.ts');

const results = [];
const check = (name, ok, detail = '') => results.push([name, ok, detail]);

async function head(path) {
  const res = await fetch(BASE + path, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), headers: res.headers };
}

// ---- every indexable URL is a direct 200 ---------------------------------
const bad200 = [];
for (const path of INDEXABLE) {
  const { status } = await head(path);
  if (status !== 200) bad200.push(`${path} -> ${status}`);
}
check(`all ${INDEXABLE.length} indexable URLs return 200`, bad200.length === 0, bad200.join('; '));

// ---- utility pages resolve but are noindex --------------------------------
for (const path of NOINDEX_PAGES) {
  if (path === '/404/') continue;
  const res = await fetch(BASE + path);
  const html = await res.text();
  check(`${path} resolves and is noindex`,
    res.ok && /<meta name="robots" content="[^"]*noindex/i.test(html));
}

// ---- redirects are single-hop 301s to the right place ---------------------
for (const [from, to] of Object.entries(REDIRECTS)) {
  const noSlash = from.replace(/\/$/, '');
  for (const variant of [from, noSlash]) {
    const r = await head(variant);
    const dest = r.location ? new URL(r.location, BASE).pathname : null;
    const ok = [301, 308].includes(r.status) && dest === to;
    check(`${variant} -> ${to}`, ok, `got ${r.status} ${dest ?? '(no location)'}`);
    // and the destination must itself be a 200, not another redirect
    if (ok) {
      const final = await head(to);
      check(`  ${to} is a direct 200 (no chain)`, final.status === 200, `got ${final.status}`);
    }
  }
}

// ---- trailing slash is enforced -------------------------------------------
const slash = await head('/about-us');
check('/about-us -> /about-us/', [301, 308].includes(slash.status) &&
  new URL(slash.location, BASE).pathname === '/about-us/', `got ${slash.status}`);

// ---- unknown URLs are a genuine 404 ---------------------------------------
for (const path of ['/nope-xyz/', '/product/not-real/', '/wp-admin/', '/product-category/uncategorized/']) {
  const { status } = await head(path);
  check(`${path} returns 404`, status === 404, `got ${status}`);
}

// ---- security headers ------------------------------------------------------
const { headers } = await head('/');
for (const h of ['content-security-policy', 'strict-transport-security', 'x-content-type-options',
                 'referrer-policy', 'permissions-policy', 'x-frame-options']) {
  check(`header ${h}`, !!headers.get(h), 'missing');
}

// ---- sitemap ---------------------------------------------------------------
const sm = await fetch(`${BASE}/sitemap.xml`);
const xml = await sm.text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check('sitemap lists every indexable URL', locs.length === INDEXABLE.length,
  `${locs.length} vs ${INDEXABLE.length}`);
check('sitemap uses the production hostname',
  locs.every((u) => u.startsWith('https://cardboardcups.com/')));
check('robots.txt points at the sitemap',
  (await (await fetch(`${BASE}/robots.txt`)).text()).includes('sitemap.xml'));

// ---- the enquiry endpoint is wired up --------------------------------------
const api = await fetch(`${BASE}/api/quote/`, { method: 'GET' });
check('/api/quote/ rejects GET with 405', api.status === 405, `got ${api.status}`);

// ---- report ----------------------------------------------------------------
let failed = 0;
console.log(`\n  smoke test: ${BASE}\n`);
for (const [name, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}
console.log(`\n  ${results.length - failed}/${results.length} checks passed\n`);
process.exit(failed ? 1 : 0);
