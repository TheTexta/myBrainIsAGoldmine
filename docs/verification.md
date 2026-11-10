# Local verification — 2026-10-30

This records the local implementation checks before production activation.
For the subsequent approved activation's current state, see `publishing.md`.

Baseline: `2773eda0194d60270857693f32b2efb9f69230e0`.
Checks used a temporary Node 22.23.4 runner; the machine's default Node 22.18.0
installation was not changed.

| Check | Observed result |
| --- | --- |
| `npm run check` | Passed; no errors/warnings, one legacy `beforeunload.returnValue` compatibility hint. |
| `npm run test:unit` | 10 passed, including renderer/URL safety, document bounds, original grouping, request boundaries, and response-cap pagination. |
| `npm run test:e2e` | 28 passed across desktop/mobile. Local Supabase/R2 protocol doubles, not production. |
| `npm run test:db` | Passed against disposable PostgreSQL 17: grants/RLS, site membership, direct-RPC validation, save/public separation, stale revisions/actions, media readiness/access revocation, and retained originals. |
| `npm run test:visual` | All four original pages matched at 1440×900 and 390×844 with zero changed pixels; no remote font/image failures. |
| `npm run test:vercel` | Local Vercel build passed; legacy static `.html` aliases equal their directory output bytes and dynamic routes reach the renderer. No deployment. |
| `npm run build` | Node standalone build passed and was restored after fixture builds. |
| `npm audit` | Zero reported vulnerabilities after narrowly scoped transitive dependency overrides and patched test tooling. |
| Admin mechanical design detector | No findings. Desktop/mobile screenshots inspected. |
| Independent review | SHIP local implementation; all material findings resolved and regression-tested. Not production acceptance. |

During the approved activation, the same database bootstrap/migration/tests also
passed on isolated PostgreSQL 15.19. Production is 15.8, not the exact patch tested.
Astro checks, all ten unit tests, and the local Vercel output check passed again
using the temporary Node 22.23.4 runner. The machine's older default Node was
rejected by Astro; its installation was not changed.

The pixel comparison freezes animated GIFs at their first frame and blanks
third-party player interiors. Separate browser tests exercise cat toggling,
mirror animation, hover swaps, navigation, entry import, private save, preview,
publishing, conflict recovery, upload byte sealing, and unpublishing. All original
local assets, including the retained unpublished PSDs, match baseline SHA-256.

BlockNote's editor-only bundle still triggers a build chunk-size warning; it is
lazy-loaded after entry selection and is not requested by public pages. The
mobile editor's writing starts near the fold beneath the entry inventory; an
explicit inventory-collapse control is a nonblocking future improvement.

## Subsequent protected-preview checks — 2026-10-31 UTC

- Fresh database custom archive and globals backup saved with restricted access;
  archive listing and full SQL-generation read passed (not a restore rehearsal).
- Production PostgreSQL 15.8 migration, sole owner membership, table/function
  ownership, effective grants, and RLS checked. Read-only anonymous/nonmember/editor
  role assertions passed without changing editorial content.
- Protected preview build passed from `37246ee`; all-URL Vercel Login confirmed.
- All four original URLs matched their baseline title, text, image attributes,
  embed attributes, links, and panel-count hashes against live responses.
- All 26 published assets passed SHA-256 comparison; both PSD URLs returned 404.
- Homepage loads no editor bundles; seven original panels and eleven entries are
  present. Desktop and 390-pixel mobile rendering inspected with no broken images
  or mobile horizontal overflow.
- Admin page/API responses are no-store and non-frameable. Anonymous post access
  returned 401; missing/unpublished public media returned 404 with no-store.
- A further preview from `82029af` built successfully using Node 24 after bounding
  package engines. Astro check, ten unit tests, and all 28 desktop/mobile protocol-
  double browser tests passed again; the ordinary Node build was restored afterward.

### Latest dependency audit

The initial zero-vulnerability audit above is historical. A fresh audit during the
Node-24 preview now reports **four moderate findings, zero high/critical** in the
build-time `@astrojs/vercel → @vercel/nft → glob → minimatch` chain:

- `glob`: `GHSA-3g3m-2fjr-6pw4`, cancellation/continued filesystem traversal.
- `minimatch`: `GHSA-g3hv-75wg-m249`, pattern-amplification denial of service.

There are two underlying advisories; npm counts their affected ancestors too.
The installed tracing package requires glob 13. Patched glob 14.0.2/minimatch
11.0.1 are outside that dependency's declared major ranges. No forced major
override or npm-suggested incompatible adapter downgrade was applied during
activation. Review an upstream-compatible fix separately; do not present the
earlier zero count as the current audit result.

## Not established yet

Real authenticated browser sign-in, R2 signatures/conditional writes/CORS,
upload byte sealing, real embed playback, live session expiry and concurrent
editing remain unaccepted. The owner's R2 variables are Sensitive and were not
decrypted; presence alone does not establish valid S3 credentials. Follow the
remaining acceptance checklist in `publishing.md` before public launch.

## Tailwind styling migration — 2026-11-09

Site-owned styles now use Tailwind 4.3.5 through its Vite plugin. The owner chose
a 4px scale for layout, artwork positioning, and visible site borders, then
explicitly excluded manual BlockNote CSS-hook customization. Preflight is omitted;
the existing BlockNote/Mantine light view retains its supplied typography,
spacing, borders, toolbars, and menus. Public/admin font sizes remain unchanged.
The old `.bn-editor` padding override and element-wide admin control styles were
removed rather than carried into Tailwind.

Verified locally on Node 22.23.4:

- Astro check: no errors/warnings; the existing beforeunload compatibility hint remains.
- All 10 unit tests and 32 desktop/mobile browser tests passed. Added tests cover
  compiled public CSS, 4px artwork/layout/borders, shared preview styles, and
  unchanged BlockNote text/box metrics with the site stylesheet disabled.
- Eight full-page Tailwind visual snapshots passed with zero changed pixels on a
  separate non-update run; no remote image/font failures. Desktop/mobile public
  and admin screenshots were inspected. GIFs are frozen and player interiors
  excluded as before. The new visual snapshots are separate from the immutable
  original revision and `legacy.json`; original full-page comparison artifacts
  remain available, but intentionally differ after the approved sizing changes.
- Original content, URLs, embeds, media checksums, and unpublished PSD denial passed.
  `/style.css` remains byte-identical archival source and is no longer loaded by
  public pages or draft previews; both use the same compiled public stylesheet.
- Development-mode checks passed at widths 390, 660, and 1440 for all four public
  routes and the unconfigured admin page, with no horizontal overflow.
- Local Vercel output/legacy aliases and the final ordinary Node build passed.
  The final build was restored after browser-fixture and Vercel builds.
- Independent review's artwork-selector leak and below-fold visual-coverage
  findings were fixed and rechecked. The mechanical detector reported preserved
  typography/documentation advisories and the explicitly requested 4px structural
  sidebar divider; no vendor CSS hooks were added. Existing type sizes are now
  also recorded in DESIGN.md's frontmatter.

The existing editor-only large-chunk warning and four moderate npm audit findings
remain. No dependency advisory fixes, database migrations, production operations,
image optimization, deployment, or public launch were included. Real authenticated
production acceptance remains pending as documented above.

## Native Astro images — 2026-11-09

The owner selected optimization of existing public stills plus published R2
uploads, then explicitly chose native same-origin Astro optimization with normal
caching. Previously optimized public R2 copies may survive unpublishing. The
original media route and private-preview paths remain unchanged; no custom
optimizer guard, proxy, derivative route/cache, R2 writes, or schema changes were
introduced. GIFs remain original. See `image-improvements.md` for the accepted
cache boundary and native-probe latency limitation.

Verified locally on Node 22.23.4:

- Astro check passed without errors/warnings; the prior beforeunload hint remains.
- 13 unit tests and 40 desktop/mobile browser tests passed. Coverage includes
  native responsive URLs/dimensions/lazy loading, smaller actual image downloads,
  published R2 optimization, untouched uploaded GIFs, signed private previews,
  retained original bytes, original-route revocation, hover/srcset swaps, and
  unchanged editor styling. An initial failed GIF check caught the fact that
  `getImage()` reports the output format, not the source format; native
  `inferRemoteSize()` now detects GIFs before constructing optimized URLs.
  Protocol fixtures use HTTP R2, which the HTTPS-only renderer correctly rejects:
  signed-read bytes are tested separately, and HTTPS signed-image rendering is
  unit-tested. Real private-preview image playback remains an acceptance gate.
  The last full browser run had 38 passes and two timing failures in the existing
  authorization/outage checks; both passed on one focused `--last-failed` rerun
  without changing their assertions. An earlier full 40-test run also passed.
- Eight full-page visual baselines passed with zero changed pixels on a separate
  non-update run; all local and WordPress images loaded successfully. Lazy images
  are forced eager only inside the visual harness so below-fold failures are
  checked. Desktop/mobile public captures were inspected, including artwork
  transparency/alignment and comparison with the immutable original revision.
- Native build output includes a 178,806-byte 1280px cafe background versus the
  36,567,774-byte original; the 640px mirror variant is 23,358 bytes versus
  1,715,740 original bytes. These are specific generated variants, not whole-page
  transfer totals. Native browser tests check selected responsive downloads too.
- Original media/source HTML and `legacy.json` remain unchanged. Static page
  image comparisons retain canonical `data-original-src` identities rather than
  requiring optimized delivery URLs to equal archival source URLs.
- Vercel output passed, including legacy aliases and native `/_image` routing.
  The ordinary Node build was restored afterward. This is build/routing evidence,
  not a deployed Vercel-runtime or hosting-protection acceptance check.
- Independent review found no blocking correctness/privacy issue. Native
  per-render metadata latency and the lack of live Vercel execution coverage are
  documented limitations; no bespoke caching/proxy mechanism was added. The
  mechanical design detector returned no findings for the changed public UI.

No deployment, public launch, production acceptance, credential/protection change,
database migration, Worker change, original deletion, or WordPress storage
migration occurred. Existing editor chunk-size/audit caveats remain unchanged.

### Remaining template image — 2026-11-09

Converted the cat toggle to Astro `Image` using untouched public GIF URLs and
explicit per-state dimensions. No raw `<img>` tags remain in `.astro` templates;
archival HTML and BlockNote string rendering deliberately retain them. Both
original GIFs still have sixteen frames. Astro check, 13 unit tests, 12 focused
desktop/mobile image/content/navigation checks, eight unchanged full-page visual
snapshots, Vercel output, and the final Node build passed. The initial browser
attempt encountered a temporary occupied fixture port; retry passed without
reusing or stopping user servers, changing assertions, or updating baselines.

### Development toolbar image audit — 2026-11-09

Reproduced all twenty optimized post images matching Astro's
`perf-use-image-component` selector because the HTML renderer omitted the
development-only audit marker. Astro's own content renderer adds that same marker
after `getImage()`. Successfully transformed post images now follow this native
convention; unchanged/failed sources are not marked and production omits it.
The running development page was checked against Astro's actual audit rule:
twenty optimized/recognized post images, zero image-component audit candidates.
No BlockNote import, archived HTML rewrite, or global audit suppression occurred.
The new isolated `test:images:dev` regression passed, as did Astro check, 13 unit
tests, 12 focused desktop/mobile browser checks (including production marker
absence), eight unchanged visual snapshots, Vercel output, and the restored Node
build. The user's existing development server was not restarted or stopped.

## Reading interface and direct publishing — 2026-11-09

Owner-selected changes: inverted public selection; borderless post panels;
single-line viewport-fitted site heading; doubled intentional paragraph/line-break
spacing without doubling wrapped leading; descriptive alt text and iframe titles;
pointer/keyboard cat toggle; direct publication with optional, read-only Preview.
The owner's final steering replaces the original gallery controls with **only an
enlarged image and X close**, and selects **8px mobile padding** (half desktop's
16px), retaining glitter gutters and paragraph margins.

- Astro check passed: no errors/warnings, only the existing beforeunload hint.
- All 17 unit tests and 54 desktop/mobile browser tests passed. Coverage includes
  title fitting from 320–1920px, inverted selection, mobile padding, alt/title
  metadata, minimal viewer controls/focus/scroll/error states, cat keyboard/pointer
  behavior, direct publish without preview, preview without save, draft/live
  status after reload, saved-draft retention on publication failure, and conflicts.
- `test:images:dev` passed for twenty optimized post images and their alt/title
  attributes. The actual running Astro audit also returned zero
  `a11y-img-redundant-alt` and `a11y-missing-attribute` findings. This is evidence
  for those checks, not a blanket claim about all accessibility rules.
- Eight full-page visual references were intentionally updated for the approved
  title/border/spacing changes, then passed a separate non-update run with zero
  changed pixels and no failed local/WordPress assets. Original Git references and
  `legacy.json` were not regenerated. Comparison tests preserve original source
  identities and copy while explicitly permitting the requested alt/title changes.
- A mobile viewer capture was initially taken before decoded pixels painted.
  The capture now awaits `decode()` and two paint frames and asserts nonzero
  intrinsic/rendered dimensions and viewport containment. Both targeted desktop/
  mobile reruns passed and the replacement capture contains the actual image.
- Vercel output/legacy aliases/native image routing and the final ordinary Node
  build passed. Fixture/Vercel output was not left as the ordinary build.
- Code review follow-ups addressed hidden mobile-inventory focus and viewer Tab
  boundaries. The recovery/navigation UI from the initial gallery was removed
  with the owner's simplification; only X/Escape/background dismissal remains.
- Mechanical design review reports the temporary 100px heading-measurement size
  and existing 4px structural admin divider. These are not an extra type step or
  an added accent-card treatment; the documented fit-to-width/4px system remains.

Save draft remains manual/private. Publish saves current edits when needed and
uses the returned revision directly; a failed save stops publication, while an
uncertain publication response preserves the saved draft and requests verification.
Existing timestamps provide reload-safe newer-draft status without SQL/schema or
authorization changes. BlockNote's supplied styles remain isolated and unchanged.

Original media/archival HTML, upload validation/sealing, RLS/RPC locks, private
preview delivery, native cached-image semantics, and per-project membership remain
unchanged. No production write, deployment, protection change, original deletion,
storage migration, or shared Worker change was performed. Real authenticated
production acceptance and actual deployed Vercel-runtime checks remain separate.

Final independent frontend finish review: **SHIP** for all fourteen supplied
public/artwork/viewer/error/admin desktop/mobile captures, with no material
blockers. This is not production-launch authorization. The optional pre-existing
`.impeccable/design.json` metadata snapshot trails the updated DESIGN.md and was
left untouched rather than bundling an unrelated drift-repair operation.
