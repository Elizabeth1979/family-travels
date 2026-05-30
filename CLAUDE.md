# Project notes for Claude

## 2D map view — do NOT change without an explicit request
The owner is happy with how the 2D map opens and behaves. Leave the following
as-is unless they specifically ask to change it:

- On load the map frames **all** pins so every place is visible and the visitor
  can see where to tap (`frameAllPins` + `fitBounds` in `renderLeafletMarkers`,
  `map.js`, capped at `maxZoom: 12`). A "Loading…" state shows until the pins
  appear so the first view is never a blank default world map.
  (This replaced an earlier "frame the densest cluster" behavior at the owner's
  request — Elizabeth asked to fit all pins so none start off-screen.)
- Full-world zoom-out stays available (no forced minimum zoom).
- The area beyond the map edges uses the soft background colors on
  `.map-container` / `#map` in `styles.css`, not black.

Adding or adjusting markers, popups, and album data is fine. Changing the map's
framing, zoom behavior, or off-map background is not, unless asked.
