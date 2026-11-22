# My brain is a goldmine

Mallory's writing and artwork site, built with Astro and Tailwind CSS, with a
separate browser-based BlockNote publishing editor.

[Website](https://my-brain-is-a-goldmine.vercel.app/) ·
[Recorded activation and acceptance status](docs/publishing.md#current-gate)

## What it does

- Presents eleven original entries, artwork pages, paper-textured posts, an image
  viewer, and a floating-media gallery.
- Preserves `/index.html`, `/1.html`, `/12.html`, and `/3.html`.
- Lets authorized editors import original entries, write private drafts, upload
  images, insert Spotify/VideoPress embeds, and publish or unpublish.
- Uses responsive Astro images and decorative CRT/parallax effects, with
  reduced-motion and media-lifecycle safeguards.

## Run locally

Requires **Node 22.23.4+ within Node 22, or Node 24**, and **npm 9.6.5+**.
With [nvm](https://github.com/nvm-sh/nvm) installed:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open <http://localhost:4321>. No environment file or backend is needed to view the
original site; `/admin` shows a setup notice. Publishing requires Supabase Auth,
site membership, and private R2 storage: follow [publishing setup](docs/publishing.md)
using an explicitly approved target, not production credentials by default.

For a local standalone build:

```sh
npm run build
HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs
```

## Development

```sh
npm run check
npm run test:unit
```

Browser/database requirements, test isolation, build restoration, and Vercel
adapter behavior are in the [development guide](docs/development.md).

## Architecture and design

- The feed is server-rendered; publishing needs no rebuild. Artwork and gallery
  pages are prerendered. React/BlockNote loads only in the editor.
- BlockNote JSON, private drafts, and public projections stay separate; server
  checks and site-specific database membership guard editorial actions.
- Originals and archival markup are retained. Astro optimizes public stills;
  private previews bypass optimization, and cached public copies may outlive unpublishing.
- Tailwind v4 omits Preflight, preserving the handmade public presentation and
  BlockNote/Mantine's supplied editor styling. There is no Markdown/MDX publishing flow.

## Documentation

- [Publishing, configuration, and safety](docs/publishing.md)
- [Development, checks, and source map](docs/development.md)
- [Graphics behavior and asset preparation](docs/graphics.md)
- [Image delivery and cache boundaries](docs/image-improvements.md)
- [Design system](DESIGN.md) · [Product constraints](PRODUCT.md)
- [Historical verification and known release exceptions](docs/verification.md)
- [TDAText provenance and license](public/fonts/tdatext/README.md)
