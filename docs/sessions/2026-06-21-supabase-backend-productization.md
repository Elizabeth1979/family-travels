# Session log — 2026-06-21 — Supabase backend + easy captions productization plan

**Type:** architecture planning (one config file written: `.mcp.json`; no app code yet)
**Outcome:** staged plan approved + saved; Supabase MCP wired up; blocked on owner auth
**Keywords:** Supabase, Apps Script, Drive, captions, alt text, MCP, productize, bulk upload, RLS, Gemini

## What we set out to do
Elizabeth, as product owner, wants to **productize** family-travels so other people can
use it "quickly and easily." The immediate question: how to **add text (captions) to all
uploaded images easily** — via the Google Apps Script, or from the app itself? Mid-session
this widened into the real question: **is the Apps Script the right foundation at all?**

## What we figured out (key findings)
- The captioning data plumbing **already exists**: each image has a `description` (stored
  in its Drive file description) used as both alt text and the PhotoSwipe caption. The gap
  is an **easy editing workflow**, not the data path.
- The pain isn't "talking to Google" — it's that **metadata is crammed into Drive
  description fields** and Elizabeth **hand-babysits the Apps Script**. Two storage needs
  were conflated: heavy **photo bytes** vs. tiny **metadata** (what she actually edits).
- **MCP is not a product backend** — it lets an AI assistant act on her behalf in-session,
  not something end-users touch. So MCP can't *be* the productized backend.
- Apps Script is a fine *personal* backend but a poor *SaaS* backend (single tenant, single
  token, runs on her account's quotas).
- For a real product, **end-users can't be required to own a Google Drive** — they should
  "just upload photos."

## The decision: hybrid Supabase backend, built as a product now, Elizabeth as user #1
- **Supabase** = backbone: Auth (multi-user ready) + Postgres (real metadata DB) + Storage
  (new uploads). Chosen over Firebase because the data is relational (albums → photos →
  captions, locations) and Postgres models it plainly.
- **Split the two storages:** DB holds tiny text rows; bucket holds bytes. A `photos` row
  stores a **URL** that can point at Google's CDN (legacy photos, left in place, free) *or*
  Supabase Storage (new uploads) → **existing photos are never migrated**, only metadata.
- **Separate `caption` (visible) vs `alt` (accessibility)** fields end-to-end.
- Captions **AI-drafted (Gemini), owner-edited** in-app.
- New uploads → Supabase Storage via **client-direct, resize-first, throttled** bulk upload
  (500 photos resized ≈ 250 MB, fits free tier; DB can't be overwhelmed by photo count).
- A **background worker (Supabase Edge Functions)** is the *product-scale* upgrade, deferred
  to Phase 6 — not built at personal scale.

## Why the human is still needed (can't be done via MCP)
Creating the Supabase account, the **OAuth browser approval**, and the **session reload**
are human-only by design — an agent that could self-authorize into cloud accounts would be
the security hole. Everything *after* the handshake (schema, RLS, import, storage, queries)
Claude runs through the Supabase MCP.

## Tooling state
- `.mcp.json` added at repo root → `https://mcp.supabase.com/mcp` (no secrets; OAuth-based).
- Supabase CLI not installed (npx fallback exists); chose the **MCP server** path.

## Artifacts produced
- Plan: `docs/plans/2026-06-21-supabase-backend-captions.md` (staged Phases 0–6, with a live
  "▶ Resume point" section).
- Config: `.mcp.json` (Supabase MCP server).
- Memory: updated `project-supabase-migration-and-ai-roadmap` (merged specifics + Phase-0
  blocker; corrected "photos move" → metadata-only, photos stay on Drive by URL).

## Next step
Elizabeth (has a Supabase account): **reload session → `/mcp` → authenticate `supabase`**,
then say she's connected (and which project, roughly how many albums). Then Claude verifies
the link via MCP and starts **Phase 1**: create `albums` + `photos` schema with RLS, run a
test query, write the one-time Drive-metadata import.
