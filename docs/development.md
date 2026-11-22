# Local development and verification

The [README](../README.md#run-locally) has the minimal install/run commands.
This guide describes local runtime and test workflows, not production acceptance.

## Runtime and configuration

`package.json` supports Node `^22.23.4 || ^24.0.0` and npm `>=9.6.5`.
`.nvmrc` selects 22.23.4; the recorded Vercel configuration selects Node 24.
The bounded Node range avoids silently using a different build major from the
supported function runtime.

The unconfigured site serves the archival writing and shows a setup notice at
`/admin`. To enable publishing, follow [configuration and authorization](publishing.md#configuration).
Do not add production credentials merely to browse or test the original site.
SQL migrations are not applied by install, development, or build commands.

The default build uses Astro's Node standalone adapter:

```sh
npm run build
HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs
```

`VERCEL=1` selects the Vercel adapter. Its directory output is supplemented with
exact `1.html`, `12.html`, and `3.html` aliases before the final static copy.
`test:vercel` checks aliases and dynamic/native-image routing locally; it does not
deploy. Exact production/preview origins must be trusted at build time; wildcard
preview-host trust is intentionally absent. Read the
[activation checklist](publishing.md#production-activation-checklist) before deployment.

## Checks

Run commands from the repository root after `npm ci`.

| Command | Scope and extra requirements |
| --- | --- |
| `npm run check` | Astro/TypeScript checks. |
| `npm run test:unit` | Vitest unit tests. |
| `npm run test:images:dev` | Isolated development image-audit regression; public Supabase configuration is cleared. |
| `npm run test:e2e` | Desktop/mobile browser coverage; install Playwright Chromium first. |
| `npm run test:graphics` | Focused Chromium/WebKit graphics coverage. |
| `npm run test:db` | Disposable PostgreSQL 17 authorization suite; requires local Docker. |
| `npm run test:visual` | Archival and reviewed full-page comparisons; requires Chromium, Git history, `tar`, Python 3, and public font/image access. |
| `npm run test:vercel` | Local Vercel build/output checks, without deploying. |
| `npm run build` | Ordinary Node build, unless `VERCEL=1` is set. |
| `npm test` | `check`, `test:unit`, and `test:e2e`; excludes the other suites. |

Install only Chromium for the default browser suite, or both engines for graphics
and the offline import differential:

```sh
npx playwright install chromium webkit
npm run test:e2e
npm run test:graphics
npx playwright test --config=playwright.legacy-import.config.ts
```

The import differential compares all eleven public entries and malformed/inert
HTML fixtures with the frozen DOMParser reference, including ordered writing/media
and actual BlockNote documents, excluding generated IDs. Its test-only Vite
fixture uses port 4323, builds no app, starts no service doubles, and blocks
non-local browser requests.

### Isolation and build output

- `test:e2e` and `test:graphics` start localhost Supabase/R2 protocol doubles on
  port 54329 and a fixture-configured app on port 4323. They do not establish real
  Auth/S3 acceptance. Do not run these and the import differential concurrently;
  the configured servers refuse to reuse occupied ports.
- **Rebuild with `npm run build` before using output after browser or adapter
  tests.** Browser builds contain fake public configuration. `test:visual` also
  builds with Supabase disabled; do not mistake it for a configured release build.
- `test:db` requires a local Docker Unix socket and refuses remote endpoints. It
  creates a disposable `postgres:17-alpine` container with networking disabled,
  tmpfs data, no published ports, and no persistent volumes. It never substitutes
  a shared Supabase database and removes its test container afterward.
- `test:visual` deliberately disables Supabase, freezes GIF first frames, and
  excludes player interiors. It compares reviewed Tailwind full-page snapshots
  while retaining differences against original revision
  `2773eda0194d60270857693f32b2efb9f69230e0`. It fetches public fonts/images, so it
  is not an offline test.

Snapshot-update instructions live in [styling implementation](../DESIGN.md#styling-implementation).
Inspect all captures before accepting intentional visual changes. Never regenerate
the original revision or `tests/fixtures/legacy.json` to make a fidelity failure pass.

The [verification record](verification.md) documents owner-accepted header overflow
and legacy spacing/assertion mismatches. Focused graphics passes are not evidence
that the complete legacy browser suite is green. Historical results there are not
fresh checks of a new checkout.

## Source map

- `src/pages/` — public pages, editor shell, authenticated APIs, and media routes.
- `src/content/legacy.html` / `legacy.ts` — archival markup, stable entry IDs, and
  grouping boundaries. The HTML only repairs a broken closing heading and moves
  the VideoPress helper script to the page.
- `src/lib/documents.ts` — bounded JSON validation and escaped public rendering.
- `src/components/admin/` / `src/lib/selected-draft.ts` — isolated editor UI,
  draft revisions, acknowledgements, and publication sequencing; documents stay
  outside React render snapshots.
- `src/lib/import-legacy-document.ts` — ordered, lossy import using BlockNote's
  editor-supplied HTML parser; importing and saving never publish.
- `src/lib/floating-images-layout.ts`, `floating-images-client.ts`, and
  `floating-images.ts` — measured layout, browser/media lifecycle, and collision math.
- `src/styles/` — site-owned Tailwind tokens/styles, isolated from vendor editor CSS.
- `supabase/migrations/` — site-owned SQL requiring separate review and application.
- `public/` — retained original published assets and archival `/style.css`;
  live pages/previews use compiled `src/styles/public.css`. Root PSD sources stay
  outside published output.
