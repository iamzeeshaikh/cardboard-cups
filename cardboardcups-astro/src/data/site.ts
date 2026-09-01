/**
 * Sitewide constants recovered from the WordPress export and the live site.
 * Contact details come from the live footer / Terms page — nothing here is invented.
 */

export const SITE_URL = 'https://cardboardcups.com';
export const SITE_NAME = 'Cardboard Cups';

export const CONTACT = {
  phone: '(503) 461-4788',
  phoneHref: 'tel:+15034614788',
  email: 'info@cardboardcups.com',
  address: {
    street: '303 W 137th Street, #5A',
    locality: 'New York',
    region: 'NY',
    postalCode: '10030',
    country: 'United States',
    countryCode: 'US',
  },
  addressLines: ['303 W 137th Street, #5A', 'New York, NY 10030 United States'],
};

export const SOCIAL = [
  { name: 'Facebook', href: 'https://www.facebook.com/' },
  { name: 'Twitter', href: 'https://twitter.com/' },
  { name: 'YouTube', href: 'https://www.youtube.com/' },
];

/** The announcement bar copy, preserved verbatim from the live header. */
export const ANNOUNCEMENT = {
  text: 'Grab New Year Sale 2026 - Get Upto 75% Off Explore Our',
  linkText: 'Christmas Collection',
  // live markup used href="#", a dead link; pointed at the matching product instead
  href: '/product/christmas-cardboard-cups/',
};

/**
 * Entry price shown on product pages. It is a site-wide "from" price, not a
 * per-product one, and the single source for both the visible figure and the
 * Product JSON-LD offer so the two can never drift apart.
 * `value`/`currency` are the machine-readable form used by Product JSON-LD;
 * the shipping and returns terms backing the schema offer come from the
 * product copy (free US shipping) and the Terms & Conditions returns section.
 */
export const PRICE_FROM = {
  label: 'Starting from',
  amount: '$0.30',
  value: '0.30',
  currency: 'USD',
};

export const LOGO = {
  src: '/wp-content/uploads/2026/01/Group-1-e1769074957770.png',
  alt: 'Cardboard Cups',
  width: 239,
  height: 106,
};

export type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

/** Header menu, matching the WordPress nav_menu order exactly. */
export const NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Cup Types',
    href: '/product-category/cup-types/',
    children: [
      { label: 'Cardboard Cups For Hot Drinks', href: '/product/cardboard-cups-for-hot-drinks/' },
      { label: 'Disposable Cardboard Cups', href: '/product/disposable-cardboard-cups/' },
      { label: 'Cardboard Cups For Food', href: '/product/cardboard-cups-for-food/' },
      { label: 'Cardboard Soup Cups', href: '/product/cardboard-soup-cups/' },
      { label: 'Cardboard Milkshake Cups', href: '/product/cardboard-milkshake-cups/' },
      { label: 'Cardboard Coffee Cups', href: '/product/cardboard-coffee-cups/' },
      { label: 'Cardboard Tea Cups', href: '/product/cardboard-tea-cups/' },
      { label: 'Cardboard Coffee Cups With Lids', href: '/product/cardboard-coffee-cups-with-lids/' },
      { label: 'Cardboard Mugs', href: '/product/cardboard-mugs/' },
      { label: 'Corrugated Paper Cups', href: '/product/corrugated-paper-cups/' },
      { label: 'White Cardboard Cups', href: '/product/white-cardboard-cups/' },
      { label: 'Christmas Cardboard Cups', href: '/product/christmas-cardboard-cups/' },
      { label: 'Small Cardboard Cups', href: '/product/small-cardboard-cups/' },
    ],
  },
  {
    label: 'Baking Cups',
    href: '/product-category/baking-cups/',
    children: [
      { label: 'Cardboard Baking Cups', href: '/product/cardboard-baking-cups/' },
      { label: 'Cardboard Cupcake Cups', href: '/product/cardboard-cupcake-cups/' },
      { label: 'Cardboard Muffin Cups', href: '/product/cardboard-muffin-cups/' },
    ],
  },
  {
    label: 'Cup Sleeves',
    href: '/product-category/cup-sleeves/',
    children: [
      { label: 'Cardboard Coffee Sleeves', href: '/product/cardboard-coffee-sleeves/' },
      { label: 'Cardboard Cup Sleeves', href: '/product/cardboard-cup-sleeves/' },
    ],
  },
  { label: 'Blog', href: '/blog/' },
  { label: 'Contact Us', href: '/contact-us/' },
];

export const FOOTER = {
  tagline:
    'Our cups combine durability, sustainability, and clean design — suitable for everyday service and large-scale commercial use.',
  quickLinks: [
    { label: 'Home', href: '/' },
    { label: 'Baking Cups', href: '/product-category/baking-cups/' },
    { label: 'Cup Sleeves', href: '/product-category/cup-sleeves/' },
    { label: 'Cup Types', href: '/product-category/cup-types/' },
  ],
  company: [
    { label: 'About Us', href: '/about-us/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'Contact Us', href: '/contact-us/' },
    { label: 'Terms Conditions', href: '/terms-conditions/' },
    { label: 'Privacy Policy', href: '/privacy-policy/' },
  ],
  /** The footer image strip, in the order the live footer renders it. */
  gallery: [
    '/wp-content/uploads/2025/12/Sweet-Treat-Baking-Cups.jpg',
    '/wp-content/uploads/2025/12/Paperboard-Baking-Cups.jpg',
    '/wp-content/uploads/2025/12/Muffin-Cup-Packaging.jpg',
    '/wp-content/uploads/2025/12/Cup-Sleeve-Packaging.jpg',
    '/wp-content/uploads/2025/12/Takeaway-Cup-Sleeve.jpg',
    '/wp-content/uploads/2025/12/Corrugated-Coffee-Cups.jpg',
  ],
  paymentImage: '/wp-content/uploads/2026/01/Payment-Methods.png',
  copyright: '© 2026 CardBoardCups. All rights reserved.',
};

/** Quotation calls to action — this site takes enquiries, it has no checkout. */
export const CTA = {
  quote: { label: 'Get Free Quote', href: '/get-free-quote/' },
  bulk: { label: 'Request Bulk Pricing', href: '/get-free-quote/' },
  custom: { label: 'Request Custom Quote', href: '/get-free-quote/' },
};
