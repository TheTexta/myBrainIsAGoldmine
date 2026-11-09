import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { copyFile } from 'node:fs/promises';
import { wordpressHost } from './src/lib/images/settings.ts';

const trustedOrigins = [loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), 'SITE_URL').SITE_URL,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
].filter(Boolean).map((value) => new URL(value));

// The Vercel adapter forces directory output. Copy exact file aliases into the
// generated client tree before its final static-copy hook, preserving old URLs.
function legacyHtmlAliases() {
  let clientDirectory;
  return {
    name: 'mybrain-legacy-html-aliases',
    hooks: {
      'astro:config:done': ({ config }) => { clientDirectory = config.build.client; },
      'astro:build:done': async () => {
        await Promise.all(['1', '12', '3'].map((page) => copyFile(
          new URL(`${page}/index.html`, clientDirectory), new URL(`${page}.html`, clientDirectory),
        )));
      },
    },
  };
}

export default defineConfig({
  output: 'static',
  adapter: process.env.VERCEL === '1' ? vercel() : node({ mode: 'standalone' }),
  integrations: [react(), ...(process.env.VERCEL === '1' ? [legacyHtmlAliases()] : [])],
  vite: { plugins: [tailwindcss()] },
  image: {
    remotePatterns: [
      { protocol: 'https', hostname: wordpressHost, pathname: '/wp-content/uploads/**' },
      ...trustedOrigins.map((url) => ({ protocol: url.protocol.slice(0, -1), hostname: url.hostname, port: url.port, pathname: '/media/*' })),
      ...['localhost', '127.0.0.1'].flatMap((hostname) => [...new Set(['4321', process.env.PORT].filter(Boolean))]
        .map((port) => ({ protocol: 'http', hostname, port, pathname: '/media/*' }))),
    ],
    responsiveStyles: false,
    service: { entrypoint: 'astro/assets/services/sharp', config: { limitInputPixels: 100_000_000 } },
  },
  compressHTML: false,
  security: {
    allowedDomains: [
      { hostname: 'localhost', protocol: 'http' },
      { hostname: '127.0.0.1', protocol: 'http' },
      ...trustedOrigins.map((url) => ({ hostname: url.hostname, protocol: url.protocol.slice(0, -1), port: url.port })),
    ],
  },
  build: {
    format: 'file',
  },
});
