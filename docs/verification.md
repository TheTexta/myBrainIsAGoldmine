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

## Public production access — 2026-11-09

After the owner-requested merge/push to `main` at `406589c`, Vercel reported
production deployment `dpl_3AyPtVopS6K6RJA9s6RL4MuXNxpF` as `READY`. The owner
explicitly approved making the canonical production domain public while keeping
previews and deployment-specific URLs protected.

- Changed only Vercel Authentication's deployment type from `all` to
  `prod_deployment_urls_and_all_previews`. A fresh project read confirmed that
  exact mode persisted with Authentication still enabled. The canonical project
  domain is verified and has no branch override or redirect.
- Independent anonymous HTTP checks used no cookies, authorization/bypass headers,
  or automatic redirect following. `https://my-brain-is-a-goldmine.vercel.app/`
  returned HTTP 200 with the actual site title/content, not Vercel login.
- The current production deployment-specific URL and the initial protected
  acceptance preview (`my-brain-is-a-goldmine-md8t3blpv-thetextas-projects.vercel.app`)
  both returned HTTP 302 to Vercel's `/sso-api` login flow.
- Anonymous `/api/admin/posts` returned HTTP 401 JSON:
  `{"error":"Sign in to continue."}`. Application authentication and editorial
  authorization were not changed.

No new deployment/promotion, schema/storage/Worker mutation, or authenticated
content write was performed for this access-setting change. Live authenticated
sign-in/upload/sealing/preview/publish/unpublish/session/concurrency/embed acceptance
remains pending; these public-access checks do not replace it.

## Paper posts, viewport CRT, floating images, and mobile administration — 2026-11-09

Local implementation only, following the owner's successive refinements:

- Post wrappers have zero outer margin and use parent flex centering. Only
  horizontal padding is halved to Tailwind `px-2` / `px-1` (8px/4px); vertical
  padding remains 16px/8px. Paragraph/heading margins remain unchanged. Explicit
  `left: 0` restores the cat after flex centering affected its static position.
- The supplied recycled-paper JPEG was moved, with owner permission, to
  `src/assets/textures/white-recycle-paper-texture.jpg`. Its bytes and SHA-256
  `d36ca3250c1417a7449c6cbe6a1af4cf58218e6826513a9719d06d1a548b216b` are unchanged.
  Native Astro supplies a 1320px WebP to both public posts and read-only previews.
  Black text-only blocks use multiply; photographs/embeds do not. Selection and
  image-link focus switch to a visible black/white treatment on paper.
- The final CRT request supersedes the initial background-only version. A
  transparent, viewport-fixed scanline/phosphor mask sits above all homepage
  content, including the native viewer, without intercepting mouse/touch/focus.
  A manual popover supplies top-layer ordering; the fallback moves into the active
  modal. White/black pixel-patch checks establish actual visible compositing above
  a dialog, not just a high z-index. No scroll/time uniform moves the mask. The
  owner accepted the current strength; no further intensity change was bundled.
  This is a spatial adaptation of TVM/Lottes, not DOM capture or full-frame image
  reconstruction. The original GIF remains native; the abandoned atlas was removed.
- Five visually inspected original-image URLs were associated with Mallory's
  linked public interesting-stuff board via public embedded image signatures.
  No login, cookies, gated resource API, or substituted profile was used. Local
  originals, board-level evidence, descriptions, dimensions, and hashes live under
  `src/assets/floating-pinterest/`; Astro provides native responsive WebP variants.
  Original creators, individual pin identities, and redistribution licences remain
  unverified. These are local-trial samples, not cleared production assets.
- Floating images use full-document coordinates, not the viewport. They bounce
  off document boundaries and all post rectangles with 6px clearance; candidate
  positions are checked against adjacent zero-margin posts too. Layout/height
  changes refresh cached geometry without rebasing on scroll. Reduced motion/data
  saver freeze them, hidden tabs/viewers stop animation, and insufficient space
  hides them. The layer is out of flow and does not create height feedback.
- Unpublish is a directly visible secondary action rather than a More disclosure.
  Confirmation, saved-draft/upload/revision safeguards, and authorization remain.
  Mobile header/action grouping and explicit grid rows remove the stretched empty
  entry-picker area without changing BlockNote/Mantine styling.

Completed checks on this integrated implementation:

- Astro check: zero errors/warnings; existing beforeunload deprecation hint only.
- All 25 unit tests and 72 desktop/mobile browser cases passed, including native
  image/privacy paths, current-edits publishing, previews, conflicts, and denial.
- Floating cases verify actual movement, five decoded native variants, responsive
  geometry with 6px clearance, full-document positions across scrolling, hidden/
  reduced-motion/dialog/no-room states, and late content growth/shrink without
  document-height feedback. The native URL test accepts Astro's `f=webp` route,
  rather than incorrectly requiring a `.webp` filename.
- All 28 archival-source checksums and the relocated paper source are unchanged.
  Source HTML and immutable legacy fixtures were not regenerated. The explicitly
  added decorative images are excluded only from the archival-image identity list.
- An independent implementation review found no material lifecycle/geometry/layer
  defects; late-resize and clearance coverage was strengthened after its feedback.
  Actual hardware GPU budgets and a real browser BFCache round trip are not claimed.
- Mechanical review reports only the pre-existing 4px admin column divider; it is
  structural, not a new accent-card border. No detector suppression was introduced.

No push, deployment, production content/storage/database mutation, authorization
migration, or TVM source change was performed. Production remains separate from
this local trial; live authenticated publishing acceptance and Pinterest asset
rights confirmation are still outstanding.

Final follow-up checks:

- Six floating-image browser cases passed again after making reduced-motion
  placement independent of font/image load order.
- Two additional desktop/mobile pixel checks passed: CRT-on versus CRT-off
  changes actual glitter pixels, and a fixed white test surface retains identical
  scanline pixels while the underlying document scrolls. This verifies background
  coverage and viewport locking rather than relying only on style declarations.
- The two homepage full-page goldens were intentionally refreshed for paper,
  margins, floats, and overlay; the six artwork references remain unchanged.
  All eight then passed a separate non-update run with zero changed pixels and
  no failed remote assets. The overlay stays enabled; reduced motion freezes
  decorative backgrounds for reproducible evidence.
- Vercel output/legacy aliases/native routing passed, followed by a successful
  ordinary Node build. The final build is not a fixture-configured test build.
  The existing editor chunk-size warning remains; no unrelated bundling refactor
  was added.

Final independent screenshot/source finish review: **SHIP for the local trial**.
The earlier cat-over-writing finding is resolved by explicit left anchoring and
fresh desktop/mobile captures. No material paper, overlay, floating-image, viewer,
artwork, or mobile-admin defect remained in the inspected evidence. This does not
grant production or image-rights approval; the additional CRT pixel proofs above
were completed by the parent after the review's supplied status was prepared.

## Post padding and sparkle parallax follow-up — 2026-11-09

The owner's subsequent requests set all post containers, including read-only
previews, to `py-8` (32px top/bottom). Horizontal `px-2` / mobile `px-1`, zero outer
margins, and paragraph/heading margins are unchanged. Ten focused desktop/mobile
reading, preview/publishing, layout, floating-collision and height-refresh checks
passed for the padding change. The first snapshot update encountered a filesystem
`EIO` read; subsequent reads confirmed both PNG files remain valid and adequate
disk space was available. No original/reference asset was deleted or reset.

Sparkles now move at two-thirds document speed via a background-position offset
of `scrollY / 3`; posts retain normal scrolling and CRT remains viewport-fixed.
Only homepage/legacy alias mount the passive, RAF-coalesced listener. Reduced
motion opts out; hidden/BFCache lifecycle cleanup avoids stale queued work.
All 30 unit tests and six dedicated desktop/mobile parallax cases passed. Actual
pixel checks freeze the GIF without enabling reduced motion and establish that
600px document scroll advances the 400px repeating texture by exactly one tile;
post position still advances 600px. Artwork/admin, preference changes, and hidden/
resume behavior were checked separately.

## Individual paper posts and supplied-media release preparation — 2026-11-10

The owner confirmed that every entry should have its own paper container with
visible sparkle-filled space between posts and above the first. Rendering now
flattens the legacy display groups into eleven independent entry containers;
publication/grouping metadata and original content remain unchanged. Paper URL
variables are local to each post and to its preview container, not the page body.
The transparent feed uses `gap-8` and `pt-8`; each post's outer margin stays zero.
Live development inspection confirmed eleven single-heading containers, ten 32px
gaps, a sparkle page background, and no body-level paper variable.

During final checks, newer local CSS edits removed shared artwork padding, set
post padding to `p-0`, and removed the Spotify wrapper margin. These edits were
not made by the agent. Rather than overwriting them, the owner was asked and
explicitly selected **Preserve current p-0**. The mobile `px-1` override remains.
Tests/current design documentation now reflect that approval, superseding the
earlier internal `py-8` request; parent spacing is still 32px.

The owner then supplied 16 files from the local mallory site photos folder and
explicitly chose the MOV as a playing clip. All five Pinterest placeholder JPEGs
and their manifest/directory were removed. App web copies are now:

- Fourteen auto-oriented, metadata-stripped JPEG photos under
  `src/assets/floating-images/`, capped at a 1600px edge; native Astro supplies
  responsive WebP variants.
- A small animated GIF retaining both source frames, exact frame delays and loop,
  with a static fallback. The native GIF lives under `public/floating-media/`.
- A silent H.264 MP4 under `public/floating-media/`, plus a native-optimized poster.
  It is muted, looping, inline, control-free, and does not preload offscreen.
- Source/output hashes, image dimensions and processing records in
  `src/assets/floating-images/provenance.json`. Every supplied Downloads original
  was reread and checksum-verified unchanged during preparation.

GIF/video animation is visibility-gated and pauses for reduced motion, data saver,
hidden documents, open viewers, no-room layouts and disposal. Browser tests verified
actual video time progression/offscreen pause and GIF source switching. A final
read-only implementation review found no blocking lifecycle/media-ownership issue.
The reduced-motion first-static-frame timing race found in an earlier full run was
fixed in the renderer without weakening the freeze assertion.

The owner explicitly authorized commit and push on `main`, which triggers Vercel's
configured production deployment. No database, storage-service, shared Worker,
authorization, original-asset retirement or manual promotion is included.

Before committing, the latest local ink colour changed to `#181818` and the
Spotify wrapper margin rule was restored. Those local choices were preserved;
colour assertions now check the actual charcoal value in both posts and previews.

Pre-push results and explicit release exception:

- The latest full browser run passed 80/84 cases; four remaining assertions still
  expected pure black rather than the newer local `#181818` ink. After preserving
  that edit and updating those exact expectations, all four focused desktop/mobile
  reading/publishing cases passed. All 30 unit tests passed.
- The refreshed eight visual references passed a separate non-update comparison
  with zero changed pixels and no failed remote assets. These pixel matches do
  **not** establish responsive correctness: real-font captures revealed expanded
  widths on the homepage and intro artwork page.
- Investigation found a newer local `SiteHeader.astro` edit removing the automatic
  title-fitting script and markers. The owner was shown the mobile-overflow/header-
  test consequence and explicitly selected **Push current header as-is**. That edit
  is preserved, not reverted. The fit regression remains in place and is expected
  to fail against that header until the behavior or requirement is revised; no
  suppression/baseline rewrite claims to resolve it. Final frontend release is
  therefore owner-accepted with a known issue, not an unconditional visual SHIP.
- Node and Vercel builds passed, with legacy aliases/native routing intact and the
  ordinary Node build restored after fixture checks. Existing beforeunload/chunk
  warnings remain. Source checks verified all 16 supplied originals and all 28
  archival assets unchanged. The Pinterest placeholder source folder is gone.

The owner-authorized push includes these known local choices. No production
authenticated acceptance, database/storage mutation, or manual promotion is claimed.

The staged snapshot additionally preserves the final local white image borders,
`text-4xl` post headings, responsive header type classes, `gap-32` (128px) and
`pt-16` (64px). These supersede the earlier 32px gap/top-spacing expectations.
The existing fit and 32px-spacing regression assertions were not suppressed, so
the full suite is not represented as green for this owner-requested as-is snapshot.
The earlier eight-reference pixel matches predate these last spacing/type tweaks;
they are historical evidence, not proof that the latest header overflow is fixed.
