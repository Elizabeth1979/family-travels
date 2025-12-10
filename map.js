// Main map page JavaScript
let map;
let albums = [];
let markers = [];
let currentMapType = 'accessible'; // 'accessible' (Leaflet 2D map) or 'gallery' (3D Gallery)
let mapState = {
    center: { lat: 20, lng: 0 },
    zoom: 2
};

// Initialize the map/gallery based on user preference
async function initMap() {
    // Get user preference
    currentMapType = getMapPreference() || 'accessible';
    // Normalize old preferences to new options
    if (currentMapType === 'globe' || currentMapType === 'enhanced') {
        currentMapType = 'gallery'; // Old globe users get gallery
    }
    console.log('Initializing view with type:', currentMapType);

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
        }
    }

    // Then fetch fresh data in background
    loadAlbumsAndMarkers();
}

// Initialize 3D Gallery view
async function initGalleryView() {
    console.log('Initializing 3D Gallery');
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

    // Create map with Leaflet
    const options = createLeafletMapOptions({
        center: [mapState.center.lat, mapState.center.lng],
        zoom: mapState.zoom,
        zoomControl: false // Disable default zoom control
    });

    map = L.map('map', options);

    // Get configured layers
    const { baseMaps, overlayMaps } = getLeafletLayers();

    // Add Layer Control
    L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(map);

    // Determine initial layers based on theme
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const initialBaseLayer = currentTheme === 'dark' ? baseMaps[MAP_PROVIDERS.dark.name] : baseMaps[MAP_PROVIDERS.light.name];

    // Add base layer
    initialBaseLayer.addTo(map);

    // Add zoom control (topleft, will be pushed down by CSS)
    L.control.zoom({ position: 'topleft' }).addTo(map);

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
        albums = await fetchAlbums();
        populateAlbumList();

        // Render appropriate view based on current mode
        if (currentMapType === 'gallery') {
            if (typeof window.mountGallery === 'function') {
                window.mountGallery('map', albums);
            }
        } else {
            renderMarkers();
        }
    } catch (error) {
        console.error('Error loading albums:', error);
        document.getElementById('album-list-items').innerHTML =
            '<li class="error">Failed to load albums. Please try again later.</li>';
    }
}


function renderMarkers() {
    if (!map) return;

    // Clear existing markers
    markers.forEach(marker => marker.remove());
    markers = [];

    renderLeafletMarkers();
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

        // Create marker with popup that doesn't auto-close
        const marker = L.marker([album.lat, album.lng])
            .bindPopup(popupContent, {
                autoClose: false,
                closeOnClick: false
            })
            .addTo(map);

        // Track if mouse is over marker or popup
        let isOverMarkerOrPopup = false;
        let closeTimeout = null;

        const scheduleClose = () => {
            closeTimeout = setTimeout(() => {
                if (!isOverMarkerOrPopup) {
                    marker.closePopup();
                }
            }, 300);
        };

        const cancelClose = () => {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
            }
        };

        // Open on marker hover
        marker.on('mouseover', function (e) {
            isOverMarkerOrPopup = true;
            cancelClose();
            this.openPopup();
        });

        marker.on('mouseout', function (e) {
            isOverMarkerOrPopup = false;
            scheduleClose();
        });

        // Track popup hover to keep it open
        marker.on('popupopen', function (e) {
            const popupEl = e.popup.getElement();
            if (popupEl) {
                popupEl.addEventListener('mouseenter', () => {
                    isOverMarkerOrPopup = true;
                    cancelClose();
                });
                popupEl.addEventListener('mouseleave', () => {
                    isOverMarkerOrPopup = false;
                    scheduleClose();
                });

                // Focus the button inside popup for keyboard users
                setTimeout(() => {
                    const btn = popupEl.querySelector('.open-album-btn');
                    if (btn && document.activeElement !== btn) {
                        // Only auto-focus if opened via keyboard (check if marker element was focused)
                        const markerEl = marker.getElement();
                        if (markerEl && document.activeElement === markerEl) {
                            btn.focus();
                        }
                    }
                }, 100);
            }
        });

        // Add keyboard support for markers
        const markerEl = marker.getElement();
        if (markerEl) {
            markerEl.setAttribute('tabindex', '0');
            markerEl.setAttribute('role', 'button');
            markerEl.setAttribute('aria-label', `View ${album.title} album`);

            markerEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    marker.openPopup();

                    // Focus the button after popup opens
                    setTimeout(() => {
                        const popupEl = marker.getPopup().getElement();
                        if (popupEl) {
                            const btn = popupEl.querySelector('.open-album-btn');
                            if (btn) {
                                btn.focus();
                            }
                        }
                    }, 100);
                }
            });
        }

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


// Update map theme dynamically
window.updateMapTheme = function (theme) {
    console.log('Updating map theme to:', theme);

    if (!map || typeof L === 'undefined') return;

    // Get layers
    const { baseMaps } = getLeafletLayers();

    // Remove all current tile layers
    map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });

    // Add the theme-appropriate base layer
    const newBaseLayer = theme === 'dark' ? baseMaps[MAP_PROVIDERS.dark.name] : baseMaps[MAP_PROVIDERS.light.name];
    newBaseLayer.addTo(map);

    // Re-render markers to ensure they are on top
    if (markers.length > 0) {
        markers.forEach(marker => marker.remove());
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
                window.mountGallery('map', albums);
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
    // Helper to wait for global functions (React module loads async)
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

    // Mount React MapTypeToggle component
    waitForGlobal('mountMapToggle').then(() => {
        window.mountMapToggle('map-type-toggle', currentMapType, (newType) => {
            switchMapType(newType);
        });
    }).catch(error => {
        console.error('Failed to load map toggle:', error);
    });
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initMenuToggle();
    initMapTypeToggle();
});
