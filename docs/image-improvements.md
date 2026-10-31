# Optional image improvements — staged, not implemented

The Astro conversion preserves every original published media byte and URL.
Authenticated new-image uploads are part of publishing; optimization and existing
media migration are deliberately separate.

## Stage 1: derived delivery assets

- `3.png` is 36,567,774 bytes at 5712×4284. Generate a suitably sized derivative
  for its CSS background, compare artwork fidelity at actual screen sizes, and
  retain the original unchanged.
- `assets/favicon/favicon.svg` is 1,873,034 bytes. Inspect its embedded raster data
  before creating a smaller equivalent and testing icon behavior across browsers.
- Consider responsive derivatives for the 2316×3088 collage layers and 1440×960
  mirror layers. Preserve alignment, transparency, and screen blend behavior.
- Do not transcode animated GIFs as still images. Preserve timing, transparency,
  and the normal/exposed cat's different dimensions.

Accept only after desktop/mobile screenshot comparisons, smaller transferred
bytes, retained source checksums, and unchanged layout/interaction tests. Use new
derived filenames; do not overwrite originals to hide a visual regression.

## Stage 2: remove the WordPress dependency, if approved

There are sixteen WordPress-hosted images. They returned HTTP 200 during the
investigation, but that is not an archival guarantee. Inventory original versus
query-sized variants, acquire and checksum the intended sources, and copy them to
site-owned storage without removing the old references until verified. Avoid
bundling WordPress migration into ordinary post editing.

## Stage 3: scalable published delivery

New originals initially stay in a dedicated private R2 bucket with database-gated
app delivery. If traffic warrants shared Worker/image transformations, design the
published/staging boundary in the owning infrastructure repository, assess other
sites' routes, and obtain separate provisioning/routing/deployment approval.
Draft and incoming objects must never become Worker-readable accidentally.

No new shared routing, optimization, backfill, source retirement, cleanup, or
production mutation is authorized by this document.
