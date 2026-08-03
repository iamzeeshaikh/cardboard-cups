// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import { REDIRECTS } from './src/lib/routes.ts';

const SITE = 'https://cardboardcups.com';


export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Vercel sets VERCEL=1 during its build. Locally we keep the standalone node
  // server so `node dist/server/entry.mjs` and the QA scripts still work.
  adapter: process.env.VERCEL ? vercel() : node({ mode: 'standalone' }),
  redirects: REDIRECTS,
  prefetch: false,
  devToolbar: { enabled: false },
  image: {
    // every image is a local file under public/, resized ahead of time by scripts/images.mjs
    remotePatterns: [],
  },
  vite: {
    build: { cssCodeSplit: false },
  },
});
