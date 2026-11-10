# Post image viewer

Mode: Experience. Extend the existing handmade public site, not a replacement identity.

## Direction contract

THESIS: Let a reader inspect a post's images without losing their place in the writing.

OWN-WORLD: Black canvas, an unboxed white X, a square 4px keyboard-focus outline,
and inverted hover state. Images remain unfiltered, proportional, and uncropped.

STORY: Activate a post image, inspect it enlarged, then close and return to the
same image and scroll position. Cat and artwork navigation stay separate.

FIRST VIEWPORT: Only the enlarged image on black and a single X close button.
No arrows, counter, visible heading, or caption bar. Mobile inset is 8px versus
16px on desktop. A simple failure message never hides the close control.

FORM: Native modal dialog with a labeled X control and protected keyboard focus;
no React/editor bundle, custom image backend, or decorative dashboard chrome.
Seed: none (user-pinned existing visual world).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
