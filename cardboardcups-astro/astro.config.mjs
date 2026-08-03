// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { REDIRECTS } from './src/lib/routes.ts';

const SITE = 'https://cardboardcups.com';


export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  adapter: node({ mode: 'standalone' }),
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
