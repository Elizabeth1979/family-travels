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

## Album pages are standalone galleries — keep the header hidden
A shared album link should open as a clean, self-contained gallery. `styles.css`
hides the whole site header on album pages (`.album-page header { display: none }`),
so the back link, share button, and theme toggle do not appear there. The album
title, map, and photos live in `main.album-container` and are unaffected. Don't
re-introduce site navigation on album pages unless asked. Trade-off: there is no
in-page back/share on album pages — use the browser back button and copy the URL
to share (the `/trip/` rich preview still works).

## Admin page (`admin.html`, body class `admin-page`)
- The shared site `header` is `position: absolute` to overlay the map. The admin
  page has no map behind it, so `admin.css` forces `.admin-page header { position:
  static }` to keep content below the header instead of under the floating back
  button. Keep that override.
- On phones the editor is master->detail: selecting an album adds `.editing` to
  `.admin-grid`, which hides the album list and shows a "Back to albums" button
  (`closeEditor` removes it). Desktop shows list + editor side by side.
- Place search uses OpenStreetMap Nominatim. The fetch host is whitelisted in the
  `connect-src` of the CSP in `vercel.json`; new external hosts must be added there
  or requests are blocked.

## Admin token is a SHARED SECRET — never commit the real one
`google-apps-script.js` defines `ADMIN_TOKEN`, the secret gating every write
(`doPost`). This repo is on GitHub, so treat any value committed in that file as
public. The token actually enforced lives in the deployed Apps Script project and
should be a long random string — set it there and type the same value into the
admin token box. Do NOT commit a strong/live token to the repo, and never paste
the live token into chat, commit messages, or other tracked files.

## Build vs. lint
`npm run build` is the real gate — it is what CI runs (the "build" check). JS lint
is clean apart from a few pre-existing warnings; `npm run lint:css` reports ~90
pre-existing errors and is NOT wired into CI, so a green build does not imply lint
is clean. Run lint locally if cleanliness matters; don't assume CI catches it.
