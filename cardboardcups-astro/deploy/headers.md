# Security headers, redirects and caching

The site is prerendered static HTML plus one server route (`/api/quote/`). Astro
middleware does **not** run for prerendered pages, so response headers must be
set by whatever serves `dist/client`. Ready-made configurations for the common
hosts are in this folder — pick the one that matches your platform.

## Header set

| Header | Value | Why |
| --- | --- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Locks the site to HTTPS after first visit. |
| `Content-Security-Policy` | see below | Blocks off-origin scripts, frames and form posts. |
| `X-Content-Type-Options` | `nosniff` | Stops MIME sniffing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Keeps full URLs on-origin only. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Drops APIs the site never uses. |
| `X-Frame-Options` | `DENY` | Legacy partner to `frame-ancestors`. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates the browsing context. |

## Content-Security-Policy

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
img-src 'self' data:;
font-src 'self';
style-src 'self' 'unsafe-inline';
script-src 'self' 'unsafe-inline';
connect-src 'self';
upgrade-insecure-requests
```

`'unsafe-inline'` is present for two reasons, both build-time and neither
reflecting user input:

* Astro inlines the small component scripts (nav, tabs, form) into the HTML.
* JSON-LD blocks are inline and differ on every page.

Nothing on the site renders visitor-supplied HTML, so the practical XSS surface
is nil. To remove `'unsafe-inline'` entirely, emit the component scripts as
external files and hash the JSON-LD blocks per page, then replace it with the
resulting `'sha256-…'` list.

## Redirects that must be handled by the host

The application already answers these (they are in `src/lib/routes.ts` and the
node server issues real 301s), but on a CDN they belong in the edge config:

| From | To | Code |
| --- | --- | --- |
| `http://cardboardcups.com/*` | `https://cardboardcups.com/*` | 301 |
| `https://www.cardboardcups.com/*` | `https://cardboardcups.com/*` | 301 |
| `/path` (no trailing slash) | `/path/` | 301 |
| `/cart/`, `/checkout/` | `/get-free-quote/` | 301 |
| `/my-account/` | `/contact-us/` | 301 |
| `/brand/cardboard-cups/`, `/brand/cardboard-cups/page/2/` | `/shop/` | 301 |

Anything else that is not a built page must return a genuine **404** — never a
redirect to the homepage.

## Caching

| Path | `Cache-Control` |
| --- | --- |
| `/wp-content/uploads/*`, `/fonts/*`, `/_astro/*` | `public, max-age=31536000, immutable` |
| `*.html`, `/` | `public, max-age=0, must-revalidate` |
| `/sitemap.xml`, `/robots.txt` | `public, max-age=3600` |
| `/api/quote/` | `no-store` (already set by the route) |
