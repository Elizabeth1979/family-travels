import { CONFIG } from './config.js';
import { loadLeaflet, createTileLayer, createLeafletMapOptions } from './mapUtils.js';

// Default coordinates used by the Apps Script when an album has no location.
// We use them to flag albums that still need a pin placed.
const DEFAULT_LAT = 31.7683;
const DEFAULT_LNG = 35.2137;

const TOKEN_KEY = 'admin_token';

// Same key/shape the public site uses (utils.js fetchAlbums), so the map and
// admin page warm each other's cache. Admin reads it for an instant first paint
// (cache-then-network) and writes to it after every fresh fetch.
const ALBUMS_CACHE_KEY = 'family_travel_albums';

let albums = [];
let mode = 'edit'; // 'edit' | 'new'
let current = null; // currently edited album
let selectedCoverId = '';
let pinMap = null;
let pinMarker = null;

// ---------------------------------------------------------------------------
// Token + write API
// ---------------------------------------------------------------------------

function getToken() {
  return (document.getElementById('admin-token').value || '').trim();
}

// All writes go through a POST with text/plain so the browser treats it as a
// "simple" request (no CORS preflight, which Apps Script can't answer).
async function adminPost(action, params) {
  const token = getToken();
  if (!token) throw new Error('Enter your admin token first.');

  const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, action, ...params }),
  });

  const data = await response.json();
  if (!data || data.ok !== true) {
    throw new Error((data && data.error) || 'Request failed');
  }
  return data;
}

let statusTimer = null;

// Show feedback as a floating toast and auto-hide it. Errors linger longer than
// success/info so they're not missed.
function setStatus(message, kind = 'info') {
  const el = document.getElementById('admin-status');
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.toggle('is-visible', Boolean(message));

  if (statusTimer) clearTimeout(statusTimer);
  if (message) {
    statusTimer = setTimeout(
      () => el.classList.remove('is-visible'),
      kind === 'error' ? 8000 : 4000
    );
  }
}

// ---------------------------------------------------------------------------
// Album list
// ---------------------------------------------------------------------------

async function loadAlbumsFresh() {
  // Cache-bust so the admin always gets the true current state from Apps Script
  // (e.g. right after an edit), regardless of the 5-minute public-site cache.
  const response = await fetch(
    `${CONFIG.APPS_SCRIPT_URL}?action=list&master=${CONFIG.MASTER_FOLDER_ID}&t=${Date.now()}`
  );
  if (!response.ok) throw new Error(`Failed to load albums: ${response.status}`);
  const data = await response.json();
  if (data && data.error) throw new Error(data.error);
  const list = Array.isArray(data) ? data : [];
  // Refresh the shared cache so the next admin/map load paints instantly.
  try {
    localStorage.setItem(ALBUMS_CACHE_KEY, JSON.stringify({ data: list, timestamp: Date.now() }));
  } catch (e) {
    console.warn('Album cache write failed:', e);
  }
  return list;
}

// Read whatever albums are in the shared cache (ignoring age) for an instant
// first paint. Returns null if there's nothing usable cached.
function getCachedAlbums() {
  try {
    const cached = localStorage.getItem(ALBUMS_CACHE_KEY);
    if (cached) {
      const { data } = JSON.parse(cached);
      if (Array.isArray(data) && data.length) return data;
    }
  } catch (e) {
    console.warn('Album cache read failed:', e);
  }
  return null;
}

function hasLocation(album) {
  return !(album.lat === DEFAULT_LAT && album.lng === DEFAULT_LNG);
}

function renderAlbumList() {
  const list = document.getElementById('admin-album-list');
  list.innerHTML = '';

  if (albums.length === 0) {
    const li = document.createElement('li');
    li.className = 'admin-empty';
    li.textContent = 'No albums yet. Create one or add a folder in Drive.';
    list.appendChild(li);
    return;
  }

  albums.forEach((album) => {
    const li = document.createElement('li');
    li.className = 'admin-album-item';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-album-button';
    button.addEventListener('click', () => selectAlbum(album));

    if (album.cover) {
      const img = document.createElement('img');
      img.className = 'admin-album-thumb';
      img.src = album.cover;
      img.alt = '';
      img.loading = 'lazy';
      // A private/missing cover returns an HTML permission page, not an image.
      // Swap in the empty placeholder instead of a broken-image icon. (Opening
      // the album is what actually publishes it; the list never auto-shares.)
      img.addEventListener(
        'error',
        () => {
          const placeholder = document.createElement('div');
          placeholder.className = 'admin-album-thumb admin-album-thumb-empty';
          img.replaceWith(placeholder);
        },
        { once: true }
      );
      button.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'admin-album-thumb admin-album-thumb-empty';
      button.appendChild(placeholder);
    }

    const meta = document.createElement('div');
    meta.className = 'admin-album-meta';

    const title = document.createElement('div');
    title.className = 'admin-album-title';
    title.textContent = album.title;
    meta.appendChild(title);

    if (album.date) {
      const date = document.createElement('div');
      date.className = 'admin-album-date';
      date.textContent = album.date;
      meta.appendChild(date);
    }

    if (!hasLocation(album)) {
      const badge = document.createElement('span');
      badge.className = 'admin-badge admin-badge-warn';
      badge.textContent = 'No location';
      meta.appendChild(badge);
    }

    button.appendChild(meta);
    li.appendChild(button);
    list.appendChild(li);
  });
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

// Point the persistent "Open folder in Drive" link at this album's folder and
// reveal it. Shown for any existing album so the admin can always jump to Drive
// to add or manage photos — not just on the screen right after creating it.
function setDriveLink(folderId) {
  const field = document.getElementById('open-drive-field');
  const link = document.getElementById('open-drive-link-persistent');
  if (folderId) {
    link.href = `https://drive.google.com/drive/folders/${folderId}`;
    field.hidden = false;
  } else {
    link.removeAttribute('href');
    field.hidden = true;
  }
}

function showEditor() {
  const editor = document.getElementById('admin-editor');
  editor.hidden = false;
  document.querySelector('.admin-grid').classList.add('editing');
  // On phones the list is now hidden, so bring the editor into view.
  if (window.matchMedia('(max-width: 800px)').matches) {
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closeEditor() {
  document.getElementById('admin-editor').hidden = true;
  document.querySelector('.admin-grid').classList.remove('editing');
}

function selectAlbum(album) {
  mode = 'edit';
  current = album;
  selectedCoverId = '';
  clearPlaceSearch();

  document.getElementById('editor-heading').textContent = 'Edit album';
  document.getElementById('edit-title').value = album.title || '';
  document.getElementById('edit-type').value = album.type === 'event' ? 'event' : 'travel';
  document.getElementById('edit-date').value = album.date || '';
  document.getElementById('edit-description').value = album.description || '';

  const lat = typeof album.lat === 'number' ? album.lat : DEFAULT_LAT;
  const lng = typeof album.lng === 'number' ? album.lng : DEFAULT_LNG;
  document.getElementById('edit-lat').value = lat;
  document.getElementById('edit-lng').value = lng;

  document.getElementById('save-btn').textContent = 'Save';
  document.getElementById('new-album-help').hidden = true;
  document.getElementById('cover-field').hidden = false;
  setDriveLink(album.folderId);

  showEditor();
  initPinMap(lat, lng);
  loadCoverChoices(album.folderId);
}

function startNewAlbum() {
  mode = 'new';
  current = null;
  selectedCoverId = '';
  clearPlaceSearch();

  document.getElementById('editor-heading').textContent = 'New album';
  document.getElementById('edit-title').value = '';
  document.getElementById('edit-type').value = 'travel';
  document.getElementById('edit-date').value = '';
  document.getElementById('edit-description').value = '';
  document.getElementById('edit-lat').value = '';
  document.getElementById('edit-lng').value = '';

  document.getElementById('save-btn').textContent = 'Create album';
  document.getElementById('new-album-help').hidden = true;
  document.getElementById('cover-field').hidden = true; // no photos yet
  document.getElementById('admin-cover-grid').innerHTML = '';
  setDriveLink(''); // no folder until the album is created

  showEditor();
  initPinMap(20, 0, 2);
}

function initPinMap(lat, lng, zoom = 10) {
  loadLeaflet()
    .then(() => {
      const container = document.getElementById('admin-pin-map');
      if (pinMap) {
        pinMap.remove();
        pinMap = null;
      }
      container.innerHTML = '';

      pinMap = L.map('admin-pin-map', createLeafletMapOptions({
        center: [lat, lng],
        zoom,
        zoomControl: true,
      }));
      // Use OpenStreetMap for the picker so roads are visible at every zoom.
      // (The NatGeo overview the public map uses has no street-level tiles and
      // shows "Map data not yet available" when you zoom in to place a pin.)
      createTileLayer('osm').addTo(pinMap);

      pinMarker = L.marker([lat, lng], { draggable: true }).addTo(pinMap);
      pinMarker.on('dragend', () => {
        const pos = pinMarker.getLatLng();
        updateCoordInputs(pos.lat, pos.lng);
      });

      pinMap.on('click', (e) => {
        pinMarker.setLatLng(e.latlng);
        updateCoordInputs(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(() => pinMap && pinMap.invalidateSize(), 100);
    })
    .catch((err) => setStatus('Could not load the map: ' + err.message, 'error'));
}

function updateCoordInputs(lat, lng) {
  document.getElementById('edit-lat').value = Number(lat.toFixed(6));
  document.getElementById('edit-lng').value = Number(lng.toFixed(6));
}

function syncMarkerFromInputs() {
  const lat = parseFloat(document.getElementById('edit-lat').value);
  const lng = parseFloat(document.getElementById('edit-lng').value);
  if (!isNaN(lat) && !isNaN(lng) && pinMap && pinMarker) {
    pinMarker.setLatLng([lat, lng]);
    pinMap.panTo([lat, lng]);
  }
}

// ---------------------------------------------------------------------------
// Place search (OpenStreetMap Nominatim) — type a place, drop the pin for you
// ---------------------------------------------------------------------------

function setPinLocation(lat, lng, zoom) {
  updateCoordInputs(lat, lng);
  if (pinMap && pinMarker) {
    pinMarker.setLatLng([lat, lng]);
    pinMap.setView([lat, lng], zoom || pinMap.getZoom());
  }
}

async function geocodePlace(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=' +
    encodeURIComponent(query);
  // Send only the origin (the page default is no-referrer) so Nominatim can
  // identify the app per their usage policy without leaking the full URL.
  const response = await fetch(url, { referrerPolicy: 'origin' });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  return response.json();
}

function hidePlaceResults() {
  const results = document.getElementById('place-results');
  results.hidden = true;
  results.innerHTML = '';
}

function clearPlaceSearch() {
  document.getElementById('place-search').value = '';
  hidePlaceResults();
}

function showPlaceMessage(message) {
  const results = document.getElementById('place-results');
  results.hidden = false;
  results.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'admin-search-msg';
  li.textContent = message;
  results.appendChild(li);
}

function renderPlaceResults(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    showPlaceMessage('No matches found.');
    return;
  }

  const results = document.getElementById('place-results');
  results.hidden = false;
  results.innerHTML = '';

  matches.forEach((match) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-search-result';
    btn.textContent = match.display_name;
    btn.addEventListener('click', () => {
      setPinLocation(parseFloat(match.lat), parseFloat(match.lon), 13);
      hidePlaceResults();
    });
    li.appendChild(btn);
    results.appendChild(li);
  });
}

async function handlePlaceSearch() {
  const query = document.getElementById('place-search').value.trim();
  if (!query) return;

  showPlaceMessage('Searching…');
  try {
    renderPlaceResults(await geocodePlace(query));
  } catch (err) {
    showPlaceMessage('Search error: ' + err.message);
  }
}

function showCoverNote(grid, message) {
  const note = document.createElement('p');
  note.className = 'admin-hint';
  note.textContent = message;
  grid.appendChild(note);
}

// Re-shares the folder and every file in it (videos included) as
// "anyone with link" — the access the lh3/thumbnail image URLs require.
async function ensureAlbumPublic(folderId) {
  setStatus('Publishing photos…');
  const result = await adminPost('setSharing', { folderId, public: true });
  setStatus(`Published ${result.filesUpdated} photos.`, 'success');
}

async function loadCoverChoices(folderId, { allowAutoShare = true } = {}) {
  const grid = document.getElementById('admin-cover-grid');
  grid.innerHTML = '';
  if (!folderId) return;

  let data;
  try {
    const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?folder=${folderId}&t=${Date.now()}`);
    data = await response.json();
  } catch (err) {
    showCoverNote(grid, 'Could not load photos: ' + err.message);
    return;
  }

  const images = (data.items || []).filter(
    (item) => item.size > 0 && item.mime && item.mime.startsWith('image/')
  );

  if (images.length === 0) {
    showCoverNote(grid, 'No photos in this folder yet.');
    return;
  }

  // A thumbnail that fails to load means the files are still private (Google
  // returns an HTML permission page, not image bytes). `handled` guarantees a
  // single reaction across all tiles: on the first failure we auto-share once,
  // then re-render with a cache-bust so the now-public thumbnails load. The
  // re-render passes allowAutoShare:false so a still-broken tile can't loop.
  let handled = false;
  // Always cache-bust the thumbnail URL. Google's image CDN can serve a stale
  // "public" copy of a now-private file, which would mask the failure and skip
  // auto-publish. A fresh query string each load reflects the real sharing state.
  const cacheBust = `&t=${Date.now()}`;

  images.forEach((item) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'admin-cover-thumb';
    thumb.dataset.id = item.id;
    thumb.setAttribute('aria-label', 'Use this photo as cover');

    const img = document.createElement('img');
    img.src = `https://drive.google.com/thumbnail?id=${item.id}&sz=w200${cacheBust}`;
    img.alt = item.description || '';
    img.loading = 'lazy';

    img.addEventListener('error', async () => {
      if (handled) return;
      handled = true;
      if (allowAutoShare) {
        try {
          await ensureAlbumPublic(folderId);
          loadCoverChoices(folderId, { allowAutoShare: false });
        } catch (err) {
          setStatus('Error: ' + err.message, 'error');
          showCoverNote(grid, 'Could not publish photos — check your token, then click Refresh.');
        }
      } else {
        showCoverNote(grid, 'Some photos could not be shown. Click Refresh to try again.');
      }
    });

    thumb.appendChild(img);

    thumb.addEventListener('click', () => {
      selectedCoverId = item.id;
      grid.querySelectorAll('.admin-cover-thumb').forEach((t) =>
        t.classList.toggle('selected', t.dataset.id === item.id)
      );
    });

    grid.appendChild(thumb);
  });
}

function readEditorFields() {
  const latRaw = document.getElementById('edit-lat').value;
  const lngRaw = document.getElementById('edit-lng').value;
  return {
    title: document.getElementById('edit-title').value.trim(),
    type: document.getElementById('edit-type').value === 'event' ? 'event' : 'travel',
    date: document.getElementById('edit-date').value.trim(),
    description: document.getElementById('edit-description').value.trim(),
    lat: latRaw === '' ? '' : parseFloat(latRaw),
    lng: lngRaw === '' ? '' : parseFloat(lngRaw),
    coverId: selectedCoverId,
  };
}

async function handleSave() {
  const fields = readEditorFields();
  if (!fields.title) {
    setStatus('Please enter a title.', 'error');
    return;
  }

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;

  try {
    if (mode === 'new') {
      setStatus('Creating album…');
      const result = await adminPost('createAlbum', fields);
      setStatus(`Created "${fields.title}". Now add photos in Drive.`, 'success');

      // Switch to editing the new album and show the Drive link.
      current = {
        id: result.id,
        folderId: result.folderId,
        title: fields.title,
        type: fields.type,
        date: fields.date,
        description: fields.description,
        lat: fields.lat === '' ? DEFAULT_LAT : fields.lat,
        lng: fields.lng === '' ? DEFAULT_LNG : fields.lng,
      };
      mode = 'edit';
      document.getElementById('editor-heading').textContent = 'Edit album';
      document.getElementById('save-btn').textContent = 'Save';
      document.getElementById('cover-field').hidden = false;
      const help = document.getElementById('new-album-help');
      help.hidden = false;
      document.getElementById('open-drive-link').href =
        `https://drive.google.com/drive/folders/${result.folderId}`;
      setDriveLink(result.folderId);
    } else {
      setStatus('Saving…');
      if (current && fields.title !== current.title) {
        await adminPost('rename', { folderId: current.folderId, title: fields.title });
      }
      await adminPost('setMeta', {
        folderId: current.folderId,
        lat: fields.lat,
        lng: fields.lng,
        date: fields.date,
        description: fields.description,
        coverId: fields.coverId || undefined,
        type: fields.type,
      });
      setStatus(`Saved "${fields.title}".`, 'success');
    }

    await refresh();
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

async function handleMakeAllPublic() {
  try {
    setStatus('Making all albums public…');
    const result = await adminPost('makeAllPublic', {});
    setStatus(`Done — ${result.foldersUpdated} albums set to public.`, 'success');
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  }
}

async function refresh() {
  try {
    albums = await loadAlbumsFresh();
    renderAlbumList();
  } catch (err) {
    setStatus('Could not load albums: ' + err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Wire up
// ---------------------------------------------------------------------------

function init() {
  const tokenInput = document.getElementById('admin-token');
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) tokenInput.value = savedToken;
  tokenInput.addEventListener('change', () => {
    localStorage.setItem(TOKEN_KEY, getToken());
  });

  document.getElementById('refresh-btn').addEventListener('click', refresh);
  document.getElementById('make-all-public-btn').addEventListener('click', handleMakeAllPublic);
  document.getElementById('new-album-btn').addEventListener('click', startNewAlbum);
  document.getElementById('save-btn').addEventListener('click', handleSave);
  document.getElementById('cancel-btn').addEventListener('click', closeEditor);
  document.getElementById('back-to-list-btn').addEventListener('click', closeEditor);
  document.getElementById('edit-lat').addEventListener('change', syncMarkerFromInputs);
  document.getElementById('edit-lng').addEventListener('change', syncMarkerFromInputs);

  document.getElementById('place-search-btn').addEventListener('click', handlePlaceSearch);
  document.getElementById('place-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePlaceSearch();
    }
  });

  // Cache-then-network: paint the cached album list immediately (admin pages
  // otherwise block ~6-8s on the slow Apps Script list call), then refresh in
  // the background and swap in fresh data when it arrives.
  const cachedAlbums = getCachedAlbums();
  if (cachedAlbums) {
    albums = cachedAlbums;
    renderAlbumList();
  }
  refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
