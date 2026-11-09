# Astro image delivery

## Implemented locally — 2026-11-09

Public still images use Astro 7's native Sharp image service. The Vercel adapter
keeps the same service rather than enabling a different platform image product.
Prerendered artwork pages generate static derivatives at build time; the dynamic
feed emits native `/_image` URLs. Browsers choose variants using `srcset` / `sizes`.
This is local source work, not a deployment or proof of production acceptance.

### Public assets and existing writing

- `src/lib/images/sources.ts` imports selected existing files directly from their
  real filesystem paths under `public/`. Those imports produce Astro metadata;
  plain URL strings such as `/3.png` alone would not optimize a public file.
  Original public files and their checksums remain untouched. Astro may also emit
  hashed source copies in the build; this preserves legacy URLs rather than
  retiring originals to reduce deployment size.
- Static page images use Astro `Image`. Mirror layers preserve transparency,
  positioning, and animation. The collage's hover swap updates both `src` and
  `srcset`, so responsive source selection cannot mask the state change.
- `getImage()` generates responsive CSS `image-set()` backgrounds for the cafe
  and collage pages. The cafe original is 36,567,774 bytes; it is no longer the
  active background download. Background height/viewport rules and artwork ratios
  remain unchanged.
- The public feed uses `getImage()` while rendering parsed image elements. Source
  HTML and stored BlockNote JSON are not rewritten. `data-original-src` identifies
  the original source for archival comparisons. Intrinsic dimensions reserve space;
  `height: auto` preserves proportional layout. Below-fold feed images are lazy;
  initial artwork images are eager.
- The sixteen exact WordPress sources have measured dimensions in
  `src/lib/images/settings.ts`. This avoids sixteen request-time dimension probes.
  Native remote authorization permits the existing HTTPS WordPress upload path.
  This is not a WordPress source/storage migration.
- GIFs remain original, including glitter, fog, cat states, and uploaded GIFs.
  No animation is flattened into a still image.
- The cat toggle uses Astro `Image` with a public GIF URL and explicit intrinsic
  dimensions. This is a passthrough component, not a GIF transformation. Its
  script updates the height for each original state (150×229 / 150×329). All
  live Astro template images now use `Image`; archived HTML and BlockNote's safe
  string renderer deliberately retain HTML image tags. Public stills in those
  strings already receive native optimization through `getImage()`.
- In development, successfully optimized feed images receive Astro's
  `data-image-component` audit marker, matching Astro's own HTML content renderer.
  Without it the toolbar incorrectly recommends `Image` even when `getImage()`
  has already generated responsive variants. Untouched/failed optimization paths
  are not marked, production HTML omits the marker, and the audit stays enabled.
  Run `npm run test:images:dev` to check the development-only behavior.

### Published R2 uploads and native caching

The owner explicitly selected native Astro same-origin optimization and accepted
normal caching on 2026-11-09. Do not introduce a custom optimizer guard, proxy,
derivative route/cache, or shared Worker to work around same-origin fetching.

For a published `/media/<uuid>` image, Astro's native `inferRemoteSize()` reads
source dimensions and format, then `getImage()` emits responsive WebP URLs. GIFs
bypass processing. Only the public feed takes this path. Draft previews still
resolve private originals to the existing short-lived signed reads and never
enter the public optimizer. BlockNote/Mantine remains untouched.

`/media/<uuid>` itself still performs the database publication check on every
request and returns original bytes with `private, no-store`. **Optimized copies
have Astro's normal public cache behavior and may outlive unpublishing.** Revoking
the original is not a purge of copies already cached by browsers/CDNs. Do not
promise immediate revocation of previously optimized images. If that requirement
changes, review it separately rather than silently adding another image pipeline.

The native remote allowlist includes exact configured site/preview origins on
`/media/*`, plus localhost's configured development/test port. Set `SITE_URL`
before building a custom-domain deployment. Private R2 bucket origins, signed
query capabilities, and arbitrary remote editor image URLs are not allowlisted.

If a native probe fails (including hosting-level authentication on protected
previews), the page retains the original media URL rather than failing the whole
feed. Verify real transforms on the intended protected preview/canonical origin
before launch; no protection bypass or credential forwarding is added here.

Native uploaded-image dimension probes run on the homepage render path, in
parallel. Their latency still depends on the media service; a stalled native
probe can delay rendering until the platform/network timeout. No custom probe
cache or timeout wrapper was added. For a much larger catalogue, separately
review storing intrinsic dimensions rather than replacing the native pipeline.

## Verification

Representative generated variants from the local build (not whole-page transfer
totals or production measurements):

| Source | Original bytes | Variant | Variant bytes |
| --- | ---: | --- | ---: |
| Cafe background | 36,567,774 | 1280px WebP | 178,806 |
| Cafe background | 36,567,774 | 2560px WebP | 801,662 |
| Mirror base | 1,715,740 | 640px WebP | 23,358 |
| Mirror base | 1,715,740 | 320px WebP | 7,522 |

- `test:e2e` checks actual responsive downloads and byte reductions for local
  artwork and published test uploads, untouched GIF delivery, private previews,
  original byte preservation, and original-route denial after unpublishing.
- Protocol browser tests block WordPress optimization requests before they reach
  the app server so that these fixture tests remain localhost-only.
- `test:visual` exercises real WordPress transforms, loads lazy images for
  full-page snapshots, and fails on broken images. Review compression/transparency
  and layout before intentionally updating snapshots; do not regenerate original
  content/media checksums to accept a derivative.
- Check `currentSrc` / response bytes at desktop/mobile sizes and multiple pixel
  densities; CSS shrinking alone is not a download-size improvement.
- Run Astro checks, unit/browser/visual suites, Vercel output checks, then restore
  the ordinary Node build after fixture builds.

## Still separate

Favicon optimization (the SVG is about 1.9 MB), migrating WordPress sources to
site-owned storage, GIF transcoding, original retirement, persistent derivative
storage, shared Worker routes, production configuration changes, and deployment
are not included. No R2 objects or database schema were changed by this migration.
