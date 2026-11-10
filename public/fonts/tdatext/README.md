# TDAText

Unmodified regular TrueType font by Dmitry Tretyakov, licensed under the SIL
Open Font License 1.1. See `LICENSE.TXT` for the copyright and complete license.

- Source: https://github.com/tinelix/TDAText
- Pinned revision: `b013ad82c6ba375237640b67fbb4a39c5cab6f2e`
- Original path: `fonts/ttf/TDAText.ttf`
- Size: 107,220 bytes
- SHA-256: `0ddc1188e6d8e8d12bcb0aea5de152929bb36b3ea3560e4985b7e9f46a826f54`

The upstream regular `.woff2` has an sfnt/TrueType signature rather than a WOFF2
header. This site uses the original `.ttf` with `format('truetype')`, without
conversion or subsetting. CSS uses it on the public site header text and the
gallery's Back to posts button. Post writing, footer, artwork, and the admin
editor keep their own fonts. The header retains its existing responsive size
classes and layout; the Back button's 20px size follows the author's
15pt-at-96dpi legibility guidance.
