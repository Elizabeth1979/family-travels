# Plan: The Concierge — "talk to your map" (Rung 1 of the AI ladder)

> Status: **saved for later** — brainstormed 2026-06-21, to be built after the
> Drive → Supabase data migration settles.

## Context

The owner wants to *talk to* the family-travels app. Across a brainstorming session
we mapped three wishes ("talk with images", "talk with albums", "open the album of
when we were in the desert") onto a four-rung capability ladder and chose to build
**Rung 1 — the Concierge** first: ask a question in plain language and have the map
surface the matching album(s). It is the cheapest build, needs no new data, and
delivers the headline magic moment ("show me the desert album"). Rungs 2–4 (photo
enrichment → talk-to-an-album → talk-to-a-photo) build on top later.

### The four-rung ladder (for context on what comes next)
1. **Concierge** — natural-language "show me X" → map surfaces matching albums. *(this plan)*
2. **Photo enrichment** — turn the already-built-but-disabled Gemini alt-text on so
   every photo gets a one-line description (the fuel for rungs 3–4).
3. **Talk to an album** — chat inside an open album about that trip.
4. **Talk to a photo** — vision Q&A on a single image.

**Decisions locked in this session:**
- **Input:** both typing *and* voice (mic button; voice degrades gracefully where unsupported).
- **Result:** show a short list of 1–3 album cards to pick from (handles vague questions like "beach trips"), then act on the chosen one.
- **AI engine:** reuse Google Gemini (already half-wired in the Apps Script), key stays server-side.
- **Migration-aware:** the owner is moving album/photo data from Google Drive to **Supabase** and productizing. The Concierge must be backend-agnostic so the migration doesn't break or re-do it.

## Core design principle — backend-agnostic Concierge

The page already loads the full album catalog via `fetchAlbums()` (utils.js),
and the catalog is tiny (a few dozen albums). So:

- The Concierge sends `{ question, albums }` (the in-memory list) to **one small AI
  endpoint** and gets back `{ matches: [{ id, reason }] }`.
- The endpoint is **stateless and portable**: it never reads Drive or Supabase itself
  — it just reasons over the catalog the client passed in. Moving from Drive→Supabase
  means re-pointing one URL in config.js; no frontend change.
- The whole catalog fits in a single Gemini prompt, so **no vector DB / embeddings / RAG.**

## Components

### 1. AI endpoint — `ask` action (server-side, holds the Gemini key)
Implement once, host wherever the project's backend currently is:
- **Now (Drive era):** add an `action === 'ask'` branch to `doGet`/`doPost` in
  google-apps-script.js, reusing the existing Gemini HTTP pattern in
  `generateAIDescription()` (same `GEMINI_API_KEY`, same `UrlFetchApp.fetch` +
  `gemini-1.5-flash` shape).
- **Later (Supabase era):** the same contract becomes a Supabase Edge Function;
  store the key as a Supabase secret. Frontend is unchanged.

Contract (identical in both homes):
- **In:** `{ question: string, albums: [{id,title,date,description,type}] }`
  (send only these fields — drop coords/cover to save tokens.)
- **Prompt:** give Gemini the catalog as JSON + the question; instruct it to return
  **strict JSON** `{ "matches": [{ "id": "<album id>", "reason": "<one short line>" }] }`,
  max 3, ranked best-first, `matches: []` when nothing fits. Validate every returned
  `id` exists in the catalog before trusting it.
- **Out:** `{ matches: [...] }` or `{ matches: [], error }`.

### 2. Concierge UI — the "Ask" bar (map page)
- Add a compact floating bar to index.html: a text input + a mic button + submit,
  styled in styles.css to match the existing map header/controls (legible over the
  map, same theme treatment).
- New isolated module `askConcierge.js` (keep it out of the already-large map.js);
  map.js imports/initializes it after markers render and passes it the album list +
  a callback to focus a pin.
- **Voice:** use the browser `SpeechRecognition` / `webkitSpeechRecognition` API to
  fill the text box from speech. If the API is absent, hide the mic button and keep
  the text box (graceful degrade).

### 3. Results panel + map reaction
- On submit: show a small loading state, call the `ask` endpoint, render the returned
  1–3 albums as cards. **Reuse the existing album-card / popup rendering in map.js**
  rather than inventing a new card.
- Clicking a result card flies the map to that album's pin and opens its preview card
  — **reuse the existing marker-focus + popup logic** (the same `fitBounds`/popup path
  used elsewhere).
- **CLAUDE.md guardrail:** this is a *user-triggered* fly-to on selection. Do **NOT**
  touch the map's load-time framing, zoom behavior, or off-map background
  (`computeFocusBounds` + `fitBounds` in `renderLeafletMarkers`). Those stay exactly as-is.

### 4. Graceful fallback (no AI / AI fails)
If the `ask` endpoint errors, the key isn't set, or it returns nothing: fall back to a
**client-side substring match** over the cached album titles/descriptions so the bar
still returns something useful. Never leave the user with a dead box.

## Reused existing code (do not rebuild)
- `fetchAlbums()` + localStorage cache — utils.js (catalog source of truth).
- Gemini call pattern + `GEMINI_API_KEY` — `generateAIDescription()` in google-apps-script.js.
- `doGet` action routing — google-apps-script.js.
- Marker rendering, album cards, popups, pin focus — map.js.
- App/backend URLs — config.js (the one place the endpoint URL is set).

## Setup the owner must do (call out clearly at build time)
- Get a **free Gemini API key** (https://makersuite.google.com/app/apikey) and store it
  server-side (Apps Script Script Property today; Supabase secret later) — never in
  source or client code.

## Open question to confirm before/at implementation
- **Where to host the `ask` endpoint for the first build:** the current Apps Script
  (works today, throwaway-ish once Supabase lands) vs. building it directly as a
  Supabase Edge Function (skips rework if the migration is far enough along). Recommend
  matching wherever `fetchAlbums()` will be pointing when we build.

## Verification (end-to-end)
1. With a valid Gemini key set, run the site (`npm run dev` / Vite) and open the map.
2. Type "show me the desert" → expect 1–3 relevant album cards within a couple seconds.
3. Click a card → map flies to that pin and opens its preview; **confirm the initial
   load framing/zoom/background is unchanged** from before.
4. Speak the same query via the mic button → text box fills, same result.
5. Try a vague query ("beach trips") → expect a short multi-card list.
6. Force-fail the endpoint (bad URL / unset key) → confirm client-side substring
   fallback still returns matches and nothing throws.
7. Re-point the endpoint URL in config.js (simulating Drive→Supabase) → confirm the
   frontend behaves identically.
