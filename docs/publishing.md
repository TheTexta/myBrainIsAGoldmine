# Publishing architecture and activation

## Current gate

The owner approved this site's production activation on 2026-10-30 and selected
a new Vercel project with one existing owner account as the initial editor.

- Created Vercel project `my-brain-is-a-goldmine` under `thetextas-projects`.
  Its canonical domain is `my-brain-is-a-goldmine.vercel.app`. **The canonical
  production domain is public**, explicitly approved by the owner on 2026-11-09.
  Vercel Authentication remains enabled with
  `prod_deployment_urls_and_all_previews`: previews and deployment-specific URLs
  remain protected. The persisted setting and anonymous HTTP behavior were
  verified. Node 24 is selected. Application sign-in and site membership remain
  required for editorial access.
- Verified the shared Supabase API target, absence of conflicting `mybrain_*`
  objects/private schema, and a unique confirmed intended owner account.
- Verified the backend host over Tailscale/SSH and production PostgreSQL 15.8.
  A fresh full-database custom archive and globals backup was saved on the host at
  2026-10-31 00:17:43 UTC, in a private directory with mode-600 files. The archive
  listing and full archive-to-SQL read passed; this was not a restore rehearsal.
  Database archive SHA-256:
  `c1f4a809e0c5fcae8f06795c312c6edf7ab915dd4e6c38424e3415fa6c3009b8`.
  The isolated authorization suite also passed on PostgreSQL 15.19; production
  default ACLs and role capabilities were inspected separately.
- Created private R2 bucket `mybrainisagoldmine` in ENAM on 2026-10-31 UTC
  (2026-10-30 local). Verified managed r2.dev access is disabled and there are no
  custom domains. CORS permits only the canonical origin and exact acceptance
  preview origin, with PUT/GET/HEAD and Content-Type. No wildcard preview origins
  or shared Worker changes are used.
- The owner created the R2 credential manually and entered its S3 pair directly
  into Vercel as Sensitive variables. Both Preview and Production scopes are
  verified without decrypting the values; real S3 acceptance is still pending.
  The other six required variables are also configured for both environments.
  Only the two specific Supabase keys were transferred from their owning service;
  privileged values were neither displayed nor written to the checkout.
- Ordinary Cloudflare R2 management works. Account-token discovery still requests
  additional authorization, and user-token permission discovery explicitly rejects
  OAuth. Manual credential provisioning avoids broadening the connection grant.

- Applied the reviewed `mybrain_publishing` migration from revision `37246ee`
  through the migration tool, with bounded lock/statement timeouts. Granted only
  the unique existing account selected by the owner. Verified 11 drafts, 11 legacy
  public projections, one editor, and no media rows. Original entries are unchanged.
- Verified actual production ownership, RLS and effective privileges, including
  Supabase's broader default ACLs. Read-only assertions established anonymous
  draft denial, nonmember private-content/publishing denial, and intended editor
  reads. These database-role checks do not replace a real Auth/browser session.
- Initially committed/pushed the conversion on `astro-blocknote-activation` while
  `main` was still at the original revision. Vercel classified its first Git-triggered deployment
  as Production, unexpectedly. Protection was tightened to **all** URLs and
  independently verified to show Vercel Login before continuing. A separate
  explicit preview (`target: null`) then built successfully from `37246ee`.
- The protected preview passed live original-page content/URL hashes, all 26
  published asset checksums, PSD denial, admin security headers, anonymous API
  denial, and missing/unpublished media denial. It loads no editor bundles on the
  public homepage. Its original seven panels and eleven entries remain intact.
- Initial Vercel builds selected Node 26 from the unbounded package engine despite
  a Node 24 function runtime. The engine range is now bounded to supported Node
  22/24. The next preview from `82029af` explicitly reported the build-version
  change from 26 to 24 and completed successfully, without that adapter warning.

Initial protected acceptance target: revision `82029af1e2e194479197ca157212f66fecf7847c`,
deployment `dpl_5wVeZU8RGYajkdVbtMYwMfauepCZ`, at
`https://my-brain-is-a-goldmine-md8t3blpv-thetextas-projects.vercel.app/admin`.
Only that exact preview and the canonical origin are currently in R2 CORS; the
earlier acceptance preview origin was removed. A one-hour Vercel share capability
was used privately to open the editor in the local acceptance browser; no bypass
token is stored in this repository. For current production acceptance, the owner
must sign in at `https://my-brain-is-a-goldmine.vercel.app/admin` with their normal
Supabase account. Do not substitute
an administrative impersonation or service-role session for that check.

On 2026-11-09, the owner requested merging and pushing `astro-blocknote-activation`
to `main`; it fast-forwarded to `406589c`. The latest observed production deployment
is `dpl_3AyPtVopS6K6RJA9s6RL4MuXNxpF` (`READY`), at
`https://my-brain-is-a-goldmine-jkjoloxn6-thetextas-projects.vercel.app`.
The owner then explicitly approved making production public while retaining
preview/deployment protection. Anonymous checks without cookies or bypass headers
returned actual site content with HTTP 200 on the canonical homepage, HTTP 401
(`Sign in to continue.`) on `/api/admin/posts`, and Vercel login redirects on both
the production deployment-specific URL and the initial acceptance preview URL.
This protection-setting change required no new deployment or promotion.

**Remaining gate:** real sign-in, S3 upload/sealed-byte verification, draft preview,
publish/edit/unpublish and session/concurrency acceptance, plus real embed playback.
Opening production does not establish that these authenticated checks passed.
No shared Worker changes or original retirement occurred; Supabase sign-in,
site-local editorial authorization, RLS, and private storage remain unchanged.

## Configuration

Copy `.env.example` to `.env` locally. Use the same names in the deployment's
environment settings. Never commit values.

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Exact public origin, e.g. `https://your-site.example`, at build time. Required for custom-domain Host/Origin validation. |
| `PUBLIC_SUPABASE_URL` | Shared Supabase API origin. Browser-visible. |
| `PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key, never a service-role key. Browser-visible. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only upload completion attestation; never sent to the editor. |
| `R2_ENDPOINT` | Site credential's R2 S3 endpoint. Server-only. |
| `R2_BUCKET` | Dedicated private site bucket. Server-only. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Site-scoped read/write credential for that bucket only. Server-only. |

Vercel's exact `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` are also trusted
at build time. Localhost/127.0.0.1 HTTP origins are allowed for development. Do not
replace this with trust for every `*.vercel.app` host or disable origin checks.
Build after changing public variables or trusted origins.

The shared Supabase service-role key is privileged across the instance. It is
used only after server-side identity and site-membership verification to mark
byte-verified media ready. All ordinary draft/publication operations use the
editor's bearer token and database authorization. Keep production credentials in
the host's encrypted environment settings and rotate if exposed.

## Database boundary

`supabase/migrations/202610300001_mybrain_publishing.sql` creates only:

- `mybrain_editors`: site membership, initially empty; accounts cannot grant
  themselves access. An editor of another site has no implicit access here.
- `mybrain_drafts`: private working BlockNote JSON, title, stable legacy identity,
  panel/order metadata, and an optimistic-concurrency revision.
- `mybrain_publications`: public projection only. Saving does not modify it;
  publish atomically copies a saved draft. Hidden rows contain no document/title.
- `mybrain_media`: private upload reservations, immutable key, byte count,
  type, SHA-256, and readiness.
- `mybrain_publication_media`: transactional published-reference tracking.

RLS and explicit grants deny anonymous draft/media/membership access and ordinary
authenticated direct writes. Site-checked RPCs save and publish; publish checks
the expected revision and media readiness. The public media RPC returns a key
only while a currently published entry references that ready object.
Save, publish, and unpublish each advance the revision, so a stale tab cannot
restore a version or media access after another tab unpublishes it. Database-side
document validation also protects direct RPC calls, not just the application API.

This is a **site-local** membership boundary, not a rollout of shared cross-project
authorization. Do not redefine Elliot's `is_admin()` or grant access from another
site's metadata/allowlist. A later approved shared-membership migration can replace
this lookup without changing the document/publication separation.

The migration seeds the eleven original entry IDs, not users or editorial grants.
Apply it once through the approved migration process after target verification,
backup, and schema review. It deliberately fails rather than silently overwriting
existing names. After separate approval, a database administrator grants a known
existing Supabase user membership in `mybrain_editors`. Never put user IDs or
credentials into seed files or browser configuration.

Once configured, a failed/incomplete publication read returns HTTP 503 rather
than restoring original text that might have been unpublished. Removing all CMS
configuration restores the archived original site; **that is not a safe rollback
after editorial removals**. Roll back code with compatible database/R2 state, and
retain private/public snapshots before a production switch.

## Sessions and document safety

- Email/password uses existing Supabase Auth, with no public registration UI.
- Supabase's browser session transport supplies a bearer token to each editor
  endpoint. The server verifies it with Auth and checks site membership on every
  request. Token refresh does not reload an open draft.
- Writes require JSON and an exact same-origin `Origin` header. APIs do not emit
  permissive CORS headers. Editor pages/APIs are non-cacheable and not frameable.
- Failed saves leave the editor open; stale revisions return HTTP 409 rather than
  overwriting another session's changes. Save is manual; leaving with unsaved
  changes warns before navigation. Keep the tab open after an error.
- The owner selected direct publishing on 2026-11-09. Publish/Update saves the
  current draft if needed and publishes its returned revision; Preview is an
  optional read-only view, not a publishing prerequisite. A failed save stops
  publication. A publication response failure keeps the saved draft and reports
  an uncertain publishing outcome rather than retrying or claiming it is live.
- Existing `updated_at` / `published_at` fields distinguish a draft saved since
  publication after reload. This is timestamp-based status, not a claim that
  content differs byte-for-byte. No schema/RPC or authorization change is required.
- BlockNote JSON is the source of truth. Size/depth/type bounds and an escaped,
  allowlisted semantic renderer prevent arbitrary editor HTML from executing.
  Spotify/VideoPress are the only supported iframe providers. No client-provided
  HTML is stored or trusted for rendering.
- Original HTML is trusted repository-owned archival content. It is not replaced
  by the lossy editor import until an editor deliberately publishes the saved
  replacement. Publish/Update saves latest edits first; Preview remains optional.
- Preview HTML runs in a sandboxed iframe without same-origin privileges. Draft
  image reads use short-lived signed capabilities; do not share preview URLs.
  It is a content preview using the public renderer and Tinos font, not a full
  homepage/shell or multi-entry grouping simulation.

## Private R2 uploads

Use a **new dedicated private bucket**, with r2.dev and public custom domains
disabled. Do not reuse another site's bucket or bind this bucket to the shared
Worker. This initial design serves published originals through `/media/<uuid>`;
it does not change the shared infrastructure repository or production routing.

Configure CORS only for the exact approved site origin and explicitly required
local/preview origins. Allow `PUT`, `GET`, `HEAD` and `Content-Type`; do not use a
wildcard origin. Browser PUTs use a ten-minute signed URL and do not forward the
Supabase token to R2.

1. Authenticate and reserve an ID in the database.
2. Upload the original to private `incoming/<uuid>`.
3. Completion checks the declared size (maximum 20 MB), JPEG/PNG/GIF/WebP signature,
   image metadata and maximum 100 million total pixels, including GIF frames.
   SVG and non-image uploads are rejected.
4. Seal those bytes at `originals/<uuid>.<extension>` with a create-only write.
   Read back and verify SHA-256 before marking the reservation ready.
5. An old signed PUT can only change the incoming object, never the sealed original.
6. Publication atomically registers references. Anonymous `/media/<uuid>` reads
   check current published references before streaming from private R2; these
    original responses are not cached. The owner separately approved native Astro
    optimization for published images on 2026-11-09: optimized copies use normal
    public caching and may remain accessible after unpublishing. Unpublishing
    denies new original-route reads, not cached optimized copies, downloads already
    held elsewhere, or a previously issued five-minute editor read URL. Private
    draft previews never enter the optimizer. See `image-improvements.md`.

Incoming, sealed, orphaned, and unpublished objects are **not automatically deleted**.
Reservations preserve IDs, sizes, keys, and checksums for recovery. If completion
fails, retain the open draft and reservation; retry the completion endpoint with
the same ID, or retry the upload. A browser reload does not automatically resume
an in-flight upload. Cleanup, retention policies, and migration to a separate
published delivery bucket/Worker require a separately reviewed operation.

## Production activation checklist

1. Confirm the repository/hosting project and exact canonical/preview origins.
2. Review the SQL and isolated role tests; verify no conflicting `mybrain_*`
   objects and back up the intended database.
3. Obtain approval to apply the migration and separately grant the intended
   account membership. Verify nonmembers/other-site admins remain denied.
4. Obtain approval to provision the private bucket, scoped credential, and narrow
   CORS. Verify public access is disabled. No shared Worker change is required.
5. Configure public and server-only environment values, then build a preview.
6. Verify original-route fidelity; use a real authorized account to save a draft,
   confirm anonymous draft/media denial, upload a real image, publish, read back
   identical bytes, edit without publishing, unpublish, and verify original-route
   access is revoked. Previously optimized copies may remain natively cached.
7. Verify real embed playback, logout/expired-session behavior, and concurrent
   edit conflicts. Browser fixtures do not replace these acceptance checks.
8. Only after approval promote/deploy. Keep database/R2 backups and the compatible
   rollback build; do not remove the old content, originals, or grants implicitly.
