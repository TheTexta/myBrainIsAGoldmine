---
name: My brain is a goldmine
description: Preserved public presentation and separately scoped publishing controls.
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
  admin-ui:
    fontFamily: "system-ui, sans-serif"
rounded:
  admin-control: "0"
spacing:
  public-panel-padding: "1rem"
  public-paragraph-margin: "1rem"
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
    padding: ".65rem .9rem"
  admin-button-primary:
    backgroundColor: "{colors.admin-ink}"
    textColor: "{colors.admin-paper}"
    rounded: "{rounded.admin-control}"
    padding: ".65rem .9rem"
  admin-input:
    backgroundColor: "{colors.admin-paper}"
    textColor: "{colors.admin-ink}"
    rounded: "{rounded.admin-control}"
    padding: ".65rem .75rem"
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

Public writing uses white text and solid borders on black panels over repeating
glitter. Existing artwork supplies its own colors. Do not recolor media.

Admin uses the separately named neutral tokens above. Blue is keyboard focus,
not a new public brand accent. Success/error messages use local status colors.

## Typography

Public writing uses Tinos regular, with existing bold/italic variants, reducing
to 15px at 482px and below. The shared header is 60px, reducing to 48px; its
face remains inherited rather than being reassigned to Tinos.

Admin uses the system stack. Its site link and title input use Georgia/serif.
BlockNote retains its supplied light-theme editing typography. The content-only
preview loads public CSS and Tinos; it does not reproduce the whole homepage.

## Layout

Preserve public page compositions and local overrides. Centered writing panels
are 660px border-box, switching to 70vw at 660px and below, with top separation
`min(15vw, 7vh)`. The introductory panel deliberately retains its different
box-sizing. Shared images normally use 90% width; collage rules remain local.

Admin uses a `minmax(15rem, 19rem)` entry column and flexible writing area. At
760px and below, entries precede the editor. Actions wrap, controls have a 44px
minimum height, and secondary insertion tools use a native disclosure.

## Elevation & Depth

Shared public/admin styles use borders instead of shadows. Public depth comes
from original layered imagery, blend modes, glitter, and the footer fade.
BlockNote's supplied interface styling remains separately scoped.

## Shapes

Public panels, links, and images retain solid borders. Admin buttons and inputs
have square corners and thin borders. Do not impose admin geometry on artwork
or third-party editor UI.

## Components

Public header wording and optional navigation action are preserved. Large links
retain glitter hover; the footer credit is a smaller borderless exception.
Published prose links are inline and underlined. Cat toggles, mirror layers,
image swaps, and GIF dimensions are individual artwork behavior, not tokens for
new components.

The operational editor keeps a plain writing surface, neutral controls, visible
focus outlines, disabled states, entry selection, and explicit save/publication
status. Draft saving, content preview, and deliberate publication stay distinct.

## Do's and Don'ts

- Do use original pages and asset checksums as fidelity references.
- Do isolate editor styling from public presentation.
- Do retain page-specific layout and interaction exceptions.
- Don't substitute a new identity, palette ramp, or typography system.
- Don't silently replace live content with a lossy editor import.
- Don't promote legacy accessibility/geometry quirks into new component rules.

Sources: `public/style.css`, `src/layouts/SiteLayout.astro`, shared public
components/pages, `src/styles/admin.css`, and `src/components/admin/`.
