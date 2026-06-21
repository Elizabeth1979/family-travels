# Photo Wall gallery (replaces the 3D Gallery)

**Date:** 2026-06-21
**Status:** Approved — ready for implementation plan
**Scope:** Frontend only. No backend / Google Apps Script changes. No redeploy required.

## Summary

The map page has two views, switched by a toggle: the **2D Map** (Leaflet,
the owner's protected view) and a **3D Gallery** (`StellarCardGallery`). The
owner finds the 3D gallery not great to use. Replace it with a **masonry photo
wall** — a flowing, Pinterest-style grid of album covers that is both attractive
and easy to browse.

The original request also asked to hide empty albums everywhere. That work is
**explicitly deferred** because it requires adding a photo count to the backend
and redeploying the Apps Script, which the owner does not want to do right now.
This spec does not touch album visibility — the wall shows the same set of
albums the current gallery does.

## Goals

- Replace the 3D `StellarCardGallery` with a masonry photo wall.
- Relabel the toggle option from "3D Gallery" to "Gallery".
- Keep the change small and contained, reusing the existing mount/toggle
  plumbing.

## Non-goals

- No backend or Google Apps Script changes.
- No empty-album hiding / album-count work (deferred).
- No changes to the 2D Leaflet map's framing, zoom, off-map background, or its
  pin → preview-popup behavior (protected per `CLAUDE.md`).
- No changes to the album page, photo lightbox, or admin.

## Design

### The Photo Wall component

New component `src/PhotoWall.jsx` replacing `src/StellarCardGallery.jsx`.

- **Layout:** CSS multi-column masonry (`columns`) — 3 columns on desktop,
  2 on tablet, 1 on narrow phones. Tiles flow top-to-bottom, varied heights
  from each cover's natural aspect ratio (`break-inside: avoid`).
- **Tile contents:** cover image, and an overlaid caption with the album
  **title** and **date**, plus a small **Travel / Event badge** (from
  `album.type`, defaulting to "travel").
- **No photo count** on tiles — the count isn't available without the deferred
  backend change.
- **Missing cover:** if `album.cover` is empty/null, render a soft colored
  placeholder tile showing the album title instead of a broken image. Nothing
  is hidden.
- **Interaction:** tapping/clicking a tile navigates directly to that album
  (`album.html?id=<album.id>`). No preview popup.
- **Hover (pointer devices):** subtle lift / shadow on the tile.
- Ordering: keep the same album order the current gallery/list uses (no new
  sort introduced).

### Wiring

- `src/main.jsx`: `window.mountGallery(...)` renders `PhotoWall` instead of
  `StellarCardGallery`. The existing root-caching / re-mount logic and the
  `cards` mapping are kept as-is. `MapTypeToggle` mounting is unchanged.
- `src/components/MapTypeToggle.jsx`: the `gallery` option's label changes from
  **"3D Gallery"** to **"Gallery"**, with a grid-style icon (the existing 2D Map
  option already uses a grid icon — pick a distinct grid/photo icon so the two
  remain visually different). The `accessible` (2D Map) option is unchanged.
- `map.js`: no logic changes. It already calls
  `window.mountGallery('map', getFilteredAlbums())`, so the wall automatically
  respects the active Travel/Event filter. The `currentMapType === 'gallery'`
  path, preference normalization (old `globe`/`enhanced` → `gallery`), and
  `gallery-view` body class continue to work and now drive the photo wall.

### Styling

- Wall styles live with the component (`src/index.css` or a co-located style
  block, matching how the current React gallery is styled). Tile, caption,
  badge, hover, and placeholder styles are added there.
- Do not alter `.map-container` / `#map` off-map background rules in
  `styles.css`.

### Cleanup

- Delete `src/StellarCardGallery.jsx` and remove its import from `src/main.jsx`.
- Remove any now-unused 3D-specific CSS that belonged only to the stellar
  gallery (verify nothing else references it before deleting).

## Data flow

`map.js` fetches albums → `getFilteredAlbums()` applies the Travel/Event filter
→ `window.mountGallery('map', albums)` → `main.jsx` maps albums to `cards`
(`{ id, cover, title, date, type, url }`) → `PhotoWall` renders tiles → tile
click → `album.html?id=<id>`.

## Build / verification

- The project builds via Vite (`npm run build` / `dist/`). After the change:
  build succeeds, the toggle shows "2D Map" and "Gallery", selecting "Gallery"
  renders the masonry wall, tiles open the correct album, the Travel/Event
  filter narrows the wall, and the 2D map view is visually unchanged.
- Manual check on a narrow viewport: columns collapse 3 → 2 → 1.

## Risks

- The `mountGallery` re-mount/root-caching code is marked critical in
  `main.jsx`. Keep its structure; only change which component is rendered.
- Ensure the toggle's two icons stay visually distinct after relabeling.
