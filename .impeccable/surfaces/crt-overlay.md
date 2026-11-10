# Homepage CRT overlay

Mode: Experience around the existing Read surface; retain the site's identity.

THESIS: The owner's later steering overrides the initial background-only trial:
place the CRT above everything on the homepage, including native image dialogs,
with every mouse/touch event passing through. Only the CRT stays viewport-fixed;
scrolling content and full-document floating images move underneath its scanlines.
The sparkle backdrop uses two-thirds scroll speed; this is independent of the
viewport-fixed CRT, and reduced motion restores normal backdrop scrolling.

SOURCE: TVM Archive's `lib/crt-screen.ts` and Timothy Lottes' public-domain CRT
shader (https://www.shadertoy.com/view/XsjSzR). Keep attribution. This port retains
the spatial Gaussian beam profile, RGB grille, and pattern curvature, not footage
reconstruction or a geometric warp/capture of DOM/iframes. No bloom, noise, extra
flicker, model, cabinet lighting, or new palette. Current overlay strength is accepted.

SCOPE: `src/components/CrtOverlay.astro`, only on `/` and the `/index.html` rewrite.
Transparent WebGL2 plus multiply compositing; no textures or permanent animation
loop. `pointer-events:none` applies to canvas and backdrop; it is inert/aria-hidden,
with no pointer/focus handlers. Manual popover orders it above native dialogs;
unsupported popovers reparent into the active dialog. No global foreground wrapper.

STATES: Native page remains usable without WebGL, after context loss, or with
`?crt=off`. Original GIF remains unchanged; reduced motion has a first-frame PNG
fallback with source provenance. Bound GPU output, pause hidden-tab work, and clean
up observers/listeners/resources. No admin/artwork-route overlay or deployment.

VERIFY: Visible mask over white pixels/unaltered black pixels above a native modal,
all input passing through, popup fallback, viewport anchoring while scrolling,
cat at left, context loss/opt-out, keyboard viewer restoration, desktop/mobile.
