# My brain is a goldmine

Faithful Astro conversion of Mallory's site, with a browser-based BlockNote
publishing editor. **The app has not been deployed or connected to production
Supabase/R2.** The owner approved activation on 2026-10-30; the Vercel project and
private R2 bucket are created, the database is backed up, and Preview/Production
environment variables are configured. Migration and live acceptance remain. See
[current activation state](docs/publishing.md#current-gate).

## Run locally

Use Node **22.23.4 or newer supported LTS**, matching `.nvmrc`:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Without Supabase configuration, `/` renders the original writing and `/admin`
explains the missing setup. The old `/index.html`, `/1.html`, `/12.html`, and
`/3.html` URLs remain available. There is no Markdown/MDX publishing workflow.

```sh
npm run check
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run test:db
npm run test:visual
npm run test:vercel
npm run build
```

`test:e2e` starts **localhost-only Supabase/R2 protocol doubles**, builds the app
with fake test configuration, and tests desktop/mobile publishing and the old
site. `test:db` requires Docker and creates a disposable PostgreSQL 17 container
with no ports or persistent volumes. It does not connect to Supabase or apply SQL
outside that container, and refuses remote Docker endpoints. `test:visual`
explicitly disables Supabase for the archival comparison, needs Git/Python, and
fetches public fonts/images; GIF first frames are frozen and player interiors
are excluded. `npm test` runs checks, unit tests, and browser tests;
run the database suite separately. After browser tests, run `npm run build` again
before using the build for anything else: test builds contain fake public config.

The default build uses the Node standalone adapter:

```sh
HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs
```

Vercel builds select the Vercel adapter when `VERCEL=1`. Production and preview
domains must be explicitly trusted; no wildcard preview-host trust is enabled.
That adapter forces directory output; a build hook emits exact `1.html`,
`12.html`, and `3.html` static aliases before the final output copy. The Vercel
output check verifies those aliases and dynamic routing without deploying.
See [publishing setup and activation](docs/publishing.md) before deployment.

## Publishing

1. Sign in at `/admin` with an existing Supabase account granted this site's
   editorial membership.
2. Choose an existing entry and **Import original into BlockNote**, or create a
   new entry. Import may simplify galleries and spacing; the original remains
   public until an edited version is deliberately published.
3. Write, upload images, or insert Spotify/VideoPress embeds. **Save draft** is
   explicit and does not change the live site.
4. **Preview** saves and renders the draft using the public renderer. Review it,
   then **Publish**. Editing again invalidates that preview.
5. **Unpublish** removes the entry and its exclusive media references from public
   delivery, but retains the saved draft and original objects.

The eleven existing entries retain their seven original panels until edited.
New entries appear above the originals. The public site does not load React or
BlockNote browser bundles. Its homepage is server-rendered so publishing does not
require a rebuild; the three artwork/splash pages remain static.

## Source layout

- `src/content/legacy.html` — immutable original feed markup, with only the broken
  closing heading tag repaired and the VideoPress helper script moved to the page.
- `src/content/legacy.ts` — stable original entry IDs and panel boundaries.
- `src/lib/documents.ts` — bounded JSON validation and escaped public HTML renderer.
- `src/components/admin/` — isolated React/BlockNote publishing UI.
- `src/pages/api/admin/` — authenticated editor endpoints.
- `supabase/migrations/` — site-owned SQL, **not applied automatically**.
- `public/` — original published assets and stylesheet, byte-preserved. PSD source
  files remain at the repository root, outside the published output.
- `tests/fixtures/legacy.json` — hashes captured from original revision
  `2773eda0194d60270857693f32b2efb9f69230e0`; do not regenerate from the new site
  simply to make a fidelity failure pass.

See [staged image improvements](docs/image-improvements.md) for the remaining
optimization work. Existing WordPress image URLs are intentionally unchanged.
