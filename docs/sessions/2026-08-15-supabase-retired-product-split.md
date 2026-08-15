# Session: Supabase migration retired; product split into its own repo

**Keywords:** supabase, retired, superseded, productization, split, new repo, album-studio,
alt text, dedupe, face recognition, consent, BYOK, RLS, storage bucket, Netlify removed.

## What we set out to do

Find the productization plan the owner remembered writing ("move this album thing onto
Supabase and make a product of it"), then act on it.

## What we found

The plan was at `docs/plans/2026-06-21-supabase-backend-captions.md`, recorded as **blocked
at Phase 0** waiting for the owner to authenticate a Supabase MCP server in-browser.

**That blocker was both wrong and unfixable.** The Claude Code web environment blocks
`mcp.supabase.com` at the network policy (403 on CONNECT), so the repo's `.mcp.json` server
could never authenticate there no matter how many times `/mcp` → Authenticate was tried.
Meanwhile an account-level Supabase connector was already authorized and worked fine. The
plan had been parked for two months on a door that was never going to open, next to one
that was already unlocked.

The same policy blocks `script.google.com`, so anything reading the Apps Script has to run
from a local machine. The open question "how many albums do we have?" stayed unanswered for
that reason.

## What we built, then deliberately removed

Phase 0 and the Phase 1 schema were completed and merged (PR #45): `albums` + `photos` with
RLS, `updated_at` triggers, indexes, a Supabase client, a re-runnable import script, and
migrations under version control. RLS was verified empirically rather than assumed — in a
rolled-back transaction an `anon` visitor leaked 0 unpublished albums and 0 of their photos.

Then the direction changed (below), and all of it was removed again. Nothing was ever wired
into the read path; production stayed Drive-backed throughout.

**A real mistake worth remembering:** the schema was first applied while the Supabase
project was still `COMING_UP` after a restore. The migration reported success and
`list_tables` showed the tables — then the restore finished, overwrote the database with
its snapshot, and the schema silently vanished. Always check `get_project` status before
migrating, and verify with `list_migrations`, not just `list_tables`.

## The decision

Mid-session the owner reframed the goal. They do not want family-travels migrated — that
site is **done**. They want a new product: AI photo albums with accessible alt text,
duplicate removal, best-shot selection, collages, and face naming, for many users, each
sharing albums with people they choose. Monetized as BYOK or a fixed subscription. No
Google Apps Script anywhere.

**So: new repository, not a fork.** family-travels' map, trip framing, and Drive folder
conventions are baggage for that product. What transplants is the schema shape and the
Gemini vision plumbing — both small and portable.

Two findings shaped the new design:

- **Only one of the five features needs a paid API.** Dedupe is perceptual hashing,
  collages are layout, best-shot is sharpness plus a local face mesh, and face *grouping*
  is a local embedding model. Only alt text needs a vision LLM. That makes a genuinely
  useful free tier possible and reduces cost exposure to one countable operation.
- **Alt text is the differentiator, not dedupe.** Google Photos already does four of the
  five well. Accessible photo sharing is the underserved gap — and it was the feature the
  owner named first.

**Face recognition is being designed with consent as a first-class concept** (explicit
per-person state, faceprints in their own table so withdrawal deletes biometrics without
touching photos). Faceprints are GDPR Art. 9 special-category data and the subject of
nine-figure BIPA settlements; retrofitting this later would be a rewrite.

## Artifacts

- **PR #45** — merged, then reverted by this session's cleanup.
- **PR #46** — bucket migration, closed unmerged once the direction changed.
- **This PR** — removes `supabaseClient.js`, the import script, `supabase/migrations/`, the
  `@supabase/supabase-js` dependency, and `.mcp.json`. Keeps the `scripts/**/*.mjs` ESLint
  override (`backup.mjs` benefits) and a trimmed `.env.example` documenting the Apps Script
  vars, which were previously undocumented.
- **Netlify removed** — it was building deploy previews with no config in-tree; Vercel was
  always the real host, carrying the CSP headers and the `/trip/:id` rewrite.
- **The new product's schema** is applied to Supabase project `vsxbedlsnfmsbnlfayae`
  (migration `album_studio_initial_schema`), which was repurposed from this repo's abandoned
  one. Recoverable from that project's migration history.

## Next step

Owner creates the new GitHub repo — the Claude GitHub App cannot create repositories
(`403 Resource not accessible by integration`). Then start a fresh session rooted in that
repo and build the first vertical slice: upload photos → AI alt text → review and edit.

Nothing further is planned for this repo.
