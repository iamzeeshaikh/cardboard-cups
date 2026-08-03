# Cardboard Cups

Astro rebuild of cardboardcups.com — a quotation site for custom printed
cardboard cups, sleeves and baking cups. 18 products, 3 categories, 28 indexable
pages, no checkout.

Migration background and decisions: [`../MIGRATION_REPORT.md`](../MIGRATION_REPORT.md).

## Requirements

Node 20+ (built and tested on 25.9).

## Getting started

```bash
npm install
cp .env.example .env      # fill in SMTP details before testing the forms
npm run dev               # http://localhost:4321
```

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:4321 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the build (see below) |
| `npm run check` | TypeScript + Astro diagnostics |
| `npm run validate` | 38 post-build checks: URLs, SEO, links, schema, hygiene |
| `npm run audit` | axe-core WCAG 2.2 AA sweep + page weights |
| `npm run interact` | Playwright behavioural tests (nav, tabs, forms) |
| `npm run shots` | Screenshots at 320/375/768/1024/1440 (`--live` to also capture production) |
| `npm run images` | Regenerate WebP renditions + size manifest |

### Local preview

```bash
npm run build
HOST=127.0.0.1 PORT=4321 node ./dist/server/entry.mjs
```

Then open **http://127.0.0.1:4321/**. This standalone server is what serves
`/api/quote/` locally and issues the 301s. The QA scripts expect it on 4321.

## Project layout

```
public/wp-content/uploads/   originals at their exact WordPress URLs + WebP renditions
public/fonts/                self-hosted Nunito Sans (SIL OFL)
src/data/                    products, categories, policies, site config, home copy
src/lib/routes.ts            single source of truth: indexable URLs + redirect map
src/lib/schema.ts            JSON-LD builders
src/pages/api/quote.ts       the only server route
scripts/                     images, validate, audit, interact, shots
deploy/                      vercel.json, _headers, _redirects, nginx.conf, headers.md
reports/                     URL inventory, redirect map, metadata diff, schema report
```

`src/lib/routes.ts` drives the sitemap, the redirects and the validation suite,
so they cannot drift apart. Add a page → add it there.

### Regenerating product data

Product, category and policy JSON is generated from the original WordPress
exports by `../_migration/scripts/build_data.py` and `extract_pages.py`. The
exports are never modified. Re-run after changing either script:

```bash
cd ../_migration/scripts && python3 build_data.py && python3 extract_pages.py
```

**The generated JSON is committed**, so the site clones and builds without the
exports present. You only need them if you want to re-derive the data.

### What is deliberately not in this repository

This repo is public, so the following stay local (see `.gitignore`):

| Excluded | Reason |
| --- | --- |
| `localhost.sql` | Full WordPress dump — contains bcrypt password hashes for the `webmaster` and `orion95436` accounts and personal email addresses |
| `cardboardcups.WordPress.*.xml` | WXR exports embed the site owner's personal email |
| `cardboard 1.png`, `cardboard 2.png` | ~30 MB reference screenshots |
| `_migration/{media,crawl,qa,ref}/` | Cached copies of the live site, QA screenshots, and a duplicate of the images already committed under `public/` |
| `*-<width>w.webp` | Regenerated from the originals by `npm run build` |

Keep `localhost.sql` in offline backup for at least 90 days — the rollback plan
depends on it. If you need the exports in version control, make the repository
private first.

## Forms

One component (`QuoteForm.astro`) in two variants — `compact` (hero, product
sidebar) and `full` (contact and quote pages, adds phone + artwork upload). On
product pages the Product field is pre-filled; `/get-free-quote/?product=…`
pre-fills it too.

Posts to `/api/quote/`, which:

* validates on the server as well as the client (name, email format, message ≥ 10 chars)
* rejects bot submissions via an off-screen honeypot (`company_url`)
* rate-limits to 5 submissions per IP per 10 minutes
* accepts only PDF, PNG, JPG, WebP, AI, EPS, SVG up to 8 MB, checks magic bytes
  so a renamed executable cannot pass, sanitises the filename, and rejects SVGs
  containing script
* strips CR/LF from anything used in a mail header
* **only reports success when the SMTP server accepts the message** — a missing
  or broken SMTP config returns an error, never a false confirmation

Works without JavaScript (normal POST → `?sent=1` / `?error=1`). With JS it
posts via `fetch` and shows an `aria-live` status message.

### SMTP configuration

Copy `.env.example` to `.env` and set:

```
SMTP_HOST=          # e.g. smtp.your-provider.com
SMTP_PORT=587       # 465 switches to implicit TLS automatically
SMTP_USER=
SMTP_PASS=
SMTP_TO=            # where enquiries land
SMTP_FROM_NAME=     # e.g. Cardboard Cups Website
SMTP_FROM_EMAIL=    # must be a domain the SMTP account may send as
```

`.env` is gitignored. Set the same variables in your host's dashboard for
production. They are read server-side only and never reach the browser bundle —
`npm run validate` fails the build if a credential name appears in output HTML.

Verify delivery end-to-end without a real mailbox:

```bash
python3 ../_migration/scripts/smtp_sink.py 2525 /tmp/capture.txt   # terminal 1
SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=u SMTP_PASS=p \
  SMTP_TO=you@example.com SMTP_FROM_EMAIL=site@cardboardcups.com \
  node ./dist/server/entry.mjs                                     # terminal 2
```

Submit the form, then read `/tmp/capture.txt`.

## Deployment

Nothing is deployed and no DNS has been changed. When you are ready:

1. **Build and verify**
   ```bash
   npm ci && npm run build
   npm run validate && npm run check && npm audit
   HOST=127.0.0.1 PORT=4321 node ./dist/server/entry.mjs &
   npm run audit && npm run interact
   ```
   All must pass before going further.

2. **Set environment variables** (the seven `SMTP_*` above) on the host.

3. **Deploy to a staging URL first.** Confirm: homepage renders, a product page
   renders, a form submission actually arrives, `/sitemap.xml` and `/robots.txt`
   resolve, and an unknown URL returns 404.

4. **Apply the host config** from `deploy/` — `vercel.json`, or `_headers` +
   `_redirects` for Netlify, or `nginx.conf`. These carry the security headers
   and the HTTPS / www / trailing-slash redirects that the app cannot set for
   prerendered pages. See `deploy/headers.md`.

5. **Point DNS** at the new host. Keep the WordPress origin running and
   reachable until step 7 is clean.

6. **Immediately after cutover**, confirm on the live domain:
   ```bash
   curl -sI https://cardboardcups.com/product/cardboard-coffee-cups/ | head -1   # 200
   curl -sI https://cardboardcups.com/cart/ | head -2                            # 301 -> /get-free-quote/
   curl -sI https://www.cardboardcups.com/ | head -2                             # 301 -> non-www
   curl -sI https://cardboardcups.com/nope/ | head -1                            # 404
   curl -s  https://cardboardcups.com/sitemap.xml | grep -c '<loc>'              # 28
   ```

7. **Post-launch checklist**
   - [ ] Submit a real enquiry from a product page; confirm it arrives with the
         product name in the subject and a working Reply-To
   - [ ] Submit with an 8 MB+ file and a `.exe` renamed to `.pdf`; both rejected
   - [ ] Google Search Console: resubmit `https://cardboardcups.com/sitemap.xml`
   - [ ] Search Console → Removals: none needed; check Coverage after 48 h
   - [ ] Rich Results Test on one product, one category and the homepage
   - [ ] Confirm no `Product` rich result claims a price or rating
   - [ ] PageSpeed Insights on homepage + one product page (mobile)
   - [ ] Watch Search Console Pages report for 7–14 days for unexpected 404s
   - [ ] Check server logs for 404s on old URLs not covered by the redirect map,
         and add redirects to `src/lib/routes.ts` if a real one appears
   - [ ] Keep the WordPress DB backup (`localhost.sql`) for at least 90 days

## Rollback

The old site is untouched by this project, so rollback is a DNS change.

1. **Fastest (< TTL):** point the A/CNAME record back at the WordPress host.
   Lower the TTL to 300 s *before* cutover so this is quick.
2. The WordPress install, its database and `wp-content/uploads` are unmodified —
   nothing needs restoring. If the origin was decommissioned, restore
   `localhost.sql` and the uploads directory from the supplied exports.
3. If only the forms are broken, the rest of the site still works; fix the SMTP
   variables rather than rolling back the whole site.
4. If a specific redirect is wrong, edit `REDIRECTS` in `src/lib/routes.ts` plus
   the matching entry in `deploy/`, rebuild and redeploy — no rollback needed.

**Do not** delete the WordPress origin or the supplied exports until the new
site has served clean traffic for at least 30 days.

## Notes

- Trailing slashes are enforced everywhere (`trailingSlash: 'always'`).
- The site is statically prerendered; only `/api/quote/` runs on demand.
- Astro's origin check rejects cross-origin POSTs to the API — expected, and
  why `curl` without an `Origin` header gets a 403.
- Colour contrast fixes are documented in the migration report §3.6, including
  how to revert them (which would reintroduce a WCAG AA failure).
