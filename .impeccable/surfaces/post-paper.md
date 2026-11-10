# Recycled-paper post bodies

Mode: Read. The owner pinned the material: use the supplied texture, not a generated
paper effect or a new aesthetic lane. Preserve Tinos, content, paragraphs, and layout.

SOURCE: `src/assets/textures/white-recycle-paper-texture.jpg`, moved from the root
with explicit owner permission; unchanged 3000×3000 source. SHA-256:
`d36ca3250c1417a7449c6cbe6a1af4cf58218e6826513a9719d06d1a548b216b`.
Native Astro `getImage()` supplies a 1320px WebP, used at a 660px texture period.
No custom optimizer, proxy, image-cache service, media migration, or source rewrite.

FORM: Borderless paper panels, near-black (`#181818`) multiply-blended ink, isolated per post.
Apply blend mode only to text-only blocks; do not multiply photos/embeds. Prose
links/image focus borders stay visible in black. Invert paper selection to white
on black. White fallback preserves reading if the texture fails. Preserve only the
owner-confirmed later `p-0` edit (with the mobile `px-1` override), zero outer
margins, parent centering, and unchanged paragraph/heading margins. This later
approval supersedes the earlier `py-8` / desktop `px-2` request.

Each entry has its own paper container; the original seven-panel grouping is not
the visual grouping anymore. Paper URL/background is scoped to the individual
container, not the body. The latest local transparent-feed spacing is `gap-32`
between posts and `pt-16` before the first: 128px and 64px of visible sparkles.

SCOPE: Public post bodies and their read-only preview use the same asset URL.
Do not re-theme BlockNote/vendor styles, header, artwork panels, or fullscreen viewer.
The viewport CRT remains above the paper; floating photos remain behind its rectangle.

VERIFY: Source checksum, real native texture load, black ink/multiply, normal media
blending, readable selection/focus, preview parity, desktop/mobile and fallback states.
