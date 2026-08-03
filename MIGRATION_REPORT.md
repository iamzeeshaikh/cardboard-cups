# cardboardcups.com — WordPress/WooCommerce → Astro migration report

**Date:** 3 August 2026
**Source:** WordPress 6.x + WooCommerce 10.9.4 + Elementor Pro 3.34.3 (Hello Elementor theme)
**Target:** Astro 7.1.6, TypeScript, static prerender + one server route
**Status:** Built and verified locally. **Not deployed.** No DNS changed.

---

## 1. Migration summary

| Metric | Count |
| --- | ---: |
| Pages migrated (200) | **28** |
| URLs unchanged | **27** |
| Products migrated | **18** |
| Product categories migrated | **3** |
| Original images migrated | **123** |
| WebP renditions generated | **328** |
| Product FAQs migrated | **270** |
| Specification tables migrated | **18** |
| 301 redirects created | **5** |
| Pages deliberately not recreated | 3 (see §4) |
| Unresolved items | **1** (see §9) |

Automated checks: **38/38 validation**, **20/20 interaction**, **0 serious/critical
accessibility violations** across 9 templates, **0 npm vulnerabilities**,
**0 TypeScript errors**.

---

## 2. What was in the supplied folder

| File | Contents | Use |
| --- | --- | --- |
| `cardboardcups.WordPress.2026-07-30.xml` | Full WXR: 18 products, 10 pages, 23 nav items, 112 attachments, 7 Elementor templates | Nav structure, page inventory, term taxonomy |
| `cardboardcups.WordPress.2026-07-30 2.xml` | Media-only WXR: 112 attachments | **Image alt text** (98 of 124 had real alt) |
| `wc-product-export-…csv` | 18 products with Yoast meta, `_bhww_specifications_wysiwyg`, `_bhww_faqs_wysiwyg`, SASWP schema | Product copy, specs, FAQs, SKUs |
| `localhost.sql` | 13.6 MB full DB dump (71 tables) | **`dtz_yoast_indexable`** (titles/descriptions), `dtz_options`, `dtz_postmeta` (Elementor design tokens) |
| `cardboard 1.png`, `cardboard 2.png` | Full-page screenshots, 3420 px wide | Visual reference for homepage and product template |
| `logo.png` | Site logo | Confirmed against the live upload |

**No `wp-content/uploads` folder was supplied.** All 124 referenced originals were
recovered by downloading them from the live site; 123 succeeded (see §9).

Every supplied file is untouched and still in the folder root. All working
artefacts live in `_migration/`, and the site in `cardboardcups-astro/`.

---

## 3. Defects found on the live site (and how they were handled)

These were discovered during the audit. Each is a genuine correctness, SEO or
accessibility problem, so each was fixed rather than reproduced.

### 3.1 Two conflicting Product schemas with invented reviews — **removed**

Every product page emitted **two** `Product` JSON-LD graphs carrying
contradictory, fabricated review data:

| Source | ratingValue | reviewCount | Author |
| --- | --- | --- | --- |
| WooCommerce/Yoast graph | 5 | 1 | `webmaster` (the admin account) |
| SASWP custom field | 4.3 | 66 | "Edward Langley" |

The site has no review system and `dtz_comments` contains no product reviews.
Both graphs also declared `"price": 0.5` plus a `MerchantReturnPolicy` (7-day
free returns) and `OfferShippingDetails` (0 USD, 1–2 day transit) that no page
states and no policy document supports.

**Now:** exactly one `Product` graph per page, with `name`, `sku`, `brand`,
`description`, `image` and `availability` — all matching visible content. No
rating, no review, no price, no invented shipping or returns data.

### 3.2 Placeholder $0.50 price on all 18 products — **replaced with quotation CTAs**

Every product carried an identical `0.50` regular price. The audit confirmed
this was never a real storefront:

* `woocommerce_paypal_settings` → `"enabled";s:2:"no"` — no gateway enabled
* `dtz_wc_orders` — **zero** rows; `store_has_orders` → `no`
* `woocommerce_store_address` — empty
* Site copy throughout says "request a custom quote", "free delivery in USA",
  "MOQ from 100 units"

Pricing genuinely depends on size, quantity, material, printing and finishing.
Per the brief, cart controls were replaced with **Get Free Quote** and **Request
Bulk Pricing**, and no price is claimed anywhere in copy or schema. Product
pages keep their layout; only the price/qty/add-to-cart cluster changed.

### 3.3 Three `<h1>` elements on nearly every page — **fixed**

The Elementor CTA section and the popup form each rendered `<h1>Let's Connect</h1>`,
so 22 of 28 pages had 3 H1s. `/about-us/` and `/get-free-quote/` had **no** H1
other than those, leaving the real page heading as an H2.

**Now:** exactly one H1 per page, and it is the page's actual subject. Form
headings are H2. Verified across all 29 built pages.

### 3.4 Duplicate "Related Products" heading — **fixed**

Product pages rendered both an Elementor `<h2>Related Products</h2>` and
WooCommerce's own `<h2>Related products</h2>`. Only one is now emitted.

### 3.5 Horizontal overflow on mobile product pages — **fixed**

The live product page overflows **+389 px at 320 px** and **+334 px at 375 px**,
caused by unwrapped wide tables in the description. All tables now scroll inside
their own container. Measured 0 px overflow at 320/375/768/1024/1440.

### 3.6 Colour contrast below WCAG AA — **fixed, palette unchanged**

White text on the brand peach `#ECAE85` measures **1.9:1**. Affected the
announcement bar, every primary button and several links.

Brand colours are **unchanged**. Only foregrounds moved:

* Peach *fills* keep `#ECAE85`; their labels are now `#0A0A0A` (11:1).
* A darker shade of the same hue, `--peach-text: #a05a20` (5.3:1 on white), is
  used **only** where peach appeared as text on a light surface.

To revert, set `--peach-text: var(--peach)` and restore `color: var(--white)` on
`.btn--primary` in `src/styles/global.css`. This will reintroduce the AA failure.

### 3.7 Other fixes

* Cloudflare had obfuscated every email address into `[email protected]`
  placeholders; all were decoded back to `info@cardboardcups.com`.
* `tel:` links carried display formatting (`tel:(503) 358-0443`) and are now
  dialable (`tel:+15033580443`).
* The announcement bar's "Christmas Collection" link pointed at `href="#"`. It
  now points to `/product/christmas-cardboard-cups/`.
* Product descriptions contained AI-drafting-tool wrapper markup
  (`data-message-author-role`, `class="markdown prose dark:prose-invert"`,
  `data-start`/`data-end`). Stripped; all headings, paragraphs, lists, tables and
  links preserved.
* `/wp-json/wp/v2/*`, `/wp-admin/`, `/wp-login.php`, `/xmlrpc.php` all return 404.

---

## 4. URL handling

### Unchanged (200, no redirect) — 27 URLs

`/` · `/shop/` · `/about-us/` · `/contact-us/` · `/get-free-quote/` ·
`/privacy-policy/` · `/terms-conditions/` · 3 × `/product-category/…/` ·
18 × `/product/…/`

`/product/` and `/product-category/` prefixes and every trailing slash are
preserved exactly. No product was flattened to a root-level slug.

### Redirected — 5 URLs

| Old | New | Why |
| --- | --- | --- |
| `/cart/` | `/get-free-quote/` | No checkout exists; quote flow is the replacement |
| `/checkout/` | `/get-free-quote/` | As above (live already 302'd this to `/cart/`) |
| `/my-account/` | `/contact-us/` | No customer accounts; sales team handles enquiries |
| `/brand/cardboard-cups/` | `/shop/` | Single-brand archive duplicating `/shop/` |
| `/brand/cardboard-cups/page/2/` | `/shop/` | Paginated duplicate of the same |

All are single-hop 301s. No chains, no loops, no blanket homepage redirects.

### Not recreated → genuine 404

`/product-category/uncategorized/`, `/category/uncategorized/` (empty terms, not
in the live sitemap) and attachment pages such as `/woocommerce-placeholder/`.

### Host-level rules

HTTP → HTTPS, `www` → non-www, and non-slash → slash all 301, matching current
live behaviour. Canonical host is **`https://cardboardcups.com`**. Configs for
Vercel, Netlify and nginx are in `cardboardcups-astro/deploy/`.

---

## 5. Metadata parity

| Result | Count |
| --- | ---: |
| Title preserved byte-for-byte | **27 / 28** |
| Meta description preserved byte-for-byte | **22 / 28** |
| Description supplied (live/Yoast had none) | 6 |
| Pages with exactly one canonical | 29 / 29 |
| Pages with exactly one H1 | 29 / 29 |

Titles and descriptions come from `dtz_yoast_indexable` first, then the live
page source. The 6 supplied descriptions are for pages that had **none** at all
(`/about-us/`, `/contact-us/`, `/get-free-quote/`, `/privacy-policy/`,
`/terms-conditions/`, `/shop/`) — recorded in
`_migration/audit/metadata-fallbacks.json`. `/shop/` keeps its live title
"Shop - Cardboard Cups" and H1 "Shop".

Full diff: `cardboardcups-astro/reports/metadata-comparison.csv`.

---

## 6. Structured data

| Page type | Emitted |
| --- | --- |
| Homepage | `Organization`, `WebSite`, `FAQPage` |
| Product (×18) | `Product`, `BreadcrumbList`, `FAQPage` |
| Category (×3) | `BreadcrumbList`, `ItemList`, `FAQPage` |
| Shop | `BreadcrumbList`, `ItemList` |
| Content pages | `BreadcrumbList` (+ `Organization` on contact) |

Every FAQ question in schema is rendered on that same page — asserted by the
validation suite, not assumed. `MerchantReturnPolicy` and `OfferShippingDetails`
are **deliberately absent**: the site publishes no return window, no shipping
rate and no delivery estimate, so no Merchant Listing property can be supported.

Report: `cardboardcups-astro/reports/structured-data-report.csv`.

---

## 7. Images

* 123 originals kept at their **exact original URLs** under
  `/wp-content/uploads/…`, so no indexed image URL changes.
* 328 WebP renditions at 400/640/960/1280 px served via `<picture>`, with the
  original JPEG/PNG as the `<img>` fallback. Never upscaled beyond the source.
* Intrinsic `width`/`height` on every `<img>` — measured CLS contribution 0.
* Alt text: 98 images carry their original WordPress alt. Where WordPress had
  none, alt is derived from the filename and logged in
  `reports/assets-report.json` for review.
* Decorative footer thumbnails use empty alt.
* Hero/LCP images are `loading="eager" fetchpriority="high"`; everything below
  the fold is lazy.
* No image is hotlinked from the old site.

---

## 8. Performance and payload

| Page | Total | JS | CSS | Fonts |
| --- | ---: | ---: | ---: | ---: |
| Homepage | 1269 kB | **0 kB** | 29 kB | 30 kB |
| Product | 515 kB | **0 kB** | 29 kB | 30 kB |
| Category | 592 kB | **0 kB** | 29 kB | 30 kB |
| Quote | 195 kB | **0 kB** | 29 kB | 30 kB |

"0 kB JS" means **no external script requests** — the small nav/tab/form scripts
are inlined into the HTML. There is no framework runtime, no jQuery, no
Elementor bundle, no Swiper, no WooCommerce assets. For comparison the live
homepage loads 30+ CSS files and a large JS bundle.

Fonts are self-hosted Nunito Sans (SIL OFL permits this), variable weight
400–800, `font-display: swap`, latin + latin-ext subsets, preloaded.

The live hero was a 3-image Ken Burns slideshow. It is rendered as a static
first slide: under the 75 %-opacity overlay the difference is not visible, and it
removes the slideshow JS and the LCP penalty. `prefers-reduced-motion` is
honoured throughout, including the announcement marquee.

---

## 9. Unresolved items

**One.** `/wp-content/uploads/2025/12/Cup-Sleeves.jpg` returns **404 on the live
site**. It is referenced only inside the SASWP JSON-LD `image` array of
*Disposable Cardboard Cups* — never in a visible gallery. Because product schema
is now rebuilt from the actual gallery, the broken reference is simply gone. No
visible image is affected and nothing was invented to replace it.

Nothing else is outstanding. No placeholder content was used anywhere.

---

## 10. Deliverables

| Deliverable | Location |
| --- | --- |
| Astro project | `cardboardcups-astro/` |
| Preserved source exports | folder root (untouched) |
| Audit working files | `_migration/` |
| Master URL inventory | `cardboardcups-astro/reports/url-inventory.csv` |
| Old→new comparison | same file (`old_status`, `new_status`, `action`) |
| Redirect map | `cardboardcups-astro/reports/redirect-map.csv` |
| Metadata comparison | `cardboardcups-astro/reports/metadata-comparison.csv` |
| Assets / missing-asset report | `cardboardcups-astro/reports/assets-report.json` |
| Structured-data report | `cardboardcups-astro/reports/structured-data-report.csv` |
| Broken-link report | produced by `npm run validate` (currently zero) |
| Metadata fallback log | `_migration/audit/metadata-fallbacks.json` |
| QA screenshots (live vs local) | `_migration/qa/` |
| Deployment configs | `cardboardcups-astro/deploy/` |
| Form setup, deploy, rollback | `cardboardcups-astro/README.md` |
| `.env.example` | `cardboardcups-astro/.env.example` |
