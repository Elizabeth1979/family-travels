import { fetchAlbums } from './utils.js';
import {
    getMapPreference,
    saveMapPreference,
    loadLeaflet,
    loadMarkerCluster,
    createLeafletMapOptions,
    getLeafletLayers,
    MAP_PROVIDERS
} from './mapUtils.js';

// Main map page JavaScript
let map;
let albums = [];
let markers = [];
let clusterGroup = null;

// Tile layers for the zoom-based detail swap (see setupZoomDetailSwap). The
// NatGeo overview map the owner likes has no street-level tiles, so once the
// user zooms in we hand off to OpenStreetMap and swap back when they zoom out.
let baseMaps = null;            // themed overview base layers, shared with the theme toggle
let overviewLayer = null;       // overview layer shown when zoomed out (NatGeo in light mode)
let detailLayer = null;         // OpenStreetMap street layer shown when zoomed in
let detailActive = false;       // true while the OSM detail layer is showing
let manualBaseOverride = false; // user picked a base map from the top-right layer control
const DETAIL_ZOOM = 14;         // map zoom at/after which we hand off to the street map
let currentMapType = 'accessible'; // 'accessible' (Leaflet 2D map) or 'gallery' (3D Gallery)
let currentFilter = 'all'; // 'all' | 'travel' | 'event'

// Albums matching the active travel/event filter. Type defaults to 'travel'.
function getFilteredAlbums() {
    if (currentFilter === 'all') return albums;
    return albums.filter(a => (a.type || 'travel') === currentFilter);
}
const mapState = {
    center: { lat: 20, lng: 0 },
    zoom: 2
};

// Helper to wait for global functions
const waitForGlobal = async (name, timeout = 5000) => {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        if (window[name]) {
            resolve(window[name]);
            return;
        }
        const interval = setInterval(() => {
            if (window[name]) {
                clearInterval(interval);
                resolve(window[name]);
            } else if (Date.now() - start > timeout) {
                clearInterval(interval);
                reject(new Error(`Timed out waiting for ${name}`));
            }
        }, 50);
    });
};

// Initialize the map/gallery based on user preference
async function initMap() {
    // Get user preference
    currentMapType = getMapPreference() || 'accessible';
    // Normalize old preferences to new options
    if (currentMapType === 'globe' || currentMapType === 'enhanced') {
        currentMapType = 'gallery'; // Old globe users get gallery
    }

    // Update toggle UI to match preference
    updateToggleUI(currentMapType);

    try {
        if (currentMapType === 'gallery') {
            document.body.classList.add('gallery-view');
            await initGalleryView();
        } else {
            document.body.classList.remove('gallery-view');
            await initLeafletMap();
        }
    } catch (error) {
        console.error('Failed to initialize preferred view, falling back to map:', error);
        currentMapType = 'accessible';
        await initLeafletMap();
    }

    // Try to show pins from cache immediately
    const cachedAlbums = getCachedAlbums();
    if (cachedAlbums && cachedAlbums.length > 0) {
        albums = cachedAlbums;
        populateAlbumList();
        if (currentMapType === 'accessible') {
            renderMarkers();
        } else if (currentMapType === 'gallery') {
            // Render gallery from cache immediately
            waitForGlobal('mountGallery').then(() => {
                window.mountGallery('map', getFilteredAlbums());
                hideLoading();
            }).catch(console.warn);
        }
    }

    // Then fetch fresh data in background
    loadAlbumsAndMarkers();
}

// Initialize 3D Gallery view
async function initGalleryView() {
    showLoading('Loading Gallery...');

    // Gallery is mounted via React when albums are loaded
    // Just ensure the container is ready
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = ''; // Clear any existing content
    }
}

// Initialize Leaflet (Accessible) map
async function initLeafletMap() {
    console.log('Initializing Leaflet map');

    // Load Leaflet if not already loaded
    await loadLeaflet();

    if (typeof L === 'undefined') {
        throw new Error('Leaflet failed to load');
    }

    // Load the marker clustering plugin (falls back to plain markers if it fails)
    await loadMarkerCluster();

    // Create map with Leaflet
    const options = createLeafletMapOptions({
        center: [mapState.center.lat, mapState.center.lng],
        zoom: mapState.zoom,
        zoomControl: false // Disable default zoom control
    });

    map = L.map('map', options);

    // Get configured layers. Kept at module scope so the theme toggle and the
    // zoom-based detail swap reuse the same tile-layer instances.
    const layers = getLeafletLayers();
    baseMaps = layers.baseMaps;

    // Add Layer Control
    L.control.layers(baseMaps, layers.overlayMaps, { position: 'topright' }).addTo(map);

    // Determine initial overview layer based on theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    overviewLayer = currentTheme === 'dark' ? baseMaps[MAP_PROVIDERS.dark.name] : baseMaps[MAP_PROVIDERS.light.name];

    // Add base layer
    overviewLayer.addTo(map);

    // Add zoom control (topleft, will be pushed down by CSS)
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Hand off to OpenStreetMap when zoomed in past where NatGeo runs out.
    setupZoomDetailSwap();

    console.log('Leaflet map initialized successfully');

    // Fix sizing issue on mobile reload - recalculate size after CSS is applied
    setTimeout(() => {
        map.invalidateSize();
    }, 100);

    // Render markers immediately
    if (albums.length > 0) {
        renderMarkers();
    }
}

// Get albums from localStorage cache
function getCachedAlbums() {
    const CACHE_KEY = 'family_travel_albums';
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data } = JSON.parse(cached);
            // Return cached data even if expired - we'll refresh in background
            return data;
        }
    } catch (e) {
        console.warn('Failed to read cached albums:', e);
    }
    return null;
}

async function loadAlbumsAndMarkers() {
    try {
        // Show loading state if in gallery mode as it might take a moment
        if (currentMapType === 'gallery') {
            showLoading('Loading albums...');
        }

        albums = await fetchAlbums();
        populateAlbumList();

        // Render appropriate view based on current mode
        if (currentMapType === 'gallery') {
            try {
                await waitForGlobal('mountGallery');
                window.mountGallery('map', getFilteredAlbums());
                hideLoading();
            } catch (e) {
                console.error('Gallery failed to mount:', e);
                // Fallback to map if gallery fails
                currentMapType = 'accessible';
                await initLeafletMap();
                renderMarkers();
                hideLoading();
            }
        } else {
            renderMarkers();
            hideLoading();
        }
    } catch (error) {
        console.error('Error loading albums:', error);
        document.getElementById('album-list-items').innerHTML =
            '<li class="error">Failed to load albums. Please try again later.</li>';
        hideLoading();

        // If we were trying to show gallery and failed, show error on map too/fallback
        if (currentMapType === 'gallery') {
            // Maybe switch to map or show explicit error? 
            // For now, let's try fallback to map so user sees something
            try {
                currentMapType = 'accessible';
                await initLeafletMap();
            } catch (e) { /* ignore */ }
        }
    }
}


function renderMarkers() {
    if (!map) return;

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];
    if (clusterGroup) {
        clusterGroup.clearLayers();
    }

    renderLeafletMarkers();
}

// Group albums whose coordinates are within ~85m of each other into one place,
// so repeat visits to the same spot collapse into a single pin.
const PLACE_EPS = 0.0008;
function groupAlbumsByLocation(list) {
    const groups = [];
    list.forEach(album => {
        if (typeof album.lat !== 'number' || typeof album.lng !== 'number') return;
        let group = groups.find(g =>
            Math.abs(g.lat - album.lat) < PLACE_EPS && Math.abs(g.lng - album.lng) < PLACE_EPS
        );
        if (!group) {
            group = { lat: album.lat, lng: album.lng, albums: [] };
            groups.push(group);
        }
        group.albums.push(album);
    });
    return groups;
}

// Sort albums chronologically; entries with unparseable dates fall to the end.
function sortAlbumsByDate(list) {
    return [...list].sort((a, b) => {
        const ta = Date.parse(a.date);
        const tb = Date.parse(b.date);
        const aValid = !isNaN(ta);
        const bValid = !isNaN(tb);
        if (aValid && bValid) return ta - tb;
        if (aValid) return -1;
        if (bValid) return 1;
        return (a.title || '').localeCompare(b.title || '');
    });
}

// Popup listing every trip taken at one location, sorted by date.
function createMultiAlbumPopup(albumsAtPlace) {
    const sorted = sortAlbumsByDate(albumsAtPlace);

    const div = document.createElement('div');
    div.className = 'popup-content popup-multi';

    const allEvents = sorted.every(a => (a.type || 'travel') === 'event');
    const allTravels = sorted.every(a => (a.type || 'travel') === 'travel');
    const noun = allEvents ? 'events' : allTravels ? 'trips' : 'albums';

    const title = document.createElement('h3');
    title.className = 'popup-title';
    title.textContent = `${sorted.length} ${noun} here`;
    div.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'popup-trip-list';

    sorted.forEach(album => {
        const li = document.createElement('li');

        const link = document.createElement('a');
        link.href = `album.html?id=${album.id}`;
        link.className = 'popup-trip-link';
        link.addEventListener('click', () => {
            sessionStorage.setItem('currentAlbum', JSON.stringify(album));
        });

        if (album.cover) {
            const img = document.createElement('img');
            img.src = album.cover;
            img.alt = '';
            img.className = 'popup-trip-thumb';
            img.loading = 'lazy';
            link.appendChild(img);
        }

        const text = document.createElement('span');
        text.className = 'popup-trip-text';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'popup-trip-title';
        titleSpan.textContent = album.title;
        text.appendChild(titleSpan);

        if (album.date) {
            const dateSpan = document.createElement('span');
            dateSpan.className = 'popup-trip-date';
            dateSpan.textContent = album.date;
            text.appendChild(dateSpan);
        }

        link.appendChild(text);
        li.appendChild(link);
        list.appendChild(li);
    });

    div.appendChild(list);
    return div;
}

// Hover-to-open popup + keyboard support, shared by single and grouped markers.
function attachMarkerBehavior(marker, ariaLabel) {
    let isOver = false;
    let closeTimeout = null;

    const scheduleClose = () => {
        closeTimeout = setTimeout(() => {
            if (!isOver) marker.closePopup();
        }, 300);
    };
    const cancelClose = () => {
        if (closeTimeout) {
            clearTimeout(closeTimeout);
            closeTimeout = null;
        }
    };

    marker.on('mouseover', function () {
        isOver = true;
        cancelClose();
        this.openPopup();
    });
    marker.on('mouseout', function () {
        isOver = false;
        scheduleClose();
    });
    marker.on('popupopen', function (e) {
        const popupEl = e.popup.getElement();
        if (popupEl) {
            popupEl.addEventListener('mouseenter', () => { isOver = true; cancelClose(); });
            popupEl.addEventListener('mouseleave', () => { isOver = false; scheduleClose(); });
        }
    });

    // Marker DOM element only exists once it is actually placed (not in a cluster)
    marker.on('add', () => {
        const el = marker.getElement();
        if (!el) return;
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', ariaLabel);
        el.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                marker.openPopup();
                setTimeout(() => {
                    const popupEl = marker.getPopup().getElement();
                    const focusable = popupEl && popupEl.querySelector('.open-album-btn, .popup-trip-link');
                    if (focusable) focusable.focus();
                }, 100);
            }
        });
    });
}

// Distinct marker for family-event albums (vs the default Leaflet pin for travels).
function createEventIcon() {
    return L.divIcon({
        className: 'event-marker',
        html: '<span class="event-marker-pin" aria-hidden="true"></span>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -28]
    });
}

// Render markers for Leaflet, grouping repeat visits and clustering nearby pins
function renderLeafletMarkers() {
    const useCluster = typeof L.markerClusterGroup === 'function';

    let layer = null;
    if (useCluster) {
        if (!clusterGroup) {
            clusterGroup = L.markerClusterGroup({
                maxClusterRadius: 45,
                showCoverageOnHover: false,
                spiderfyOnMaxZoom: true
            });
            map.addLayer(clusterGroup);
        }
        layer = clusterGroup;
    }

    const groups = groupAlbumsByLocation(getFilteredAlbums());

    groups.forEach(group => {
        const isMulti = group.albums.length > 1;
        const isEventGroup = group.albums.every(a => (a.type || 'travel') === 'event');
        const popupContent = isMulti
            ? createMultiAlbumPopup(group.albums)
            : createPopupContent(group.albums[0]);
        const ariaLabel = isMulti
            ? `${group.albums.length} albums at this location`
            : `View ${group.albums[0].title} album`;

        const marker = L.marker([group.lat, group.lng], isEventGroup ? { icon: createEventIcon() } : undefined)
            .bindPopup(popupContent, { autoClose: false, closeOnClick: false });

        attachMarkerBehavior(marker, ariaLabel);

        // A pin only ever opens its popup preview — never navigates directly.
        // Hover opens it (attachMarkerBehavior) and click opens it (Leaflet's
        // built-in bindPopup handler), on both desktop and touch. Navigation to
        // the album happens only via the "Open Album" button inside the popup.

        if (layer) {
            layer.addLayer(marker);
        } else {
            marker.addTo(map);
        }

        markers.push(marker);
    });

    // Open framed on the densest area (so a lone faraway pin doesn't force a
    // zoomed-out, letterboxed world view). Users can still pinch-zoom out fully.
    const focus = computeFocusBounds(groups);
    if (focus && focus.isValid()) {
        map.fitBounds(focus, { padding: [40, 40], maxZoom: 9 });
    }
}

// Pick the bounds of the largest group of nearby places to frame on load.
function computeFocusBounds(groups) {
    if (!groups || groups.length === 0) return null;
    const RADIUS_M = 800000; // ~800 km: places this close count as one "area"
    let bestCluster = [groups[0]];
    groups.forEach(g => {
        const here = L.latLng(g.lat, g.lng);
        const cluster = groups.filter(o => here.distanceTo(L.latLng(o.lat, o.lng)) <= RADIUS_M);
        if (cluster.length > bestCluster.length) bestCluster = cluster;
    });
    return L.latLngBounds(bestCluster.map(g => [g.lat, g.lng]));
}

// Create popup content with cover image and link
function createPopupContent(album) {
    const div = document.createElement('div');
    div.className = 'popup-content';

    if (album.cover) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'popup-image-container';

        const img = document.createElement('img');
        img.src = album.cover;
        img.alt = `Cover photo for ${album.title}`;
        img.className = 'popup-cover';

        imgContainer.appendChild(img);
        div.appendChild(imgContainer);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'popup-text-content';

    const title = document.createElement('h3');
    title.textContent = album.title;
    title.className = 'popup-title';
    contentDiv.appendChild(title);

    const button = document.createElement('a');
    button.href = `album.html?id=${album.id}`;
    button.textContent = 'Open Album';
    button.className = 'open-album-btn';

    // Store album data for instant loading on album page
    button.addEventListener('click', () => {
        sessionStorage.setItem('currentAlbum', JSON.stringify(album));
    });

    contentDiv.appendChild(button);
    div.appendChild(contentDiv);

    return div;
}

// Populate the album list sidebar
function populateAlbumList() {
    const listContainer = document.getElementById('album-list-items');
    listContainer.innerHTML = '';

    getFilteredAlbums().forEach(album => {
        const li = document.createElement('li');

        const link = document.createElement('a');
        link.href = `album.html?id=${album.id}`;
        link.className = 'album-list-item';

        // Store album data for instant loading on album page
        link.addEventListener('click', () => {
            sessionStorage.setItem('currentAlbum', JSON.stringify(album));
        });

        const title = document.createElement('div');
        title.textContent = album.title;
        title.style.fontWeight = '600';
        link.appendChild(title);

        li.appendChild(link);
        listContainer.appendChild(li);
    });
}

// Toggle menu functionality
function initMenuToggle() {
    const menuToggle = document.getElementById('menu-toggle');
    const menuClose = document.getElementById('menu-close');
    const albumMenu = document.getElementById('album-menu');

    if (menuToggle && albumMenu) {
        const setMenuOpen = (open) => {
            albumMenu.classList.toggle('open', open);
            menuToggle.classList.toggle('active', open);
            menuToggle.setAttribute('aria-expanded', String(open));
            // Hide the layout toggle while the list is open so it doesn't cover entries.
            document.body.classList.toggle('menu-open', open);
        };

        // Open / close menu
        menuToggle.addEventListener('click', () => {
            setMenuOpen(!albumMenu.classList.contains('open'));
        });

        // Close menu with close button
        if (menuClose) {
            menuClose.addEventListener('click', (e) => {
                e.stopPropagation();
                setMenuOpen(false);
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!albumMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                setMenuOpen(false);
            }
        });
    }
}


// Swap the NatGeo overview map for OpenStreetMap when the user zooms in past
// where NatGeo runs out of tiles, and swap back when they zoom out. This reacts
// to *map* zoom (the +/- buttons, scroll, pinch), not browser page zoom. Only
// the light/NatGeo overview needs it; dark mode already uses satellite imagery
// that has detail at high zoom.
function setupZoomDetailSwap() {
    // OSM street layer, created once and reused.
    detailLayer = L.tileLayer(MAP_PROVIDERS.osm.url, MAP_PROVIDERS.osm.options);

    map.on('zoomend', updateDetailLayer);

    // If the user picks a base map from the top-right layer control, respect it
    // and pause auto-swapping. Choosing the themed default again re-enables it.
    map.on('baselayerchange', (e) => {
        overviewLayer = e.layer;
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const themedDefault = theme === 'dark'
            ? baseMaps[MAP_PROVIDERS.dark.name]
            : baseMaps[MAP_PROVIDERS.light.name];
        manualBaseOverride = e.layer !== themedDefault;

        if (manualBaseOverride) {
            // Get OSM out of the way so the user's chosen base map shows.
            if (detailActive) {
                map.removeLayer(detailLayer);
                detailActive = false;
            }
        } else {
            updateDetailLayer();
        }
    });

    updateDetailLayer();
}

// Decide whether the OSM detail layer or the overview layer should be showing,
// based on the current zoom. No-op while the user has a manual base map chosen.
function updateDetailLayer() {
    if (!map || !detailLayer || manualBaseOverride) return;

    // Only the NatGeo overview lacks street tiles. If a different overview is
    // active (e.g. dark-mode satellite), make sure we're not stuck on detail.
    const overviewIsNatGeo = overviewLayer === baseMaps[MAP_PROVIDERS.light.name];
    if (!overviewIsNatGeo) {
        if (detailActive) deactivateDetail();
        return;
    }

    const wantDetail = map.getZoom() >= DETAIL_ZOOM;
    if (wantDetail && !detailActive) {
        activateDetail();
    } else if (!wantDetail && detailActive) {
        deactivateDetail();
    }
}

function activateDetail() {
    detailLayer.addTo(map);        // add OSM first so there's no grey flash
    map.removeLayer(overviewLayer);
    detailActive = true;
}

function deactivateDetail() {
    overviewLayer.addTo(map);
    map.removeLayer(detailLayer);
    detailActive = false;
}

// Update map theme dynamically
window.updateMapTheme = function (theme) {
    console.log('Updating map theme to:', theme);

    if (!map || typeof L === 'undefined' || !baseMaps) return;

    // Remove whatever base/detail tiles are currently showing (leave any
    // user-enabled overlay like place labels alone).
    if (overviewLayer && map.hasLayer(overviewLayer)) map.removeLayer(overviewLayer);
    if (detailLayer && map.hasLayer(detailLayer)) map.removeLayer(detailLayer);
    detailActive = false;

    // A theme switch resets any manual base-map choice back to the themed default.
    manualBaseOverride = false;
    overviewLayer = theme === 'dark' ? baseMaps[MAP_PROVIDERS.dark.name] : baseMaps[MAP_PROVIDERS.light.name];
    overviewLayer.addTo(map);

    // Re-apply the zoom-based detail swap for the new overview layer.
    updateDetailLayer();

    // Re-render markers to ensure they are on top
    if (albums.length > 0) {
        renderMarkers();
    }
};


// Save current map state before destroying
function saveCurrentMapState() {
    if (!map || typeof L === 'undefined') return;

    try {
        const center = map.getCenter();
        mapState.center = { lat: center.lat, lng: center.lng };
        mapState.zoom = map.getZoom();
    } catch (error) {
        console.warn('Failed to save map state:', error);
    }
}

// Destroy current map instance
function destroyCurrentMap() {
    if (!map) return;

    try {
        // Clear markers first
        markers.forEach(marker => marker.remove());
        markers = [];
        if (clusterGroup) {
            clusterGroup.clearLayers();
            map.removeLayer(clusterGroup);
            clusterGroup = null;
        }

        // Remove map
        map.remove();
        map = null;
    } catch (error) {
        console.warn('Failed to destroy map:', error);
    }
}


// Show loading indicator
function showLoading(message = 'Loading map...') {
    const loading = document.getElementById('map-loading');
    const loadingText = loading.querySelector('.loading-text');

    if (loadingText) {
        loadingText.textContent = message;
    }

    loading.classList.remove('hidden');
}

// Hide loading indicator
function hideLoading() {
    const loading = document.getElementById('map-loading');
    loading.classList.add('hidden');
}

// Announce to screen readers
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

// Switch between map types (2D Map vs 3D Gallery)
async function switchMapType(newType) {
    if (newType === currentMapType) return; // Already using this type

    console.log('Switching view from', currentMapType, 'to', newType);

    // Show loading indicator
    showLoading('Switching view...');

    // Save current map state if switching from map
    if (currentMapType === 'accessible') {
        saveCurrentMapState();
        destroyCurrentMap();
    }

    // Update current type
    currentMapType = newType;
    saveMapPreference(newType);

    // Initialize new view
    try {
        if (newType === 'gallery') {
            document.body.classList.add('gallery-view');
            await initGalleryView();
            // Mount the React gallery
            if (albums.length > 0 && typeof window.mountGallery === 'function') {
                window.mountGallery('map', getFilteredAlbums());
            }
        } else {
            document.body.classList.remove('gallery-view');
            // Clear the gallery content
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.innerHTML = '';
            }
            await initLeafletMap();
            // Render markers
            if (albums.length > 0) {
                renderMarkers();
            }
        }

        // Update toggle UI
        updateToggleUI(newType);

        // Announce to screen readers
        const viewName = newType === 'gallery' ? '3D Gallery' : '2D Map';
        announceToScreenReader(`Now viewing ${viewName}`);

        hideLoading();
    } catch (error) {
        console.error('Failed to switch view type:', error);
        hideLoading();
        alert('Failed to switch view. Please try again.');
    }
}

// Update toggle UI to reflect current view type
function updateToggleUI(mapType) {
    const buttons = document.querySelectorAll('.map-type-btn');
    buttons.forEach(btn => {
        const btnType = btn.getAttribute('data-map-type');
        const isActive = btnType === mapType;

        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive.toString());
    });

    // Also update React toggle if it exists
    if (window.setMapToggleValue) {
        window.setMapToggleValue(mapType);
    }
}

// Initialize map type toggle
function initMapTypeToggle() {
    // Mount React MapTypeToggle component
    waitForGlobal('mountMapToggle').then(() => {
        window.mountMapToggle('map-type-toggle', currentMapType, (newType) => {
            switchMapType(newType);
        });
    }).catch(error => {
        console.error('Failed to load map toggle:', error);
    });
}

// Travel/event filter buttons in the album sidebar.
function initAlbumFilter() {
    const buttons = document.querySelectorAll('.album-filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.getAttribute('data-filter') || 'all';
            if (filter === currentFilter) return;
            currentFilter = filter;
            buttons.forEach(b => {
                const active = b === btn;
                b.classList.toggle('active', active);
                b.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            applyAlbumFilter();
        });
    });
}

// Re-render the active view (map markers or 3D gallery) and the sidebar list
// for the current filter.
function applyAlbumFilter() {
    populateAlbumList();
    if (currentMapType === 'gallery') {
        if (typeof window.mountGallery === 'function') {
            window.mountGallery('map', getFilteredAlbums());
        }
    } else {
        renderMarkers();
    }
}

// Initialize map when page loads
const init = () => {
    initMap();
    initMenuToggle();
    initMapTypeToggle();
    initAlbumFilter();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
