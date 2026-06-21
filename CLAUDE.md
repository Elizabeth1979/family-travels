# Project notes for Claude

## 2D map view — do NOT change without an explicit request
The owner is happy with how the 2D map opens and behaves. Leave the following
as-is unless they specifically ask to change it:

- On load the map frames the densest cluster of nearby places
  (`computeFocusBounds` + `fitBounds` in `renderLeafletMarkers`, `map.js`) so it
  fills the screen instead of zooming out to a letterboxed world view.
- Full-world zoom-out stays available (no forced minimum zoom).
- The area beyond the map edges uses the soft background colors on
  `.map-container` / `#map` in `styles.css`, not black.

Adding or adjusting markers, popups, and album data is fine. Changing the map's
framing, zoom behavior, or off-map background is not, unless asked.

## Repo memory — docs index
`docs/README.md` is the single index of all plans, specs, session logs, and knowledge
graphs. Read it first when picking up work or checking "did we already decide X?". When
you add or meaningfully change anything under `docs/`, update its one-line entry there in
the right section. New plans → `docs/plans/`; specs → `docs/superpowers/specs/`.

## Session logs
At the end of a working/brainstorming session, write a short searchable log to
`docs/sessions/YYYY-MM-DD-<topic>.md`: what we set out to do, key findings, decisions
made (and why), artifacts produced, and the next step. Add a keyword line near the top
so it's easy to grep later. Keep it a narrative summary — link to specs/plans in
`docs/plans/` rather than duplicating them. Then add its entry to `docs/README.md`.

## Knowledge graphs
`graphify-out/` (`/graphify`) and `.understand-anything/` (`/understand-chat`) are
static-analysis graphs of the code — regenerate them after significant code changes, and
note staleness in `docs/README.md`.
