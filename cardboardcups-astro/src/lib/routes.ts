/**
 * The canonical list of indexable URLs. Used by the sitemap and by the
 * validation suite, so the two can never drift apart.
 */
import products from '../data/products.json' with { type: 'json' };
import categories from '../data/categories.json' with { type: 'json' };

export const STATIC_PAGES = [
  '/',
  '/shop/',
  '/about-us/',
  '/contact-us/',
  '/get-free-quote/',
  '/privacy-policy/',
  '/terms-conditions/',
];

/**
 * Real pages that must return 200 but must never be indexed or listed in the
 * sitemap: the error page and the post-submission confirmation.
 */
export const NOINDEX_PAGES = ['/404/', '/thank-you/'];

export const INDEXABLE: string[] = [
  ...STATIC_PAGES,
  ...categories.map((c) => c.url),
  ...products.map((p) => p.url),
];

/**
 * Old URL -> new URL, 301. Only where the old URL has a genuine replacement;
 * everything else is left to return a real 404.
 */
export const REDIRECTS: Record<string, string> = {
  // WooCommerce purchase flow — this site takes quotations, not orders.
  '/cart/': '/get-free-quote/',
  '/checkout/': '/get-free-quote/',
  // No customer accounts exist; enquiries are handled by the sales team.
  '/my-account/': '/contact-us/',
  // Single-brand archive duplicating /shop/ (brand name == site name).
  '/brand/cardboard-cups/': '/shop/',
  '/brand/cardboard-cups/page/2/': '/shop/',
};
