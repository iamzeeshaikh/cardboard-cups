/**
 * Homepage copy, transcribed verbatim from the live page.
 * Section order matches the WordPress layout exactly.
 */

export const HERO = {
  h1: 'Eco-Friendly Cardboard Cups for Modern Beverage Businesses',
  intro: [
    'Serve hot and cold drinks responsibly with high-quality cardboard cups made for cafés, food brands, offices, events, and distributors across the <strong>USA, UK, Canada, Australia, and Europe</strong>.',
    'Our cups combine durability, sustainability, and clean design — suitable for everyday service and large-scale commercial use.',
  ],
  // The live buttons opened a quote popup and a mailto; both are preserved as
  // their equivalent destinations in the quotation flow.
  primary: { label: 'Shop Cardboard Cups', href: '/get-free-quote/' },
  secondary: { label: 'Request Bulk Pricing', href: 'mailto:info@cardboardcups.com' },
  // First slide of the live hero slideshow; used statically so the LCP image is
  // not animated and no slideshow JavaScript is shipped.
  image: '/wp-content/uploads/2025/12/Carry-Safe-White-Cups.jpg',
};

export const INTRO = {
  h2: 'Sustainable Cups Built for Real-World Use',
  image: '/wp-content/uploads/2025/12/Sweet-Treat-Baking-Cups.jpg',
  imageAlt: 'Decorative cardboard baking cups arranged on a white serving tray',
  body: [
    'Cardboard Cups are designed for businesses that need dependable disposable drinkware without compromising environmental responsibility. Whether you serve coffee, tea, soft drinks, or chilled beverages, our cups are engineered to handle temperature, moisture, and daily handling.',
    'We supply <strong>standard and custom cardboard cups</strong> in multiple sizes, finishes, and coatings to support restaurants, cafés, food trucks, corporate offices, and event organizers worldwide.',
  ],
};

export const BENEFITS = {
  h2: 'Why Businesses Choose Our Cardboard Cups',
  items: [
    {
      h3: 'Environmentally Responsible Materials',
      body: 'Our cups are produced using responsibly sourced paperboard and eco-conscious linings that support recyclability and compostability based on regional facilities.',
    },
    {
      h3: 'Strong, Leak-Resistant Construction',
      body: 'Each cup is built to maintain shape and integrity when filled with hot or cold liquids, reducing spills and customer complaints.',
    },
    {
      h3: 'Suitable for Branding and Custom Printing',
      body: 'Smooth exterior surfaces support logo printing, text, and brand visuals, helping businesses maintain a consistent brand presence.',
    },
    {
      h3: 'Sizes and Styles for Every Beverage',
      body: 'Available in multiple capacities, from small espresso cups to large takeaway beverage cups.',
    },
    {
      h3: 'Global Supply and Consistent Quality',
      body: 'Reliable production standards allow us to serve international markets without quality variation.',
    },
  ],
};

/** The eight products the live "Our Cardboard Cup Range" grid features, in order. */
export const RANGE = {
  h2: 'Our Cardboard Cup Range',
  slugs: [
    'cardboard-muffin-cups',
    'cardboard-cupcake-cups',
    'cardboard-baking-cups',
    'cardboard-cup-sleeves',
    'cardboard-coffee-sleeves',
    'christmas-cardboard-cups',
    'white-cardboard-cups',
    'corrugated-paper-cups',
  ],
};

export const CATEGORIES_SECTION = { h2: 'Our Cardboard Cup Categories' };

export const AUDIENCE = {
  h2: 'Who Uses Our Cardboard Cups',
  image: '/wp-content/uploads/2025/12/Tea-Serving-Cups.jpg',
  imageAlt: 'Stack of branded kraft cardboard cups on a light surface',
  items: [
    { h3: 'Coffee Shops and Cafés', body: 'Reliable cups that preserve beverage temperature and presentation.' },
    { h3: 'Restaurants and Takeaway Businesses', body: 'Efficient for dine-in alternatives and delivery packaging.' },
    { h3: 'Corporate Offices', body: 'Ideal for office coffee stations and meeting areas.' },
    { h3: 'Events and Catering Services', body: 'Lightweight, stackable, and easy to distribute in high-volume settings.' },
    { h3: 'Distributors and Wholesalers', body: 'Consistent supply and scalable packaging options for resale markets.' },
  ],
};

export const PRINTING = {
  h2: 'Custom Printed Cardboard Cups',
  image: '/wp-content/uploads/2025/12/Takeaway-Cardboard-Mug.jpg',
  imageAlt: 'Custom printed cardboard mug presented in a branded gift box',
  lead: 'Brand visibility matters, even in disposable packaging. Our custom cardboard cups allow businesses to print logos, brand colors, slogans, and compliance messaging.',
  listTitle: 'Customization Options Include:',
  list: [
    'Single-color or full-color printing',
    'Inside and outside surface printing (where applicable)',
    'Matte or standard finishes',
    'Short-run and bulk print programs',
  ],
  closing: 'Custom printing is suitable for cafés, promotional events, trade shows, and seasonal campaigns.',
  cta: { label: 'Start Custom Printing', href: '/get-free-quote/' },
};

export const SHIPPING = {
  h2: 'International Shipping and Support',
  image: '/wp-content/uploads/2025/12/restaurant-shake-cups.jpg',
  imageAlt: 'Two printed cardboard cups with a black sip lid floating above one of them',
  lead: 'We ship cardboard cups to:',
  list: ['United States', 'United Kingdom', 'Canada', 'Australia', 'European Union'],
  closing: [
    'Orders are packed securely and dispatched using trusted logistics partners.',
    'Tracking options and delivery timelines vary by region and order size.',
  ],
};

export const SUSTAINABILITY = {
  h2: 'Designed with Sustainability in Mind',
  lead: 'Our cardboard cups are created to help businesses reduce their dependence on plastic drinkware. Paper-based materials are selected to align with global sustainability efforts and local waste management systems.',
  listTitle: 'Key sustainability considerations include:',
  list: [
    'Reduced plastic content',
    'Compatibility with recycling streams where available',
    'Compostable linings in selected products',
    'FSC-certified paperboard options',
  ],
  closing: 'We recommend confirming disposal methods based on your local regulations.',
};

export const BULK = {
  h2: 'Bulk Supply for Growing Businesses',
  lead: 'We support bulk and wholesale buyers across international markets. Whether you operate a single location or manage a multi-region supply chain, we offer flexible order quantities and competitive pricing.',
  listTitle: 'Bulk ordering benefits:',
  list: [
    'Lower per-unit cost',
    'Consistent inventory availability',
    'Simplified reordering',
    'Dedicated support for large accounts',
  ],
  cta: { label: 'Get Wholesale Pricing', href: '/get-free-quote/' },
};

export const BANDS_BACKGROUND = '/wp-content/uploads/2025/12/paperboard-coffee-cup.jpg';

export const HOME_FAQ = {
  h2: 'Frequently Asked Questions',
  image: '/wp-content/uploads/2025/12/Dessert-Muffin-Cups.jpg',
  imageAlt: 'Two muffins baked in yellow polka dot cardboard baking cups',
  items: [
    {
      question: 'Are cardboard cups recyclable?',
      answer: '<p>Most cardboard cups are recyclable depending on local recycling facilities and cup lining type. Some regions require industrial processing.</p>',
    },
    {
      question: 'Are these cups suitable for hot beverages?',
      answer: '<p>Yes. Our cups are designed to handle hot liquids such as coffee and tea without leaking or softening.</p>',
    },
    {
      question: 'Do you offer compostable options?',
      answer: '<p>Yes. Selected products use compostable linings suitable for industrial composting environments.</p>',
    },
    {
      question: 'Can I order custom printed cups in small quantities?',
      answer: '<p>Minimum order quantities apply for custom printing. Contact us to confirm current thresholds.</p>',
    },
    {
      question: 'Are lids included with the cups?',
      answer: '<p>Lids are sold separately unless stated otherwise. Compatible lid options are available.</p>',
    },
    {
      question: 'Do the cups affect beverage taste?',
      answer: '<p>No. Our cups are food-safe and do not alter the flavor of beverages.</p>',
    },
    {
      question: 'Are these cups safe for food contact?',
      answer: '<p>Yes. Materials comply with standard food-contact safety regulations commonly used in the US, UK, EU, and Australia.</p>',
    },
    {
      question: 'How long does custom printing take?',
      answer: '<p>Production timelines vary by order size and design approval. Standard lead times range from 2–4 weeks.</p>',
    },
    {
      question: 'Can I mix different cup sizes in one bulk order?',
      answer: '<p>Yes, mixed-size bulk orders are available depending on stock and packaging terms.</p>',
    },
    {
      question: 'Do you ship to multiple locations?',
      answer: '<p>Yes. Split shipments can be arranged for multi-location businesses.</p>',
    },
  ],
};
