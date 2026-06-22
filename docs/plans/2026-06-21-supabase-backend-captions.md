# Plan: Move family-travels onto a productizable Supabase backend (with easy AI captions)

## ▶ Resume point (last updated 2026-06-21)

**Where we are:** Phase 0 (connect Supabase) — half done.

- ✅ `.mcp.json` added at repo root pointing at the Supabase MCP server
  (`https://mcp.supabase.com/mcp`). Holds no secrets; auth is via browser OAuth.
- ⏳ **Owner has a Supabase account already.** Still needs to:
  1. Reload the Claude Code session (so the new `.mcp.json` is picked up).
  2. Run `/mcp`, select the `supabase` server, choose **Authenticate**, approve in browser.
  3. Confirm the `mcp__supabase__*` tools appear.
- ⛔ Hard blocks that require the human (cannot be done via MCP): creating the account,
  the OAuth browser approval, and reloading the session. Everything after that is MCP-driven.

**Next action when resuming:** Claude verifies the link (list projects via MCP), then
starts **Phase 1** — create `albums` + `photos` schema with RLS and run a test query.

**Open questions to answer on resume:**
- Which Supabase project/org should we use? (owner may have more than one)
- Roughly how many albums exist today?
- Is the existing Apps Script URL in `config.js` still live, so the one-time import can
  read current metadata from it? (Claude can detect from [config.js](../../config.js).)

---

## Context

The app today is a static frontend (Vercel) whose only backend is a single Google
Apps Script Web App ([google-apps-script.js](../../google-apps-script.js))
that reads/writes Google Drive. Drive is doing double duty as both **photo storage**
and **database** — album/photo metadata is crammed into Drive folder/file
"description" fields as pipe-delimited strings (`lat,lng | date | description | cover | type`).

Two problems prompted this plan:

1. **It's painful to run.** Editing captions/locations means hand-editing the Apps
   Script or Drive descriptions. There's no real in-app editor, and changing backend
   behavior means manually re-deploying the script.
2. **It can't be productized as-is.** A real product can't make end-users own a Google
   Drive or share Elizabeth's single hardcoded folder + admin token. End-users should
   "just upload photos."

**Decisions reached with the owner:**
- Build the **product architecture now**, with Elizabeth as user #1 (fastest path to a
  real product — building on Drive first would be throwaway work).
- **Supabase** is the backbone: **Auth** (multi-user ready), **Postgres** (real metadata
  DB), **Storage** (new photo uploads). Chosen over Firebase because the data is
  relational (albums → photos → captions, locations) and Postgres models that plainly.
- **Separate `caption` and `alt` fields** (visible caption vs. accessibility alt text).
- Captions are **AI-drafted (Gemini), owner-edited** in the app.
- **New uploads land in Supabase Storage**; the Apps Script is retired.
- **Existing family photos are NOT migrated.** A photo row stores a *URL*; that URL can
  point at Google's CDN (legacy photos, left in place, free) or Supabase Storage (new
  uploads). The app is indifferent to which — so only the tiny metadata moves.

**Intended outcome:** Elizabeth edits albums/captions in-app (never the script or Drive),
new photos upload directly in the app, AI pre-fills captions, and the same system is
ready to onboard other users later — without a photo-migration project.

## Architecture (target)

```
Browser (frontend, Vercel)
  ├── reads albums/photos  ─────────►  Supabase Postgres (metadata)
  ├── <img src> points at  ─────────►  URL: Google CDN (legacy) OR Supabase Storage (new)
  ├── edits caption/alt    ─────────►  Supabase Postgres (RLS-protected, requires login)
  ├── uploads new photo    ─────────►  Supabase Storage  ──► returns URL ──► new photo row
  └── AI draft caption     ─────────►  Gemini (server-side function), writes draft into row
```

The Google Apps Script is removed from the runtime. A one-time export script copies
existing Drive metadata into Postgres; after that, Drive only serves legacy image bytes.

### Data model (Supabase Postgres)
- `albums`: `id`, `owner_id`, `title`, `slug`, `date`, `description`, `lat`, `lng`,
  `type` (travel|event), `cover_photo_id`, `created_at`.
- `photos`: `id`, `album_id`, `owner_id`, `url` (Google CDN *or* Supabase Storage),
  `thumb_url`, `mime`, `caption`, `alt`, `sort_order`, `width`, `height`, `created_at`.
- Row-Level Security: a row is readable by anyone if its album is published, writable
  only by `owner_id` — this is what makes it multi-user-ready from day one.

### Cost / "don't overwhelm Supabase" guardrails (concrete)
- The **database** only ever stores text rows (URL + caption); 500 photos = 500 tiny
  rows. It cannot be overwhelmed by photo volume — Postgres treats 500 and 50,000 rows
  the same.
- The **Storage bucket** is the only thing with size, and its size is decided by one
  choice — store resized, not originals:
  - ~4 MB original → ~0.4 MB at 2000px + ~0.03 MB thumb.
  - **500 photos: ~2 GB as originals (over free tier) vs. ~250 MB resized (fits free
    tier).** Always store resized.
- **Existing Drive photos cost 0 bytes in Supabase** — they stay on Drive, referenced by
  URL. Bucket growth only comes from *new* uploads.
- Add a **per-user storage quota** for the product. If the bucket gets large, it can move
  to Cloudflare R2 (no egress fees) while Postgres stays put.

### Bulk upload mechanics (how 500 photos actually upload)
- **Client-direct, resize-first, throttled.** Browser resizes each file (canvas →
  ~2000px + thumb) *before* upload, then uploads **straight to Supabase Storage ~4 at a
  time** with a **progress bar and auto-retry**. Bytes never pass through an app server,
  so nothing gets overwhelmed; a dropped connection just retries the affected files.
- Each successful upload inserts one `photos` row; AI caption drafts run afterward.
- **No background worker needed at personal scale.** A server-side job/queue (Supabase
  **Edge Functions**) is the *product-scale* upgrade for server-side thumbnailing, AI
  captioning, and EXIF/location extraction — deferred to Phase 6, not built now.

## Approach — staged, thin vertical slice first

Use the **superpowers:supabase** skill during implementation for project setup, schema,
RLS, and the storage bucket. Each phase is independently shippable.

> **Tooling decision:** Connect via the **Supabase MCP server** (`mcp.supabase.com`).
> The CLI is not installed (npx fallback exists). After Phase 0, all schema/RLS/storage
> work runs through MCP tools (`execute_sql`, `get_advisors`, etc.) directly from chat.
>
> **MCP scoping (security):** the committed `.mcp.json` URL is scoped
> `?read_only=true&features=database,docs` — least-privilege by default, which limits the
> prompt-injection blast radius and still allows `list_projects` + `SELECT`. Two follow-ups:
> (1) **pin `&project_ref=<ref>`** once the owner names the project; (2) for the brief
> Phase-1 schema-create + import window only, temporarily drop `read_only=true` (or add a
> separate opt-in write entry), then restore read-only. Keep `.mcp.json` on the release
> checklist so future entries inherit the same discipline.

**Phase 0 — Connect Supabase (one-time, needs Elizabeth)** — see Resume point above.
- *I do:* add `.mcp.json` at the repo root (read-only, db+docs scoped) → ✅ done.
- *Owner does:* (has account) reload session → `/mcp` → authenticate `supabase` in browser;
  tell Claude **which project** so its `project_ref` can be pinned in the URL.
- *Verify:* the Supabase MCP tools are listed and `list_projects` responds (works read-only).

**Phase 1 — Supabase foundation + read path (get the app running off Postgres)**
- Create the `albums` + `photos` tables and RLS via MCP `execute_sql`.
- Add a Supabase JS client + config (replaces the Apps Script URL in
  [config.js](../../config.js)).
- One-time **import script**: call the existing Apps Script `list` + per-folder endpoints,
  parse the pipe-delimited metadata (logic already in
  [google-apps-script.js](../../google-apps-script.js) `parseAlbumFolder` and the `doGet`
  item builder), and insert rows. Each photo's `url` = the existing
  `https://lh3.googleusercontent.com/d/{id}=s2000` Google CDN URL — **no file moves.**
- Repoint **reads**: change [utils.js](../../utils.js) `fetchAlbums()` and
  [album.js](../../album.js) `loadPhotos()` to query Supabase instead of the Apps Script.
  Map columns onto the existing album/item shape so the gallery, map, and PhotoSwipe
  caption code keep working unchanged.

**Phase 2 — Separate caption + alt through the pipeline**
- Render `caption` (visible) distinct from `alt` (accessibility). Update the PhotoSwipe
  `data-caption` wiring (currently single `description` around
  [album.js:379-381](../../album.js#L379-L381) and
  [album.js:691-749](../../album.js#L691-L749)) to use `caption`, and set `<img alt>` from `alt`.

**Phase 3 — In-app caption/alt editor (write path)**
- In [admin.js](../../admin.js) / admin.html, add a per-photo editor: click a photo →
  edit `caption` and `alt` → save writes directly to Supabase (login-gated by Supabase
  Auth + RLS). Replaces touching Drive/the script entirely.
- Add Supabase Auth login to the admin panel (Elizabeth = user #1).

**Phase 4 — AI-draft captions**
- A small server-side function (Vercel serverless, reusing the existing Gemini logic from
  [google-apps-script.js](../../google-apps-script.js) `generateAIDescription`) fills
  `caption`/`alt` drafts for photos that lack them; the owner edits in the Phase 3 UI.
  Keep it as a "Generate drafts" button so AI cost is controlled.

**Phase 5 — Uploads to Supabase Storage (retire the Apps Script)**
- Add in-app **bulk upload** using the client-direct, resize-first, throttled pattern
  above: select many photos → browser resizes each → uploads ~4 at a time with a progress
  bar + auto-retry → inserts a `photos` row per file. Handles a 500-photo album cleanly.
- Once reads, writes, and uploads all run through Supabase, **delete the Apps Script** and
  remove its URL from config.

**Phase 6 (later, when onboarding others) — productization**
- Per-user signup, storage quotas, optional billing. The hard parts (auth, RLS, schema,
  storage) are already done in Phases 1–5.
- Move heavy processing to a **background service (Supabase Edge Functions)**: server-side
  thumbnailing, AI captioning, and EXIF/location extraction — the "background server
  service" instinct, added only at product scale.

## Files / surfaces touched
- New: Supabase project, SQL schema + RLS, `supabaseClient.js`, one-time `import` script,
  a Vercel function for AI drafts, `.mcp.json` (✅ added).
- Modify: [config.js](../../config.js), [utils.js](../../utils.js), [album.js](../../album.js),
  [map.js](../../map.js), [admin.js](../../admin.js) + admin.html, styles (caption vs. alt).
- Retire (Phase 5): [google-apps-script.js](../../google-apps-script.js).
- **Do not change** the 2D map framing/zoom/background behavior (per project CLAUDE.md).

## Verification
- **Phase 1:** After import, run the site pointed at Supabase; confirm the album list, the
  map pins, and an album's photo grid all render from Postgres with images still loading
  from Google's CDN. Compare album/photo counts against the live Apps Script.
- **Phase 2:** Open a photo in the lightbox; confirm the visible caption comes from
  `caption` while the `<img alt>` uses `alt`.
- **Phase 3:** Log in to admin, edit a caption, reload the public site, confirm it changed
  — without touching Drive or the script.
- **Phase 4:** Click "Generate drafts" on an album with empty captions; confirm drafts
  appear and are editable.
- **Phase 5:** Upload a new photo in-app; confirm it lands in Supabase Storage, gets a
  thumbnail, appears in the album, and that the Apps Script is no longer called (network
  tab shows no `script.google.com` requests).
