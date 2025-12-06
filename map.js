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
            document.body.classList.add('globe-view');
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
        el.setAttribute('aria-label', `View ${album.title} album`);

        // Create popup content
        const popupContent = createPopupContent(album);

        // Create popup with closeOnClick disabled so user can interact with it
        const popup = new maplibregl.Popup({
            offset: 25,
            maxWidth: '300px',
            className: 'custom-popup',
            closeOnClick: false,
            closeButton: true
        }).setDOMContent(popupContent);

        // Create marker
        const marker = new maplibregl.Marker({
            element: el,
            anchor: 'bottom'
        })
            .setLngLat([album.lng, album.lat])
            .setPopup(popup)
            .addTo(map);

        // Track if mouse is over popup
        let isOverPopup = false;
        let closeTimeout = null;

        const scheduleClose = () => {
            closeTimeout = setTimeout(() => {
                if (!isOverPopup && popup.isOpen()) {
                    popup.remove();
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
        el.addEventListener('mouseenter', () => {
            cancelClose();
            if (!popup.isOpen()) {
                marker.togglePopup();
            }
        });

        el.addEventListener('mouseleave', () => {
            scheduleClose();
        });

        // Track popup hover to keep it open
        popup.on('open', () => {
            const popupEl = popup.getElement();
            if (popupEl) {
                popupEl.addEventListener('mouseenter', () => {
                    isOverPopup = true;
                    cancelClose();
                });
                popupEl.addEventListener('mouseleave', () => {
                    isOverPopup = false;
                    scheduleClose();
                });
            }
        });

        // Add keyboard interaction with focus management
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                marker.togglePopup();

                // If popup is now open, focus the button inside it
                if (popup.isOpen()) {
                    setTimeout(() => {
                        const popupEl = popup.getElement();
                        if (popupEl) {
                            const btn = popupEl.querySelector('.open-album-btn');
                            if (btn) {
                                btn.focus();
                            }
                        }
                    }, 100);
                }
            }
        });

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
            document.body.classList.add('globe-view');
            await initGlobeMap();
        } else if (newType === 'accessible') {
            document.body.classList.remove('globe-view');
            await initLeafletMap();
        } else {
            document.body.classList.remove('globe-view');
            await initMapLibreMap();
        }

        // Render markers
        if (albums.length > 0) {
            renderMarkers();
        }

        // Update toggle UI
        updateToggleUI(newType);

        // Announce to screen readers
        const mapTypeName = newType === 'globe' ? '3D Gallery View' :
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
        // Get layers
        const { baseMaps, overlayMaps } = getLeafletLayers();

        // Remove all current layers to ensure clean slate
        map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });

        // Determine which base layer to show
        // We default to the standard theme map unless the user has manually selected something else?
        // For simplicity in this update, we always switch to the theme-appropriate map
        const newBaseLayer = theme === 'dark' ? baseMaps[MAP_PROVIDERS.dark.name] : baseMaps[MAP_PROVIDERS.light.name];
        newBaseLayer.addTo(map);

        // Re-render markers to ensure they are on top
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

// =============================================================================
// CRITICAL: DO NOT MODIFY THIS FUNCTION WITHOUT CAREFUL REVIEW
// This handles the map type toggle initialization. The async timing with
// React is critical for the toggle buttons to appear.
// =============================================================================
// Initialize map type toggle
function initMapTypeToggle() {
    // Helper to wait for global functions (React module loads async)
    // DO NOT REMOVE - This is critical for the toggle to load correctly
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
