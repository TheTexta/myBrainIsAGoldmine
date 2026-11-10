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
- Original content and grouping stay live until an editor deliberately publishes
  a replacement. HTML import can simplify layout; preview must make that visible.
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
- Public reading uses borderless post panels, inverted selection, a single-line
  fit-to-width site heading, and a fullscreen image view with only an X close control.
- Shared identity does not grant this site's editorial access.

## Evidence on hand

The original four HTML pages and media are preserved in Git revision
`2773eda0194d60270857693f32b2efb9f69230e0`. The conversion preserves the public
media URLs and original bytes. Backend provisioning and a protected Vercel preview
were approved separately. Public launch remains gated on live authenticated
acceptance; see `docs/publishing.md`.

## Brand commitments

Faithful conversion: retain the site's own language, handmade black-and-white
presentation, glitter, Tinos typography, collage imagery, and playful interactions.
The editor is a working publishing surface, not a redesign of the public site.
