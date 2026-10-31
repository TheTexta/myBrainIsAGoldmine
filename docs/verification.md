# Local verification — 2026-10-30

This records the local implementation checks before production activation.
For the subsequent approved activation's current state, see `publishing.md`.

Baseline: `2773eda0194d60270857693f32b2efb9f69230e0`.
Checks used a temporary Node 22.23.4 runner; the machine's default Node 22.18.0
installation was not changed.

| Check | Observed result |
| --- | --- |
| `npm run check` | Passed; no errors/warnings, one legacy `beforeunload.returnValue` compatibility hint. |
| `npm run test:unit` | 10 passed, including renderer/URL safety, document bounds, original grouping, request boundaries, and response-cap pagination. |
| `npm run test:e2e` | 28 passed across desktop/mobile. Local Supabase/R2 protocol doubles, not production. |
| `npm run test:db` | Passed against disposable PostgreSQL 17: grants/RLS, site membership, direct-RPC validation, save/public separation, stale revisions/actions, media readiness/access revocation, and retained originals. |
| `npm run test:visual` | All four original pages matched at 1440×900 and 390×844 with zero changed pixels; no remote font/image failures. |
| `npm run test:vercel` | Local Vercel build passed; legacy static `.html` aliases equal their directory output bytes and dynamic routes reach the renderer. No deployment. |
| `npm run build` | Node standalone build passed and was restored after fixture builds. |
| `npm audit` | Zero reported vulnerabilities after narrowly scoped transitive dependency overrides and patched test tooling. |
| Admin mechanical design detector | No findings. Desktop/mobile screenshots inspected. |
| Independent review | SHIP local implementation; all material findings resolved and regression-tested. Not production acceptance. |

During the approved activation, the same database bootstrap/migration/tests also
passed on isolated PostgreSQL 15.19. Production is 15.8, not the exact patch tested.
Astro checks, all ten unit tests, and the local Vercel output check passed again
using the temporary Node 22.23.4 runner. The machine's older default Node was
rejected by Astro; its installation was not changed.

The pixel comparison freezes animated GIFs at their first frame and blanks
third-party player interiors. Separate browser tests exercise cat toggling,
mirror animation, hover swaps, navigation, entry import, private save, preview,
publishing, conflict recovery, upload byte sealing, and unpublishing. All original
local assets, including the retained unpublished PSDs, match baseline SHA-256.

BlockNote's editor-only bundle still triggers a build chunk-size warning; it is
lazy-loaded after entry selection and is not requested by public pages. The
mobile editor's writing starts near the fold beneath the entry inventory; an
explicit inventory-collapse control is a nonblocking future improvement.

## Not established by these checks

No real Supabase schema/grants, live R2 signatures/conditional writes/CORS,
deployment routing, real embed playback, or live session-expiry flow has been
accepted. At completion of these local checks, no production changes, user grants,
object retirement, push, or deployment had occurred. Follow the acceptance checklist in
`publishing.md` before activation.
