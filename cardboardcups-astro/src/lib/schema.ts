/**
 * JSON-LD builders.
 *
 * Every property here is backed by something a visitor can actually see or by a
 * documented site policy. The WordPress build emitted two competing Product
 * graphs carrying invented ratings (5/1 review from the admin account and
 * 4.3/66 reviews attributed to "Edward Langley"); neither is reproduced, and
 * because the site still has no review system, no aggregateRating or review is
 * emitted. The Offer carries the "Starting from $0.50" price shown on every
 * product page, the free-US-shipping promise from the product copy, and the
 * returns terms published on the Terms & Conditions page.
 */
import { SITE_URL, SITE_NAME, CONTACT, PRICE_FROM } from '../data/site';

const abs = (path: string) => new URL(path, SITE_URL).href;

export type Crumb = { label: string; href?: string };

export function organization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: {
      '@type': 'ImageObject',
      url: abs('/wp-content/uploads/2026/01/Group-1-e1769074957770.png'),
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: CONTACT.phone,
      email: CONTACT.email,
      contactType: 'sales',
      areaServed: ['US', 'GB', 'CA', 'AU', 'EU'],
      availableLanguage: 'English',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: CONTACT.address.street,
      addressLocality: CONTACT.address.locality,
      addressRegion: CONTACT.address.region,
      postalCode: CONTACT.address.postalCode,
      addressCountry: CONTACT.address.countryCode,
    },
  };
}

export function website() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en-US',
  };
}

export function breadcrumbs(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: abs(item.href) } : {}),
    })),
  };
}

/** Only ever called with FAQs that are rendered on the same page. */
export function faqPage(items: { question: string; answer: string }[]) {
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      },
    })),
  };
}

type ProductInput = {
  name: string;
  url: string;
  sku: string;
  brand: string;
  description: string;
  images: { src: string }[];
  inStock: boolean;
};

export function product(p: ProductInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${abs(p.url)}#product`,
    name: p.name,
    url: abs(p.url),
    sku: p.sku,
    description: p.description,
    image: p.images.map((i) => abs(i.src)),
    brand: { '@type': 'Brand', name: p.brand },
    offers: {
      '@type': 'Offer',
      url: abs(p.url),
      // The site-wide entry price rendered on every product page.
      price: PRICE_FROM.value,
      priceCurrency: PRICE_FROM.currency,
      priceValidUntil: '2027-08-04',
      itemCondition: 'https://schema.org/NewCondition',
      availability: p.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@id': `${SITE_URL}/#organization` },
      // "Free shipping across the USA" — stated in the product descriptions.
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: 0,
          currency: PRICE_FROM.currency,
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'US',
        },
      },
      // Terms & Conditions: returns are not accepted once production begins.
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'US',
        returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
      },
    },
  };
}

export function itemList(name: string, items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: abs(it.url),
    })),
  };
}
