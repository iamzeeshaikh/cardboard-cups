import type { APIRoute } from 'astro';
import { INDEXABLE } from '../lib/routes';
import { SITE_URL } from '../data/site';

export const prerender = true;

/** A single flat sitemap at exactly /sitemap.xml, canonical trailing-slash URLs only. */
export const GET: APIRoute = () => {
  const urls = [...new Set(INDEXABLE)].sort();
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${new URL(u, SITE_URL).href}</loc></url>`),
    '</urlset>',
  ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
