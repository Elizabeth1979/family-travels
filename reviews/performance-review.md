# Family Travels Web App Review

## Summary
The current implementation delivers core functionality but blocks rendering during remote fetches, duplicates inline styling, and leans heavily on client-side scripting. These patterns increase time-to-interactive (TTI), especially on constrained networks or when the Google Apps Script responds slowly. Below are actionable recommendations focused on performance, accessibility, and maintainability while keeping changes incremental.

## Home Map Page (`index.html` / `map.js`)
- **Defer long network work from first paint**: `initMap()` waits for the album list fetch before drawing the Leaflet map or showing navigation, so the UI appears frozen if the Apps Script is slow. Instantiate the map and menu immediately, then stream album markers as data arrives. Consider rendering the hamburger button and sidebar shell in markup so they are available before data binding. 【F:map.js†L8-L83】【F:index.html†L21-L41】
- **Add loading skeletons instead of empty states**: Render lightweight placeholders for album cards (CSS gradients instead of JS) while data loads. This gives users feedback during the fetch and improves perceived performance. 【F:index.html†L23-L41】
- **Cache album metadata**: `map.js` fetches full album data from Drive every load. Cache the JSON response in `localStorage` with a short TTL or ETag so returning users avoid repeated network latency. 【F:map.js†L8-L58】
- **Move popup inline styling into CSS**: `createPopupContent()` applies many `style.*` assignments per render, generating new style attributes and preventing CSS reuse. Replace with semantic classes (`popup-cover`, `popup-title`, etc.) defined once in `styles.css`. This reduces layout recalculations and keeps styling maintainable. 【F:map.js†L60-L109】【F:styles.css†L1-L200】
- **Avoid attaching global document listeners per render**: `initMenuToggle()` registers a document-level click handler each time `initMap()` runs. Guard against duplicate listeners or move to a delegated handler that toggles based on `open` state. 【F:map.js†L123-L156】

## Album Page (`album.html` / `album.js`)
- **Render header and map before fetching photos**: The page waits for `loadPhotos()` to resolve before hiding the loader, so the UI stays blank when Drive is slow. Split initialization: render metadata and mini-map immediately; keep gallery skeleton items until assets arrive. 【F:album.js†L6-L82】【F:album.html†L22-L59】
- **Batch image metadata more efficiently**: `loadImageDimensions()` iterates over every gallery link and creates `Image`/`video` elements even after PhotoSwipe loads. Requesting full-resolution thumbnails (`=s2000`) up front makes this redundant. Prefer using Drive's thumbnail service (`thumbnailLink`) when building the Apps Script response so width/height are known without extra network calls. 【F:album.js†L93-L175】
- **Reduce DOM churn during render**: `renderGallery()` injects section headers within the loop and reflows layout on each iteration. Build a `DocumentFragment`, append headers once, and insert into the DOM to minimize reflows. 【F:album.js†L178-L253】
- **Guard third-party module loading**: The inline `<script type="module">` pulls PhotoSwipe from jsDelivr without SRI or version pinning, delaying rendering if the CDN is slow. Bundle the dependency or use a locally hosted copy with `<link rel="preload">` hints to avoid blocking. 【F:album.html†L61-L84】

## Google Apps Script (`google-apps-script.js`)
- **AI alt text makes synchronous HTTP calls**: `generateAIDescription()` downloads binary blobs and hits the Gemini API for each image, all during the web request. Enable it only in a background trigger or cache responses so the user-facing endpoint stays fast. Keep `ENABLE_AI_ALT_TEXT` false by default. 【F:google-apps-script.js†L5-L118】【F:google-apps-script.js†L138-L198】
- **Use Drive Advanced Service for paginated queries**: `listAlbums()` iterates folders with `while (subfolders.hasNext())`, which can be slow for large collections. Switching to the Drive API with selective fields (`files(list)`) lets you fetch thumbnails, descriptions, and coordinates in one call and avoids `DriveApp.searchFiles` per folder. 【F:google-apps-script.js†L64-L135】
- **Return lightweight payloads**: The album listing includes full-size cover URLs (`=s2000`) even though thumbnails are enough for menus and popups. Provide a smaller `coverThumbnail` and let the client opt-in to high-res images lazily. 【F:google-apps-script.js†L100-L118】

## CSS & Accessibility
- **Reduce expensive visual effects**: Multiple gradient backgrounds, drop shadows, and blurred overlays cost paint time on mobile. Simplify gradients and reuse tokens (e.g., via utility classes) to cut render cost while keeping visual appeal. 【F:styles.css†L1-L200】
- **Respect prefers-reduced-motion**: Wrap animated transitions for menus and hover states in `@media (prefers-reduced-motion: no-preference)` to improve accessibility. 【F:styles.css†L65-L131】
- **Improve semantic structure**: Introduce `<main>` landmarks on album pages and ensure list markup (`<ul>`) wraps album links, aiding screen-reader navigation. Currently, section headers in the gallery are `<div>` wrappers; convert to semantic headings with `role="presentation"` if necessary. 【F:album.html†L24-L59】【F:album.js†L178-L253】

## Deployment & Loading Strategy
- **Progressive hydration**: Serve a prerendered HTML shell with the map container, navigation, and essential styles. Load `map.js` with `defer` so parsing doesn't block first paint, and gate heavier logic behind `requestIdleCallback`. 【F:index.html†L21-L46】
- **Measure with Core Web Vitals**: Add web-vitals logging or Lighthouse CI to quantify improvements. Slow Drive responses will inflate `Largest Contentful Paint`; caching and skeletons will shrink `First Input Delay`.
- **Consider static build step**: For known albums, pre-generate `albums.json` at build time and deploy via CDN (Netlify already in repo). Dynamic fetching can be reserved for new or updated folders only.

## Quick Wins Checklist
1. Initialize Leaflet immediately, then fetch markers asynchronously, showing skeletons in the sidebar.
2. Move popup/menu styles to CSS classes and trim gradients/shadows for cheaper paints.
3. Cache album metadata and thumbnails (localStorage + Cache-Control headers).
4. Streamline `loadImageDimensions()` by returning width/height from the Apps Script payload.
5. Keep Gemini integration off the hot path; process AI captions asynchronously with stored metadata.
