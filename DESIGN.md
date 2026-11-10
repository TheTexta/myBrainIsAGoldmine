---
name: My brain is a goldmine
description: Handmade public presentation, 4px site layout, and vendor-styled BlockNote.
colors:
  public-black: "rgb(0, 0, 0)"
  public-white: "rgb(255, 255, 255)"
  admin-ink: "#161616"
  admin-canvas: "#f4f4f4"
  admin-paper: "#fff"
  admin-control-border: "#777"
  admin-control-hover: "#e5e5e5"
  admin-primary-hover: "#383838"
  admin-muted: "#555"
  admin-divider: "#b8b8b8"
  admin-focus: "#3267b1"
typography:
  public-writing:
    fontFamily: '"Tinos", serif'
    fontSize: "18px"
    fontWeight: 400
  public-writing-mobile:
    fontFamily: '"Tinos", serif'
    fontSize: "15px"
  public-header:
    fontFamily: "inherit"
    fontSize: "7vw"
  public-header-mobile:
    fontFamily: "inherit"
    fontSize: "7vw"
  public-heading-and-link:
    fontFamily: "inherit"
    fontSize: "32px"
  public-footer:
    fontFamily: "inherit"
    fontSize: "1rem"
  admin-ui:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1rem"
  admin-heading:
    fontFamily: "system-ui, sans-serif"
    fontSize: "1.2rem"
  admin-site-link:
    fontFamily: "Georgia, serif"
    fontSize: "1.4rem"
  admin-site-link-mobile:
    fontFamily: "Georgia, serif"
    fontSize: "1.15rem"
  admin-title:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(1.2rem, 2vw, 1.8rem)"
  admin-detail:
    fontFamily: "system-ui, sans-serif"
    fontSize: ".85rem"
rounded:
  admin-control: "0"
spacing:
  public-panel-padding: "1rem"
  public-paragraph-margin: "2rem"
  public-panel-padding-mobile: ".5rem"
components:
  public-writing-panel:
    backgroundColor: "{colors.public-black}"
    textColor: "{colors.public-white}"
    padding: "{spacing.public-panel-padding}"
    width: "660px"
  admin-button:
    backgroundColor: "{colors.admin-paper}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.admin-control}"
    padding: ".75rem 1rem"
  admin-button-primary:
    backgroundColor: "{colors.admin-ink}"
    textColor: "{colors.admin-paper}"
    rounded: "{rounded.admin-control}"
    padding: ".75rem 1rem"
  admin-input:
    backgroundColor: "{colors.admin-paper}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.admin-control}"
    padding: ".75rem"
---

# Design System: My brain is a goldmine

## Overview

This records the implementation, not a replacement identity. The public site
retains its handmade black-and-white presentation, glitter, Tinos writing,
collage imagery, original language, and playful interactions.

The publishing editor is a separate working surface. Its light canvas and
familiar BlockNote controls do not redefine the public site. Product constraints
remain in `PRODUCT.md`; editor strategy is in `.impeccable/surfaces/admin.md`.

## Colors

Public writing uses white text on borderless black panels over repeating glitter.
Artwork panels and image frames retain their borders. Existing artwork supplies
its own colors. Do not recolor media.

Admin uses the separately named neutral tokens above. Blue is keyboard focus,
not a new public brand accent. Success/error messages use local status colors.

## Typography

Public writing uses Tinos regular, with existing bold/italic variants, reducing
to 15px at 480px and below. Intentional paragraph/break spacing is doubled;
automatic line wrapping keeps its normal leading. The shared site heading is
one unbroken line fitted to the available viewport width using actual rendered
font metrics (7vw CSS fallback). Its face remains inherited rather than being
reassigned to Tinos. Post titles keep normal wrapping. Public text selection is
white background/black text, inverting the usual panel colors.

Admin uses the system stack. Its site link and title input use Georgia/serif.
Typography is not forced onto the 4px layout scale. BlockNote retains its supplied
light-theme editing typography, spacing, and controls, without custom CSS hooks. The content-only
preview loads public CSS and Tinos; it does not reproduce the whole homepage.

## Layout

Preserve public page compositions and local overrides. Centered writing panels
are 660px border-box, switching to 70vw rounded down to 4px at 660px and below,
with top separation `min(15vw, 7vh)` rounded to the nearest 4px.
Post panels have no borders; mobile internal padding is 8px (half desktop) while
glitter gutters and paragraph margins remain. The introductory panel retains its different
box-sizing. Shared images normally use 90% width; collage rules remain local.

Admin uses a `minmax(15rem, 19rem)` entry column and flexible writing area. At
760px and below, entries precede the editor. Actions wrap, controls have a 44px
minimum height, and secondary insertion tools use a native disclosure. On phones,
the entry inventory collapses after selection and can be reopened explicitly.

## Elevation & Depth

Shared public/admin styles use borders instead of shadows. Public depth comes
from original layered imagery, blend modes, glitter, and the footer fade.
BlockNote's supplied interface styling remains separately scoped.

## Shapes

Post panels are borderless; artwork panels, links, and images retain solid borders.
The viewer X is unboxed, with a square keyboard-focus outline. Admin buttons and inputs
have square corners and 4px borders. Site-owned artwork offsets and borders use
the same 4px scale. Do not impose it on third-party editor UI or distort image
aspect ratios to make intrinsic dimensions land on that scale.

## Components

Public header wording and optional navigation action are preserved. Large links
retain glitter hover; the footer credit is a smaller borderless exception.
Published prose links are inline and underlined. Cat toggles, mirror layers,
image swaps, and GIF dimensions are individual artwork behavior, not tokens for
new components.

The operational editor keeps a plain writing surface, neutral controls, visible
focus outlines, entry selection, and explicit save/publication status. Save draft
is private and secondary. Publish/Update is the primary action and saves latest
edits before publishing directly. Write/Preview switches the content view;
previewing never saves and is not a prerequisite for publication. Unpublish lives
under More. No automatic background saving or BlockNote CSS overrides are added.

Post images open a native fullscreen dialog with only the enlarged image and a
single X close button. Black/white and square 4px geometry match the site; the
close control inverts on hover. Escape/X restores focus and scroll. Mobile viewer
inset is also half desktop (8px/16px). GIFs remain animated; no arrows, counter, or
caption bar are added. Cat and artwork navigation do not open the viewer. The cat
is a labeled native toggle with a pointer cursor in both states.

## Do's and Don'ts

- Do use original pages and asset checksums as fidelity references.
- Do isolate editor styling from public presentation.
- Do retain page-specific layout and interaction exceptions.
- Don't substitute a new identity, palette ramp, or typography system.
- Don't silently replace live content with a lossy editor import.
- Don't promote legacy accessibility/geometry quirks into new component rules.

## Styling implementation

Tailwind v4 runs through `@tailwindcss/vite`. `src/styles/tailwind.css` imports
the theme and utilities without Preflight, so no broad reset changes original
prose defaults or BlockNote/Mantine. Repeated semantic rules use Tailwind
`@apply`; isolated artwork geometry remains ordinary CSS.

Site-owned spacing and fixed dimensions use integer steps of `--spacing: .25rem`
(4px at the default root size). Visible site borders use 4px, or zero when absent.
Fluid artwork offsets use CSS `round()` with that same step rather than being
replaced by fixed desktop coordinates. Full-size anchors, centering, image aspect
ratios, typography, and third-party player/editor internals remain proportional.

`src/styles/public.css` is emitted as a shared URL for both live public pages and
sandboxed draft previews. `/style.css` remains an untouched archival asset and is
not loaded by either. Admin rules target only site-owned classes; never add
`.bn-*` / `.mantine-*` overrides, global control rules, or a custom BlockNote theme
to force the editor onto the site scale. Tailwind needs no BlockNote adapter or
compatibility switch. The supplied Mantine view remains in use.

Public still-image variants use native Astro `Image` / `getImage()`; no global
Astro responsive styles override the Tailwind artwork rules. Intrinsic image
attributes plus `height: auto` preserve aspect ratios. Cafe/collage backgrounds
use responsive CSS `image-set()` sources without changing their compositions.
GIFs remain original. Optimization changes delivery, not BlockNote styling or
stored content; see `docs/image-improvements.md` for caching and privacy boundaries.

`test:visual` compares reviewed full-page screenshots in
`tests/fixtures/tailwind-visuals/`, retaining full-page comparison artifacts against
the original Git revision as historical evidence. To deliberately create new
styling snapshots, run `npm run test:visual -- --update-baseline`, inspect all
eight desktop/mobile captures, then rerun without that flag. Never regenerate
`tests/fixtures/legacy.json` from the current app to accept a styling change.

Sources: `src/styles/`, `src/layouts/SiteLayout.astro`, shared public
components/pages, and `src/components/admin/`. Original reference: `public/style.css`.
