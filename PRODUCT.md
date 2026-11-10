# My brain is a goldmine

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users and purpose

The public site presents Mallory's writing, artwork, photographs, and music/video
embeds. Authorized editors need to edit existing writing, create entries, save
drafts, upload images, preview, and publish through BlockNote in the browser.

## Stack

Astro and Tailwind v4, with a browser-only React/BlockNote editor. Supabase provides shared
identity and site-isolated database permissions. New image originals use private
R2 storage. Production activation is a separate approval gate.

## Capabilities and constraints

- BlockNote JSON, not Markdown or MDX, is the editable document format.
- Original content stays live until an editor deliberately publishes a replacement.
  Original grouping metadata is retained, but each entry renders in its own paper
  container. HTML import can simplify layout; preview must make that visible.
- Draft content and draft-only uploads must not be available anonymously.
- Public visitors must not download editor dependencies.
- Existing URLs, artwork, animation, and the public site's visual identity are retained.
- Site-owned layout, artwork offsets, and borders use a 4px scale. BlockNote and
  Mantine retain their supplied styling; do not manually override their CSS hooks.
- Public still images use native Astro responsive optimization, including
  published R2 images. The owner accepts native cached copies outliving unpublish;
  private previews never enter the optimizer, and originals remain retained.
- Publishing is explicit and direct: save current edits if needed, then publish.
  Preview is optional and does not save. Save draft remains private and manual.
- Public reading uses borderless post panels, inverted selection, an unbroken main
  heading, and a fullscreen image view with only an X close control. The owner
  accepted the current CSS-only header without automatic fitting, including its
  known narrow-layout overflow and fit-test mismatch.
- Post wrappers have zero outer margin. The owner's latest local `p-0` edit is
  retained, with mobile `px-1` horizontal padding; paragraph/heading margins remain
  unchanged. The latest local parent spacing is `gap-32` between
  individual posts and `pt-16` above the first, exposing sparkles in those spaces.
- Post bodies use the supplied recycled-paper texture with black multiply ink.
  Keep photographs/embeds out of the text blend, optimize through native Astro,
  preserve the source, and show the same paper treatment in read-only previews.
- The homepage alone adds a viewport-fixed, transparent CRT mask above all its
  content, including the viewer; all input passes through. The pattern stays
  screen-locked while the document scrolls. Artwork pages/admin remain unaffected.
- Homepage sparkles scroll at two-thirds speed; posts and floats keep ordinary
  document scrolling. Respect reduced motion without transforming content layers.
- The owner's 14 photos, animated GIF, and muted looping video float in full-document
  coordinates behind posts, bouncing off post rectangles and document edges.
  Preserve native delivery, no-input/reduced-motion/offscreen states and source
  provenance. Prepared app copies are separate from unchanged Downloads originals;
  all Pinterest placeholders are removed.
- Unpublish is directly visible, not hidden under More; preserve its confirmation
  and saved-draft/revision safeguards. Mobile administration stays compact without
  overriding BlockNote styling.
- Shared identity does not grant this site's editorial access.

## Evidence on hand

The original four HTML pages and media are preserved in Git revision
`2773eda0194d60270857693f32b2efb9f69230e0`. The conversion preserves the public
media URLs and original bytes. Backend provisioning and a protected Vercel preview
were approved separately. The owner opened the canonical production domain on
2026-11-09; live authenticated publishing acceptance remains pending. See
`docs/publishing.md`. The CRT/floating-image work is a separate local trial, not a release.

## Brand commitments

Faithful conversion: retain the site's own language, handmade black-and-white
presentation, glitter, Tinos typography, collage imagery, and playful interactions.
The editor is a working publishing surface, not a redesign of the public site.
