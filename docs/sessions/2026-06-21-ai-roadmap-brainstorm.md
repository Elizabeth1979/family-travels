# Session log — 2026-06-21 — "talk to your app" AI roadmap brainstorm

**Type:** product brainstorm (no code written)
**Outcome:** roadmap + Rung-1 spec saved; build deferred until Supabase migration settles
**Keywords:** AI, chat, concierge, voice, Gemini, Supabase migration, semantic search, album, map

## What we set out to do
Elizabeth asked, as the "product owner," what features would make family-travels more
AI-friendly — she wants to *talk to* the app. Three starting wishes:
- chat with the images
- talk with an album about what they did there
- open albums by asking ("show me the album of when we were in the desert")

## What we figured out (key findings)
- The app has **no traditional backend**: data lives in Google Drive, a Google Apps
  Script acts as the API, frontend is static on Vercel. Gemini is already half-wired in
  the Apps Script for alt-text (currently disabled).
- The album catalog is **tiny** (a few dozen albums), so natural-language matching needs
  **no vector DB / embeddings / RAG** — the whole catalog fits in one LLM prompt.
- Mid-session, Elizabeth noted she's **migrating album/photo data from Drive to Supabase**
  and productizing → design must be backend-agnostic.

## The decision: a 4-rung "talk to your app" ladder
1. **Concierge** — "show me the desert" → map surfaces matching albums. *(chosen to build first)*
2. **Photo enrichment** — enable existing-but-disabled Gemini alt-text (fuel for 3 & 4).
3. **Talk to an album** — chat grounded in that trip's photos/metadata.
4. **Talk to a photo** — vision Q&A on a single image.

Rationale for starting with Rung 1: cheapest, needs no new data, biggest "wow," proves
the concept before investing in enrichment.

## Locked decisions for Rung 1 (the Concierge)
- **Input:** both typing and voice (mic button, graceful degrade).
- **Result:** show 1–3 album cards to pick from; clicking flies the map to that pin.
- **AI engine:** reuse Gemini, key server-side.
- **Backend-agnostic:** endpoint takes `{question, albums}` → `{matches}`; moving from
  Apps Script to a Supabase Edge Function = change one URL in config.js.
- **Guardrail:** do not touch the map's load-time framing/zoom/background (per CLAUDE.md);
  fly-to only on user selection. Plus a client-side substring fallback if the AI fails.

## Artifacts produced
- Spec: `docs/plans/2026-06-21-concierge-ai-map.md` (full Rung-1 design, marked "saved for later").
- Memory: `project-supabase-migration-and-ai-roadmap` (cross-session context).

## Next step
After the Supabase migration settles, say "let's build the Concierge." Open question to
answer then: host the AI endpoint in the old Apps Script vs. a new Supabase Edge Function
(match wherever `fetchAlbums()` points by then).
