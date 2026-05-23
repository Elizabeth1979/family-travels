import { CONFIG } from './config.js';
import { loadLeaflet, createTileLayer, createLeafletMapOptions } from './mapUtils.js';

// Default coordinates used by the Apps Script when an album has no location.
// We use them to flag albums that still need a pin placed.
const DEFAULT_LAT = 31.7683;
const DEFAULT_LNG = 35.2137;

const TOKEN_KEY = 'admin_token';

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

function setStatus(message, kind = 'info') {
  const el = document.getElementById('admin-status');
  el.textContent = message;
  el.dataset.kind = kind;
}

// ---------------------------------------------------------------------------
// Album list
// ---------------------------------------------------------------------------

async function loadAlbumsFresh() {
  // Bypass the 5-minute cache used by the public site so the admin sees changes.
  const response = await fetch(
    `${CONFIG.APPS_SCRIPT_URL}?action=list&master=${CONFIG.MASTER_FOLDER_ID}&t=${Date.now()}`
  );
  if (!response.ok) throw new Error(`Failed to load albums: ${response.status}`);
  const data = await response.json();
  if (data && data.error) throw new Error(data.error);
  return Array.isArray(data) ? data : [];
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

function showEditor() {
  document.getElementById('admin-editor').hidden = false;
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
  document.getElementById('sharing-row').hidden = false;
  document.getElementById('sharing-status').textContent =
    'Use the button if family report they cannot open this album.';

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
  document.getElementById('sharing-row').hidden = true; // auto-shared on create
  document.getElementById('admin-cover-grid').innerHTML = '';

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
      createTileLayer('light').addTo(pinMap);

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

async function loadCoverChoices(folderId) {
  const grid = document.getElementById('admin-cover-grid');
  grid.innerHTML = '';
  if (!folderId) return;

  try {
    const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?folder=${folderId}&t=${Date.now()}`);
    const data = await response.json();
    const images = (data.items || []).filter(
      (item) => item.size > 0 && item.mime && item.mime.startsWith('image/')
    );

    if (images.length === 0) {
      const note = document.createElement('p');
      note.className = 'admin-hint';
      note.textContent = 'No photos in this folder yet.';
      grid.appendChild(note);
      return;
    }

    images.forEach((item) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'admin-cover-thumb';
      thumb.dataset.id = item.id;
      thumb.setAttribute('aria-label', 'Use this photo as cover');

      const img = document.createElement('img');
      img.src = `https://drive.google.com/thumbnail?id=${item.id}&sz=w200`;
      img.alt = item.description || '';
      img.loading = 'lazy';
      thumb.appendChild(img);

      thumb.addEventListener('click', () => {
        selectedCoverId = item.id;
        grid.querySelectorAll('.admin-cover-thumb').forEach((t) =>
          t.classList.toggle('selected', t.dataset.id === item.id)
        );
      });

      grid.appendChild(thumb);
    });
  } catch (err) {
    const note = document.createElement('p');
    note.className = 'admin-hint';
    note.textContent = 'Could not load photos: ' + err.message;
    grid.appendChild(note);
  }
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
      document.getElementById('sharing-row').hidden = false;
      const help = document.getElementById('new-album-help');
      help.hidden = false;
      document.getElementById('open-drive-link').href =
        `https://drive.google.com/drive/folders/${result.folderId}`;
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

async function handleMakePublic() {
  if (!current) return;
  try {
    setStatus('Updating sharing…');
    const result = await adminPost('setSharing', { folderId: current.folderId, public: true });
    setStatus(`Album is public (${result.filesUpdated} photos updated).`, 'success');
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
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
  document.getElementById('make-public-btn').addEventListener('click', handleMakePublic);
  document.getElementById('cancel-btn').addEventListener('click', () => {
    document.getElementById('admin-editor').hidden = true;
  });
  document.getElementById('edit-lat').addEventListener('change', syncMarkerFromInputs);
  document.getElementById('edit-lng').addEventListener('change', syncMarkerFromInputs);

  document.getElementById('place-search-btn').addEventListener('click', handlePlaceSearch);
  document.getElementById('place-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePlaceSearch();
    }
  });

  refresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
