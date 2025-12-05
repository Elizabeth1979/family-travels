// Main map page JavaScript
let map;
let albums = [];
let markers = [];
let currentMapType = 'globe'; // 'globe' (Globe.GL), 'enhanced' (MapLibre), or 'accessible' (Leaflet)
let mapState = {
    center: { lat: 20, lng: 0 },
    zoom: 2
};

// Initialize the map container immediately while album data loads in background
async function initMap() {
    if (map) return; // Already initialized

    // Get user preference
    currentMapType = getMapPreference();
    console.log('Initializing map with type:', currentMapType);

    // Update toggle UI to match preference
    updateToggleUI(currentMapType);

    try {
        if (currentMapType === 'globe') {
            await initGlobeMap();
        } else if (currentMapType === 'accessible') {
            await initLeafletMap();
        } else {
            await initMapLibreMap();
        }
    } catch (error) {
        console.error('Failed to initialize preferred map, falling back:', error);
        // Fallback to Leaflet if Globe or MapLibre fails
        if (currentMapType === 'globe' || currentMapType === 'enhanced') {
            currentMapType = 'accessible';
            await initLeafletMap();
        }
    }

    // Try to show pins from cache immediately
    const cachedAlbums = getCachedAlbums();
    if (cachedAlbums && cachedAlbums.length > 0) {
        albums = cachedAlbums;
        populateAlbumList();
        renderMarkers();
    }

    // Then fetch fresh data in background
    loadAlbumsAndMarkers();
}

// Initialize MapLibre GL (3D Enhanced) map
async function initMapLibreMap() {
    console.log('Initializing MapLibre GL map');

    if (typeof maplibregl === 'undefined') {
        throw new Error('MapLibre GL not loaded');
    }

    const options = createMapLibreOptions();
    console.log('MapLibre options:', options);

    map = new maplibregl.Map(options);
    console.log('MapLibre map instance created:', map);

    // Add navigation controls (zoom, rotation, pitch)
    map.addControl(new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true
    }), 'top-right');

    // Note: MapStyleControl removed - using map type toggle instead
    // All demo tiles point to same style anyway

    // Wait for map to load before adding features
    map.on('load', () => {
        console.log('MapLibre map loaded successfully');

        // Enable 3D terrain by default (may not work with demo tiles)
        try {
            if (map.getSource('terrain')) {
                map.setTerrain({
                    source: 'terrain',
                    exaggeration: 2.0
                });
                console.log('3D terrain enabled');
            }
        } catch (error) {
            console.log('Terrain not available with current style');
        }

        // Render markers after a short delay
        setTimeout(() => {
            if (albums.length > 0) {
                renderMarkers();
            }
        }, 300);
    });
}

// Initialize Leaflet (Accessible) map
async function initLeafletMap() {
    console.log('Initializing Leaflet map');

    // Load Leaflet if not already loaded
    await loadLeaflet();

    if (typeof L === 'undefined') {
        throw new Error('Leaflet failed to load');
    }

    // Create map with Leaflet
    const options = createLeafletMapOptions({
        center: [mapState.center.lat, mapState.center.lng],
        zoom: mapState.zoom
    });

    map = L.map('map', options);

    // Add tile layer
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    createTileLayer(currentTheme).addTo(map);

    // Add zoom control
    L.control.zoom({ position: 'topright' }).addTo(map);

    console.log('Leaflet map initialized successfully');

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
        albums = await fetchAlbums();
        renderMarkers();
        populateAlbumList();
    } catch (error) {
        console.error('Error loading albums:', error);
        document.getElementById('album-list-items').innerHTML =
            '<li class="error">Failed to load albums. Please try again later.</li>';
    }
}

function renderMarkers() {
    if (currentMapType === 'globe') {
        // Globe uses its own rendering system
        renderGlobeMarkers();
    } else {
        if (!map) return;

        // Clear existing markers
        markers.forEach(marker => marker.remove());
        markers = [];

        if (currentMapType === 'enhanced') {
            renderMapLibreMarkers();
        } else {
            renderLeafletMarkers();
        }
    }
}

// Render markers for MapLibre GL
function renderMapLibreMarkers() {
    const bounds = new maplibregl.LngLatBounds();

    albums.forEach(album => {
        if (typeof album.lat !== 'number' || typeof album.lng !== 'number') {
            return;
        }

        // Create custom marker element
        const el = createMarkerElement('#FF6B6B');

        // Create popup content
        const popupContent = createPopupContent(album);

        // Create popup
        const popup = new maplibregl.Popup({
            offset: 25,
            maxWidth: '300px',
            className: 'custom-popup'
        }).setDOMContent(popupContent);

        // Create marker
        const marker = new maplibregl.Marker({
            element: el,
            anchor: 'bottom'
        })
            .setLngLat([album.lng, album.lat])
            .setPopup(popup)
            .addTo(map);

        markers.push(marker);
        bounds.extend([album.lng, album.lat]);
    });

    // Fit map to markers if any exist
    if (albums.length > 0) {
        map.fitBounds(bounds, {
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
            pitch: 40,
            bearing: 0,
            duration: 1500
        });
    }
}

// Render markers for Leaflet
function renderLeafletMarkers() {
    const bounds = L.latLngBounds();

    albums.forEach(album => {
        if (typeof album.lat !== 'number' || typeof album.lng !== 'number') {
            return;
        }

        // Create popup content
        const popupContent = createPopupContent(album);

        // Create marker
        const marker = L.marker([album.lat, album.lng])
            .bindPopup(popupContent)
            .addTo(map);

        markers.push(marker);
        bounds.extend([album.lat, album.lng]);
    });

    // Fit map to markers if any exist
    if (albums.length > 0) {
        map.fitBounds(bounds, {
            padding: [50, 50]
        });
    }
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

    if (album.date) {
        const date = document.createElement('p');
        date.textContent = album.date;
        date.className = 'popup-date';
        contentDiv.appendChild(date);
    }

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

    albums.forEach(album => {
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
        // Open menu
        menuToggle.addEventListener('click', () => {
            const isOpen = albumMenu.classList.toggle('open');
            menuToggle.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', isOpen);
        });

        // Close menu with close button
        if (menuClose) {
            menuClose.addEventListener('click', (e) => {
                e.stopPropagation();
                albumMenu.classList.remove('open');
                menuToggle.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!albumMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                albumMenu.classList.remove('open');
                menuToggle.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }
}

// Change map style dynamically
function changeMapStyle(styleType) {
    if (!map) return;

    console.log('Changing map style to:', styleType);

    // Get current map state
    const center = map.getCenter();
    const zoom = map.getZoom();
    const pitch = map.getPitch();
    const bearing = map.getBearing();

    // Update the style
    map.setStyle(createMapStyle(styleType));

    // Wait for style to load, then restore state and markers
    map.once('style.load', () => {
        console.log('New style loaded');

        // Re-enable terrain
        try {
            map.setTerrain({
                source: 'terrain',
                exaggeration: 2.0
            });
        } catch (error) {
            console.error('Failed to re-enable terrain:', error);
        }

        // Restore camera position
        map.jumpTo({
            center: center,
            zoom: zoom,
            pitch: pitch,
            bearing: bearing
        });

        // Re-render markers after a short delay
        setTimeout(() => {
            if (albums.length > 0) {
                renderMarkers();
            }
        }, 300);
    });
}

// Switch between map types (Enhanced vs Accessible)
async function switchMapType(newType) {
    if (newType === currentMapType) return; // Already using this type

    console.log('Switching map type from', currentMapType, 'to', newType);

    // Show loading indicator
    showLoading('Switching map...');

    // Save current map state
    saveCurrentMapState();

    // Destroy current map
    destroyCurrentMap();

    // Update current type
    currentMapType = newType;
    saveMapPreference(newType);

    // Initialize new map
    try {
        if (newType === 'globe') {
            await initGlobeMap();
        } else if (newType === 'accessible') {
            await initLeafletMap();
        } else {
            await initMapLibreMap();
        }

        // Render markers
        if (albums.length > 0) {
            renderMarkers();
        }

        // Update toggle UI
        updateToggleUI(newType);

        // Announce to screen readers
        const mapTypeName = newType === 'globe' ? '3D globe' :
            newType === 'accessible' ? 'accessible 2D map' :
                '3D enhanced map';
        announceToScreenReader(`Now viewing ${mapTypeName}`);

        hideLoading();
    } catch (error) {
        console.error('Failed to switch map type:', error);
        hideLoading();
        alert('Failed to switch map type. Please try again.');
    }
}

// Update map theme dynamically
window.updateMapTheme = function (theme) {
    console.log('Updating map theme to:', theme);

    if (!map) return;

    if (currentMapType === 'accessible' && typeof L !== 'undefined') {
        // Find existing tile layer and remove it
        map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });

        // Add new tile layer
        createTileLayer(theme).addTo(map);

        // Re-render markers to ensure they are on top
        // (optional, but good practice in Leaflet)
        if (markers.length > 0) {
            markers.forEach(marker => marker.remove());
            renderMarkers();
        }
    } else if (currentMapType === 'enhanced' && typeof maplibregl !== 'undefined') {
        // For standard MapLibre style, we can invert colors for dark mode using CSS filter on canvas
        const canvas = map.getCanvas();
        if (theme === 'dark') {
            canvas.style.filter = 'invert(100%) hue-rotate(180deg) contrast(90%)';
        } else {
            canvas.style.filter = 'none';
        }
    }
};

// Save current map state before destroying
function saveCurrentMapState() {
    if (currentMapType === 'globe') {
        // Globe doesn't need state saving for now
        // Could save camera position in future if needed
        return;
    }

    if (!map) return;

    try {
        if (currentMapType === 'enhanced' && typeof maplibregl !== 'undefined') {
            const center = map.getCenter();
            mapState.center = { lat: center.lat, lng: center.lng };
            mapState.zoom = map.getZoom();
        } else if (currentMapType === 'accessible' && typeof L !== 'undefined') {
            const center = map.getCenter();
            mapState.center = { lat: center.lat, lng: center.lng };
            mapState.zoom = map.getZoom();
        }
    } catch (error) {
        console.warn('Failed to save map state:', error);
    }
}

// Destroy current map instance
function destroyCurrentMap() {
    if (currentMapType === 'globe') {
        // Destroy globe using its own cleanup function
        if (typeof destroyGlobe === 'function') {
            destroyGlobe();
        }
        return;
    }

    if (!map) return;

    try {
        // Clear markers first
        markers.forEach(marker => marker.remove());
        markers = [];

        // Remove map
        map.remove();
        map = null;
    } catch (error) {
        console.warn('Failed to destroy map:', error);
    }
}

// Update toggle UI to reflect current map type
function updateToggleUI(mapType) {
    const buttons = document.querySelectorAll('.map-type-btn');
    buttons.forEach(btn => {
        const btnType = btn.getAttribute('data-map-type');
        const isActive = btnType === mapType;

        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive.toString());
    });
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

// Initialize map type toggle
function initMapTypeToggle() {
    const toggleButtons = document.querySelectorAll('.map-type-btn');

    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const newType = btn.getAttribute('data-map-type');
            switchMapType(newType);
        });

        // Keyboard accessibility
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const newType = btn.getAttribute('data-map-type');
                switchMapType(newType);
            }
        });
    });

    // Open album list button
    const openAlbumBtn = document.getElementById('open-album-list');
    if (openAlbumBtn) {
        openAlbumBtn.addEventListener('click', () => {
            const menuToggle = document.getElementById('menu-toggle');
            if (menuToggle) {
                menuToggle.click();
            }
        });
    }

    // Rotation toggle button for globe
    const rotationToggle = document.getElementById('rotation-toggle');
    if (rotationToggle) {
        rotationToggle.addEventListener('click', () => {
            if (typeof toggleGlobeRotation === 'function') {
                toggleGlobeRotation();
            }
        });
    }
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initMenuToggle();
    initMapTypeToggle();
});
