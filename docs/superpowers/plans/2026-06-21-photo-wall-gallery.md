# Photo Wall Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the map page's 3D Gallery view with a scrollable masonry "Photo Wall" of album covers.

**Architecture:** Keep the existing view plumbing intact. The map page already mounts a React component into `#map` via `window.mountGallery(...)` and switches views via a React toggle. We swap the rendered component from `StellarCardGallery` (3D/Three.js) to a new presentational `PhotoWall` (CSS-columns masonry), relabel the toggle option, and delete the old 3D component and its now-unused 3D dependencies. No backend, no map changes.

**Tech Stack:** React 19, Vite 7, plain CSS (`src/index.css`). No new dependencies.

## Global Constraints

- **Frontend only.** Do NOT modify `google-apps-script.js`, `api/`, or any backend. No script redeploy.
- **Do NOT change the 2D Leaflet map** — framing, zoom, off-map background (`.map-container` / `#map` background rules in `styles.css`), or pin → popup behavior. Protected per `CLAUDE.md`.
- **No album visibility / empty-album filtering** — deferred. The wall shows the same albums the current gallery does.
- **No new test runner.** The repo has no JS unit tests; verify each task with `npm run build`, `npm run lint`, and a browser visual check.
- Album order: keep whatever order `getFilteredAlbums()` returns; introduce no new sort.
- Spec: `docs/superpowers/specs/2026-06-21-photo-wall-gallery-design.md`.

## File Structure

- **Create:** `src/PhotoWall.jsx` — the masonry wall component (one responsibility: render album tiles).
- **Modify:** `src/index.css` — append Photo Wall styles.
- **Modify:** `src/main.jsx` — `mountGallery` renders `PhotoWall`; drop `StellarCardGallery` import.
- **Modify:** `src/components/MapTypeToggle.jsx` — relabel `gallery` option "3D Gallery" → "Gallery", swap to a distinct photo icon.
- **Modify:** `map.js` — screen-reader announcement string "3D Gallery" → "Gallery" (and stale comments).
- **Delete:** `src/StellarCardGallery.jsx`.
- **Modify:** `package.json` — remove now-unused 3D deps (`three`, `@react-three/fiber`, `@react-three/drei`).

---

### Task 1: Create the PhotoWall component

**Files:**
- Create: `src/PhotoWall.jsx`

**Interfaces:**
- Consumes: a `cards` prop — an array of objects shaped by `mountGallery` in `src/main.jsx`. Each card has: `id` (string), `cover` (image URL string or falsy), `title` (string), `date` (string, may be empty), `type` (`'travel'` | `'event'`, may be missing), `url` (string, e.g. `album.html?id=<id>`), `alt` (string).
- Produces: `export default function PhotoWall({ cards })` — a React component rendering a scrollable masonry of `<a>` tiles. Consumed by `src/main.jsx` Task 3.

- [ ] **Step 1: Write the component**

Create `src/PhotoWall.jsx` with exactly this content:

```jsx
import React from 'react';

const TYPE_LABELS = { travel: 'Travel', event: 'Event' };

// Deterministic soft background for albums that have no cover image, so the
// wall shows a labelled colored tile instead of a broken image. (Nothing is
// hidden — empty-album filtering is intentionally out of scope.)
const PLACEHOLDER_COLORS = ['#4aa3b5', '#d68c45', '#6c7a89', '#9b6a8f', '#5a8f69'];

function placeholderColor(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return PLACEHOLDER_COLORS[h % PLACEHOLDER_COLORS.length];
}

function Tile({ card }) {
    const type = (card.type || 'travel').toLowerCase();
    const badgeLabel = TYPE_LABELS[type] || TYPE_LABELS.travel;
    const isEvent = type === 'event';

    return (
        <a className="pw-tile" href={card.url} aria-label={`Open album ${card.title}`}>
            {card.cover ? (
                <img
                    className="pw-img"
                    src={card.cover}
                    alt={card.alt || card.title || ''}
                    loading="lazy"
                />
            ) : (
                <div
                    className="pw-placeholder"
                    style={{ background: placeholderColor(card.title || card.id || '') }}
                >
                    <span>{card.title}</span>
                </div>
            )}
            <span className={`pw-badge ${isEvent ? 'pw-badge-event' : ''}`}>{badgeLabel}</span>
            <div className="pw-caption">
                <b>{card.title}</b>
                {card.date ? <span>{card.date}</span> : null}
            </div>
        </a>
    );
}

export default function PhotoWall({ cards }) {
    if (!cards || cards.length === 0) {
        return <div className="pw-empty">No albums to show yet.</div>;
    }
    return (
        <div className="pw-scroll">
            <div className="pw-wall">
                {cards.map((card) => (
                    <Tile key={card.id} card={card} />
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify it builds and lints**

Run: `npm run build`
Expected: build succeeds, no errors. (`PhotoWall` is not imported yet, so it won't appear in output — that's fine; this confirms the file parses.)

Run: `npx eslint src/PhotoWall.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/PhotoWall.jsx
git commit -m "feat(gallery): add PhotoWall masonry component"
```

---

### Task 2: Add Photo Wall styles

**Files:**
- Modify: `src/index.css` (append at end)

**Interfaces:**
- Consumes: the class names emitted by `PhotoWall` (`pw-scroll`, `pw-wall`, `pw-tile`, `pw-img`, `pw-placeholder`, `pw-badge`, `pw-badge-event`, `pw-caption`, `pw-empty`).
- Produces: styling only; no JS interface. Note: the React root fills `#map` because `styles.css` sets `#map > div { position: absolute; inset: 0; }`, so `.pw-scroll` is `position: absolute; inset: 0` and scrolls internally.

- [ ] **Step 1: Append styles**

Append exactly this block to the end of `src/index.css`:

```css
/* ===== Photo Wall gallery (masonry) ===== */
.pw-scroll {
    position: absolute;
    inset: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: #d3dde3;
}

[data-theme="dark"] .pw-scroll {
    background: #0e1726;
}

.pw-wall {
    columns: 3;
    column-gap: 14px;
    max-width: 1100px;
    margin: 0 auto;
    /* top padding clears the floating map header */
    padding: 88px 16px 32px;
}

.pw-tile {
    position: relative;
    display: block;
    break-inside: avoid;
    margin-bottom: 14px;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.16);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
    text-decoration: none;
    color: #fff;
}

@media (hover: hover) {
    .pw-tile:hover {
        transform: translateY(-4px);
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.26);
    }
}

.pw-img {
    display: block;
    width: 100%;
    height: auto;
}

.pw-placeholder {
    display: flex;
    align-items: flex-end;
    min-height: 180px;
    padding: 16px;
    font-weight: 700;
    font-size: 18px;
}

.pw-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: rgba(74, 163, 181, 0.92);
}

.pw-badge-event {
    background: rgba(214, 140, 69, 0.95);
}

.pw-caption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 14px 12px 11px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.72));
}

.pw-caption b {
    display: block;
    font-size: 15px;
}

.pw-caption span {
    font-size: 12px;
    opacity: 0.85;
}

.pw-empty {
    padding: 120px 24px;
    text-align: center;
    opacity: 0.7;
}

@media (max-width: 900px) {
    .pw-wall {
        columns: 2;
    }
}

@media (max-width: 560px) {
    .pw-wall {
        columns: 1;
        padding-top: 80px;
    }
}
```

- [ ] **Step 2: Verify CSS lints and builds**

Run: `npm run lint:css`
Expected: passes (no errors on `src/index.css`).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style(gallery): add Photo Wall masonry styles"
```

---

### Task 3: Render PhotoWall from mountGallery

**Files:**
- Modify: `src/main.jsx:3` (import) and `src/main.jsx:60-64` (render call)

**Interfaces:**
- Consumes: `PhotoWall` default export from Task 1; the `cards` array already built inside `mountGallery`.
- Produces: `window.mountGallery` now renders the masonry wall. The root-caching / re-mount logic and the `cards` mapping are unchanged.

- [ ] **Step 1: Swap the import**

In `src/main.jsx`, replace line 3:

```jsx
import StellarCardGallery from './StellarCardGallery'
```

with:

```jsx
import PhotoWall from './PhotoWall'
```

- [ ] **Step 2: Swap the rendered component**

In `src/main.jsx`, inside `window.mountGallery`, change the render block from:

```jsx
    galleryRoot.render(
        <React.StrictMode>
            <StellarCardGallery cards={cards} />
        </React.StrictMode>
    );
```

to:

```jsx
    galleryRoot.render(
        <React.StrictMode>
            <PhotoWall cards={cards} />
        </React.StrictMode>
    );
```

Leave the root-caching logic, the `cards` mapping, and the comments about re-mount safety as-is.

- [ ] **Step 3: Verify build and lint**

Run: `npm run build`
Expected: build succeeds; no "StellarCardGallery is not defined" or unused-import errors.

Run: `npx eslint src/main.jsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.jsx
git commit -m "feat(gallery): mount PhotoWall instead of 3D gallery"
```

---

### Task 4: Relabel the toggle option

**Files:**
- Modify: `src/components/MapTypeToggle.jsx:8-16` (the `gallery` option)
- Modify: `map.js` (screen-reader string and stale comments)

**Interfaces:**
- Consumes: nothing new.
- Produces: the toggle's `gallery` option reads "Gallery" with a distinct photo icon; the option `id` stays `"gallery"` so `map.js` / preference logic is unaffected.

- [ ] **Step 1: Relabel and re-icon the gallery option**

In `src/components/MapTypeToggle.jsx`, replace the `gallery` option object (the first entry in `options`, currently labelled "3D Gallery" with a globe `svg`) with:

```jsx
        {
            id: "gallery",
            label: "Gallery",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                </svg>
            ),
        },
```

(This is a photo/image icon — distinct from the 2D Map option's grid-lines icon.)

- [ ] **Step 2: Update the screen-reader announcement in map.js**

In `map.js`, find the line in `switchMapType`:

```js
        const viewName = newType === 'gallery' ? '3D Gallery' : '2D Map';
```

Replace with:

```js
        const viewName = newType === 'gallery' ? 'Gallery' : '2D Map';
```

- [ ] **Step 3: Tidy stale "3D Gallery" comments**

In `map.js`, update the two comments that say "3D Gallery" to "Gallery" so the code reads correctly (do not change any logic):
- the comment above `switchMapType` (`// Switch between map types (2D Map vs 3D Gallery)`)
- the comment above `applyAlbumFilter` (`// ...the active view (map markers or 3D gallery)...`)

Also update the inline comment on the `currentMapType` declaration near the top of `map.js` (`// 'accessible' (Leaflet 2D map) or 'gallery' (3D Gallery)`) to say `Gallery` (masonry photo wall).

- [ ] **Step 4: Verify build and lint**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run lint:js`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/MapTypeToggle.jsx map.js
git commit -m "feat(gallery): relabel toggle '3D Gallery' to 'Gallery'"
```

---

### Task 5: Delete the 3D gallery and its dependencies

**Files:**
- Delete: `src/StellarCardGallery.jsx`
- Modify: `package.json` (remove unused 3D deps)

**Interfaces:**
- Consumes: nothing.
- Produces: smaller dependency tree; no behavior change.

- [ ] **Step 1: Confirm nothing else imports the 3D component or libs**

Run: `grep -rn "StellarCardGallery\|@react-three\|from 'three'\|from \"three\"" src map.js index.html`
Expected: the only matches are inside `src/StellarCardGallery.jsx` itself. If anything else references them, STOP and report — do not delete.

- [ ] **Step 2: Delete the component**

```bash
git rm src/StellarCardGallery.jsx
```

- [ ] **Step 3: Remove unused 3D dependencies from package.json**

In `package.json`, remove these three lines from `devDependencies`:

```json
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.4.2",
```

and

```json
    "three": "^0.181.2",
```

Then refresh the lockfile:

Run: `npm install`
Expected: completes; `package-lock.json` updates.

- [ ] **Step 4: Verify the build still succeeds without the 3D libs**

Run: `npm run build`
Expected: build succeeds with no "Cannot resolve 'three'" / "@react-three" errors.

Run: `npm run lint`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/StellarCardGallery.jsx package.json package-lock.json
git commit -m "chore(gallery): remove 3D gallery component and unused deps"
```

---

### Task 6: Visual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Build and serve the site**

Run: `npm run build` then serve `dist/` (e.g. `npx http-server dist -p 8080`), or use the project's normal preview (`npm run preview`).

- [ ] **Step 2: Verify the gallery**

Open the map page and confirm:
- The toggle shows **"2D Map"** and **"Gallery"** with distinct icons.
- Selecting **Gallery** shows a scrollable masonry wall of album covers (3 columns on desktop).
- Each tile shows the cover, a title + date caption, and a Travel/Event badge.
- Clicking a tile navigates to `album.html?id=<id>` for that album.
- The **Travel/Event filter** narrows the wall.
- Any album without a cover shows a colored placeholder tile with its title (not a broken image).
- Resize narrow: columns collapse 3 → 2 → 1; content scrolls and isn't hidden behind the header.

- [ ] **Step 3: Verify the 2D map is unchanged**

Switch to **2D Map** and confirm framing, zoom, off-map background, and pin → popup behavior are exactly as before.

- [ ] **Step 4: Final commit (only if any tweak was needed)**

If Steps 2-3 required a small fix, commit it:

```bash
git add -A
git commit -m "fix(gallery): visual polish from manual verification"
```

---

## Self-Review

**Spec coverage:**
- Masonry PhotoWall replacing 3D gallery → Tasks 1, 2, 3. ✓
- Tile = cover + title + date + Travel/Event badge → Task 1. ✓
- Tap opens album directly → Task 1 (`<a href={card.url}>`). ✓
- Missing-cover placeholder, nothing hidden → Task 1. ✓
- Toggle relabel "3D Gallery" → "Gallery" → Task 4. ✓
- Respects Travel/Event filter → no change needed (`mountGallery` already called with `getFilteredAlbums()`); confirmed in Task 6. ✓
- Frontend only, no backend, no empty-album work → Global Constraints; no backend file touched. ✓
- 2D map untouched → Global Constraints + Task 6 Step 3. ✓
- Delete `StellarCardGallery.jsx` and unused 3D CSS/deps → Task 5 (no stellar-specific CSS exists in `src/index.css`, confirmed during planning; deps removed). ✓

**Placeholder scan:** No TBD/TODO; all code shown in full. ✓

**Type consistency:** Card fields (`id`, `cover`, `title`, `date`, `type`, `url`, `alt`) match the `cards` mapping in `src/main.jsx` and are used consistently in Task 1. Toggle option `id` stays `"gallery"` across Tasks 3-4. ✓
