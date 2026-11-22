# Graphics and supplied media

For paper, typography, spacing, viewer controls, and editor styling, see the
[design system](../DESIGN.md).
For responsive stills and publication/cache boundaries, see [image delivery](image-improvements.md).

## Gallery behavior

Homepage glitter/side backgrounds and floating media navigate to `/gallery`.
The footer's Gallery link supplies keyboard navigation without changing post or
existing control behavior. The gallery fills the viewport without scrolling and
uses native-optimized `public/3.png` as its cover background.

All sixteen supplied items spawn centrally, larger than on the homepage. They
bounce off viewport edges, not one another. Click or keyboard activation expands
one photo while it keeps moving; reactivation or Escape shrinks it. Resize clamps
items within the viewport. Still-photo enlargement decodes a higher-resolution
candidate off-DOM and presents it over the current bitmap before retiring that
bitmap. Failed/superseded upgrades keep the current image; shrinking retains
warmed copies. GIF/video handling is separate.

## CRT overlay and parallax

The transparent, viewport-fixed CRT overlay on `/`, `/index.html`, and `/gallery`
is adapted from TVM Archive's `lib/crt-screen.ts` and Timothy Lottes'
[public-domain CRT shader](https://www.shadertoy.com/view/XsjSzR)
([GLSL reference](https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl)).
Attribution also remains in `src/lib/crt-overlay.ts`.

It is a screen-locked spatial mask, **not DOM capture, Gaussian reconstruction,
or geometric warping of the page**. Context and output both use premultiplied
alpha. See [stacking, dialog placement, clipping, and parallax](../DESIGN.md#elevation--depth)
for the presentation contract; input and scrolling remain native.

There is no Three.js, React island, texture atlas, or continuous shader loop.
Output resolution is bounded by 1.5× DPR and two million pixels; missing/lost
WebGL leaves native content usable. These are implementation limits, not measured
hardware performance guarantees. Use `?crt=off` for an unfiltered comparison.

The original glitter GIF stays unchanged; its lossless reduced-motion
first-frame still can be regenerated explicitly:

```sh
node scripts/generate-crt-glitter.mjs
```

This overwrites only the generated still/provenance under `public/crt/`, recording
the original checksum; it is not needed for normal builds.

## Floating-media assets and lifecycle

Mallory's fourteen photos, one GIF, and one silent looping video replace the
removed Pinterest placeholders. Homepage placement uses the entire document:
items bounce off post rectangles with 6px clearance and document edges, and
scrolling does not rebase positions. Resize and content-height changes refresh
collisions. Insufficient gutter space hides items instead of covering writing.

Reduced motion/data saver make media still; hidden tabs and open viewers stop
animation. GIF/video playback is visibility-gated. The muted, inline, looping
video has no controls and does not preload offscreen. The homepage floating layer
is inert; clicks pass through to background navigation.

- Stills/posters: `src/assets/floating-images/`, with native Astro WebP variants.
- Animated web copies: `public/floating-media/`.
- Source/output hashes and processing records:
  `src/assets/floating-images/provenance.json`.

Asset preparation is an explicit local workflow, not a build/deployment step:

```sh
node scripts/prepare-floating-media.mjs "/path/to/mallory site photos"
```

It requires installed npm dependencies and FFmpeg for MOV conversion, leaves
supplied originals untouched, and refuses to overwrite existing output assets
or provenance. Run only with intentionally fresh output paths; do not delete
checked-in assets just to rerun it. Web stills are auto-oriented, metadata-stripped,
and capped at a 1600px edge. The GIF retains its frames/timing, with a static
fallback; the MOV becomes a silent H.264 MP4 with a poster. Ordinary builds use
the checked-in prepared assets and need neither FFmpeg nor the source folder.

Run `npm run test:graphics` after installing Chromium/WebKit; see
[development checks](development.md#checks). Historical browser evidence and
physical-browser limitations are in [verification](verification.md), not a claim
of new device acceptance.
