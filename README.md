# My brain is a goldmine

Astro conversion of Mallory's site, with Tailwind-based styling and a browser-based BlockNote
publishing editor. **Production is public at
[my-brain-is-a-goldmine.vercel.app](https://my-brain-is-a-goldmine.vercel.app/);
previews and deployment-specific URLs remain Vercel-protected.** The owner approved
activation on 2026-10-30 and public production access on 2026-11-09. Live
authenticated upload/publishing acceptance remains pending; application sign-in
and editorial authorization are unchanged. Supabase migration, one editor grant, private R2 storage,
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
   explicit and private. The status distinguishes unsaved text, a saved newer
   draft, and the version currently live.
4. **Publish** (or **Update live post**) saves the latest changes if needed, then
   publishes directly. **Preview** is an optional view: it neither saves nor
   publishes, and returning to **Write** preserves unsaved text. No preview click
   is required to publish. Uploads must finish first; revision conflicts still stop
   stale changes from overwriting another session.
5. **Unpublish**, directly beside the publishing controls, removes the entry and revokes new original-route reads of
   its exclusive media, retaining the saved draft and original objects. Previously
   optimized copies may remain available through Astro's normal cache.

Each entry now has its own paper container, including all eleven existing entries.
The original grouping metadata and archived source remain unchanged.
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

## Reading and image viewing

Post panels use the supplied recycled-paper texture and near-black (`#181818`) multiply-blended
text, without blending photographs or embeds. The source lives at
`src/assets/textures/white-recycle-paper-texture.jpg`; Astro supplies the native
optimized WebP background to both live posts and read-only admin previews.
Fallback white remains readable if the texture cannot load. Paper text selection
inverts to white on black, and links/focus indicators remain visible on paper.

Panels are borderless with zero outer margin. The owner's later local `p-0` edit
is retained; mobile keeps the existing `px-1` (4px horizontal) override. The
transparent parent flex layout keeps posts centered,
with the latest local `gap-32` between posts (128px) and `pt-16` above the first post
(64px). Both spaces reveal the
sparkle background without adding margins to posts. Paper is scoped directly to
each post, not the body or feed wrapper. Paragraph and heading margins are unchanged. Intentional paragraph/line breaks
have extra blank-line spacing; automatic wrapping and BlockNote's editor styling
are unchanged. The main heading uses the owner's responsive Tailwind type sizes; the owner
chose to keep the local removal of automatic fitting, so narrow real-font layouts
can overflow. This is a known release exception, not a verified responsive fit.
Individual post titles may wrap. Public text selection inverts the local black/white treatment.

Click, tap, or keyboard-activate a post image to enlarge it in a fullscreen view.
The only control is X; it and Escape restore focus
and the reader's scroll position. Cat toggling and artwork navigation are not
viewer targets. Existing posts receive descriptive image alt text and iframe
titles at rendering time without changing archived HTML or requiring an import.

## CRT and floating background images

The homepage and `/index.html` use a **viewport-fixed, transparent CRT overlay**
adapted from TVM Archive's public-domain CRT-Lottes treatment. Scanlines and RGB
phosphors stay screen-locked while the document, glitter, and floating images pass
underneath. The owner's later instruction puts it above all homepage content,
including the native image viewer. It has `pointer-events: none` (including its
backdrop), `aria-hidden`, and `inert`; mouse, touch, keyboard, and scrolling remain
native. A manual popover keeps it above native dialogs, with dialog reparenting
as the fallback. This is a spatial mask, **not a capture/Gaussian reconstruction
or geometric warp of the DOM**. Artwork routes and admin have no overlay.

There is no Three.js, React island, texture atlas, or continuous shader loop.
The source GIF remains unchanged. Reduced motion uses a lossless first-frame still;
regenerate it with `node scripts/generate-crt-glitter.mjs`. Its provenance records
the original checksum. `?crt=off` provides an unfiltered comparison. GPU output is
capped at 1.5× DPR/two million pixels; missing/lost WebGL leaves the site usable.

The homepage sparkle background scrolls at **two-thirds of document speed**:
posts and floating images retain normal document coordinates, and the CRT stays
viewport-fixed. A passive scroll listener coalesces the background-position offset
into animation frames; no content wrapper is transformed. Reduced motion restores
ordinary background scrolling, and artwork routes/admin are unaffected.

Mallory's supplied media—14 photos, an animated GIF, and a muted looping
video—float behind the writing. Their coordinates and boundaries use the **entire
document**, not just the viewport. They bounce off post rectangles with 6px
clearance and off document edges; scrolling does not rebase their positions.
Resize and content-height changes refresh collisions. Reduced motion/data saver
make them still, hidden tabs and open viewers stop their animation, and insufficient
gutter space hides them rather than intruding on writing. Neither layer catches input.

The Pinterest placeholders have been removed. Stills and animation/video posters
live under `src/assets/floating-images/`; small animated GIF/MP4 web copies live
under `public/floating-media/`. `provenance.json` records source filenames and
source/output hashes. The supplied Downloads originals remain untouched. Web
stills are auto-oriented, metadata-stripped, and capped at a 1600px edge; Astro
generates responsive WebP delivery. The GIF retains its frames/timing; its static
fallback and the video's poster are used when motion is disabled. Animated media
only plays while visible and permitted. The video is silent, looping, inline,
and has no controls; it does not preload while off-screen.

Asset preparation is an explicit local operation, not a build/deployment step:
`node scripts/prepare-floating-media.mjs "/path/to/mallory site photos"`.
It requires FFmpeg for video conversion and refuses to overwrite existing outputs.
Normal builds use the prepared assets and do not require FFmpeg or access to Downloads.
