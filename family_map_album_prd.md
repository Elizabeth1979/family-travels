## 🗺️ Project: Family Travel Map & Album Site (MVP)

### 🎯 Goal

Create an interactive **map-based website** where each location pin opens an album of photos and videos from that trip.\
No backend servers. Hosted on **Netlify**, using **Google Drive folders** + a **Google Apps Script** to load the album contents.

---

## 🔹 Stage 1 — MVP (Zero-Backend)

### Main Features

1. **Map Homepage (Leaflet)**

   - Global map loads immediately (no intro screen).
   - Auto-fits all pins based on albums listed in `albums.json`.
   - Clicking a pin opens a popup with the album title, optional cover photo, and a button **"Open Album"**.
   - Accessible design: map labeled as a region; keyboard focus visible; each marker has a name; list view of albums mirrored beside the map.

2. **Album Page**

   - Small embedded map at top (zoomed into that trip's coordinates).
   - Displays title, date, and optional description.
   - Grid of photos and videos fetched from the Google Drive folder via the Apps Script.
   - Full-screen viewer (**PhotoSwipe**) with:
     - Swipe/arrow navigation
     - "ALT" button overlay on images to show alt-text/caption
     - Video playback
   - Optional download (browser Save).

3. **Albums Data (**``**)**

   - JSON file stored in the site repo; one entry per trip.
   - Example:
     ```json
     [
       {
         "id": "bat-yam-2025-04",
         "title": "Bat Yam Beach 2025",
         "lat": 32.019,
         "lng": 34.761,
         "folderId": "1ABCDEFghijkLmnOpQrSt",
         "cover": "https://drive.google.com/uc?export=view&id=1XYZCoverPhoto"
       },
       {
         "id": "eilat-2024-08",
         "title": "Eilat Trip 2024",
         "lat": 29.55,
         "lng": 34.95,
         "folderId": "1AnotherFolderId"
       }
     ]
     ```
   - `lat` / `lng` come from Google Maps: right-click "What's here?" → copy coordinates.
   - `folderId` = Google Drive folder ID (set to "Anyone with link can view").

4. **Google Apps Script**

   - Lists all files in a Drive folder and returns them as JSON:
     ```js
     // GET https://script.google.com/macros/s/XXX/exec?folder=FOLDER_ID
     { "items": [
       { "name": "IMG_123.jpg", "id": "abc", "mime": "image/jpeg",
         "src": "https://drive.google.com/uc?export=download&id=abc" }
     ]}
     ```
   - Site fetches this JSON and displays images/videos in the gallery.

5. **Hosting**

   - Static site deployed on **Netlify**.
   - Fetches data from `albums.json` and the published Google Apps Script URL.

6. **Privacy**

   - All albums public by link in Stage 1.
   - Private/unlisted visibility planned for Stage 2.

7. **Non-Goals (for now)**

   - No authentication or admin panel.
   - No search/filter.
   - No uploads from the site UI.

---

## 🔹 Stage 2 — Productization (Future)

### Planned Upgrades

- Add **admin panel** to create/edit albums without editing JSON manually.
- Add **visibility controls** (public / private / unlisted).
- Migrate storage to **Cloudflare R2** or similar CDN.
- Add **short share links** (`/p/abc123`) with optional expiry.
- Add **search/filter** by year, tags, or people.
- Optional analytics and per-album metrics.

---

## ⚙️ Technical Stack Summary

- **Frontend:** HTML, CSS, JavaScript
- **Map Library:** Leaflet (accessible, open-source)
- **Gallery Library:** PhotoSwipe (lightbox for photos/videos)
- **Data Source:** Google Drive folders (JSON via Google Apps Script)
- **Hosting:** Netlify (static deploy)
- **Accessibility:** Keyboard support, focus indicators, alt-text toggle, map labeled as region

