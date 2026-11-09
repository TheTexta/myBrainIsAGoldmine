# My brain is a goldmine

Astro conversion of Mallory's site, with Tailwind-based styling and a browser-based BlockNote
publishing editor. **A protected Vercel preview is deployed; public launch and
authenticated upload/publishing acceptance remain pending.** The owner approved
activation on 2026-10-30. Supabase migration, one editor grant, private R2 storage,
backup, and Preview/Production variables are configured. See
[current activation state](docs/publishing.md#current-gate).

## Run locally

Use Node **22.23.4+ within Node 22, or Node 24**. `.nvmrc` selects 22.23.4;
Vercel selects Node 24. The bounded engine range prevents a newer build major
from silently differing from the supported function runtime:

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
npm run test:images:dev
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
are excluded. It checks the separately reviewed Tailwind full-page snapshots and
reports full-page differences against the original conversion reference. The
original revision and checksums are not regenerated to accept styling changes.
`npm test` runs checks, unit tests, and browser tests;
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
- `src/styles/` — Tailwind v4 tokens and site-owned public/admin styles. Preflight
  is omitted; BlockNote/Mantine supplies its own editor styling without custom
  CSS hooks. See [styling conventions](DESIGN.md#styling-implementation).
- `src/pages/api/admin/` — authenticated editor endpoints.
- `supabase/migrations/` — site-owned SQL, **not applied automatically**.
- `public/` — original published assets and archival stylesheet, byte-preserved.
  Live pages and draft previews use compiled `src/styles/public.css`, not the
  retained `/style.css`. PSD source
  files remain at the repository root, outside the published output.
- `tests/fixtures/legacy.json` — hashes captured from original revision
  `2773eda0194d60270857693f32b2efb9f69230e0`; do not regenerate from the new site
  simply to make a fidelity failure pass.

## Responsive images

Public still images use Astro's native `Image` / `getImage()` pipeline with
responsive sizes and WebP output. This includes local feed images, the sixteen
existing WordPress images, mirror/collage artwork, and the large cafe background.
Original files and URLs remain available; original content/documents are not
rewritten. GIFs and BlockNote's private editor/preview images remain unprocessed.

Published R2 images use the same native optimizer against their same-origin
`/media/<uuid>` URL. **The owner accepts normal Astro caching:** an optimized copy
of a previously published image may remain available after unpublishing. The
original media route still checks current publication; drafts are never sent to
the optimizer. No custom optimizer middleware, derivative endpoint, R2 cache,
Worker, or database migration is used. See [image delivery](docs/image-improvements.md).
