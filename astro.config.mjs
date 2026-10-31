import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import { loadEnv } from 'vite';
import { copyFile } from 'node:fs/promises';

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
