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
