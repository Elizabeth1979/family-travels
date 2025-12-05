// Globe.GL implementation for 3D interactive globe
let globeInstance = null;
let globeMarkers = [];
let isRotating = false;  // Start with rotation disabled for better zoom experience

// Initialize Globe.GL
async function initGlobeMap() {
    console.log('Initializing Globe.GL');

    if (typeof Globe === 'undefined') {
        throw new Error('Globe.GL not loaded');
    }

    // Get the map container
    const container = document.getElementById('map');

    // Clear any existing content
    container.innerHTML = '';

    // Create Globe instance
    globeInstance = Globe()
        .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
        .showAtmosphere(true)
        .atmosphereColor('lightskyblue')
        .atmosphereAltitude(0.25)
        .width(container.clientWidth)
        .height(container.clientHeight);

    // Mount to container
    globeInstance(container);

    // Enable rotation controls
    const controls = globeInstance.controls();
    controls.enableDamping = false;  // Disable damping for more responsive controls
    controls.rotateSpeed = 0.5;
    controls.enableZoom = true;  // Explicitly enable zoom
    controls.zoomSpeed = 3.0;  // Even faster zoom
    controls.minDistance = 100.1;  // Allow very close zoom for street-level view (Deep Zoom)
    controls.maxDistance = 800;
    controls.autoRotate = false;  // Disable auto-rotate by default so zoom works better
    controls.autoRotateSpeed = 0.5;

    console.log('Zoom controls enabled - use mouse wheel or pinch to zoom');

    // Set initial camera position
    globeInstance.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);

    console.log('Globe.GL initialized successfully');

    // Show globe controls
    showGlobeControls();

    // Handle window resize
    window.addEventListener('resize', () => {
        if (globeInstance && currentMapType === 'globe') {
            globeInstance
                .width(container.clientWidth)
                .height(container.clientHeight);
        }
    });
}

// Toggle globe rotation
function toggleGlobeRotation() {
    if (!globeInstance) return;

    const controls = globeInstance.controls();
    if (!controls) return;

    isRotating = !isRotating;
    controls.autoRotate = isRotating;

    // Update button UI
    updateRotationToggleUI();

    console.log('Globe rotation:', isRotating ? 'enabled' : 'disabled');
}

// Update rotation toggle button UI
function updateRotationToggleUI() {
    const toggleBtn = document.getElementById('rotation-toggle');
    if (!toggleBtn) return;

    const pauseIcon = toggleBtn.querySelector('.pause-icon');
    const playIcon = toggleBtn.querySelector('.play-icon');

    if (isRotating) {
        toggleBtn.classList.add('rotating');
        toggleBtn.setAttribute('aria-label', 'Stop globe rotation');
        toggleBtn.setAttribute('title', 'Stop rotation');
        pauseIcon.classList.remove('hidden');
        playIcon.classList.add('hidden');
    } else {
        toggleBtn.classList.remove('rotating');
        toggleBtn.setAttribute('aria-label', 'Start globe rotation');
        toggleBtn.setAttribute('title', 'Start rotation');
        pauseIcon.classList.add('hidden');
        playIcon.classList.remove('hidden');
    }
}

// Show globe controls
function showGlobeControls() {
    const controlsContainer = document.getElementById('globe-controls');
    if (controlsContainer) {
        controlsContainer.classList.remove('hidden');
        updateRotationToggleUI();

        // Attach event listeners if not already attached (simple check)
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const rotationBtn = document.getElementById('rotation-toggle');

        // Remove old listeners to prevent duplicates (cloning is a simple way)
        const newZoomIn = zoomInBtn.cloneNode(true);
        const newZoomOut = zoomOutBtn.cloneNode(true);
        const newRotation = rotationBtn.cloneNode(true);

        zoomInBtn.parentNode.replaceChild(newZoomIn, zoomInBtn);
        zoomOutBtn.parentNode.replaceChild(newZoomOut, zoomOutBtn);
        rotationBtn.parentNode.replaceChild(newRotation, rotationBtn);

        newZoomIn.addEventListener('click', zoomIn);
        newZoomOut.addEventListener('click', zoomOut);
        newRotation.addEventListener('click', toggleGlobeRotation);
    }
}

// Hide globe controls
function hideGlobeControls() {
    const controlsContainer = document.getElementById('globe-controls');
    if (controlsContainer) {
        controlsContainer.classList.add('hidden');
    }
}

// Zoom In Function
function zoomIn() {
    if (!globeInstance) return;
    const currentAltitude = globeInstance.pointOfView().altitude;
    const newAltitude = Math.max(0.01, currentAltitude * 0.6); // Zoom in by 40%
    globeInstance.pointOfView({ altitude: newAltitude }, 500);
}

// Zoom Out Function
function zoomOut() {
    if (!globeInstance) return;
    const currentAltitude = globeInstance.pointOfView().altitude;
    const newAltitude = Math.min(4.0, currentAltitude * 1.4); // Zoom out by 40%
    globeInstance.pointOfView({ altitude: newAltitude }, 500);
}

// Render markers on the globe
function renderGlobeMarkers() {
    if (!globeInstance || !albums || albums.length === 0) return;

    console.log('Rendering globe markers for', albums.length, 'albums');

    // Prepare points data for Globe.GL with custom HTML pins
    const pointsData = albums
        .filter(album => typeof album.lat === 'number' && typeof album.lng === 'number')
        .map(album => ({
            lat: album.lat,
            lng: album.lng,
            album: album
        }));

    // Add custom HTML markers as pins that scale with zoom
    globeInstance
        .htmlElementsData(pointsData)
        .htmlElement(d => {
            const el = document.createElement('div');
            el.className = 'globe-pin';
            el.innerHTML = `
                <svg width="30" height="40" viewBox="0 0 24 32" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                    <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 21 9 21s9-14.25 9-21c0-4.97-4.03-9-9-9z"
                          fill="#DC2626"
                          stroke="#991B1B"
                          stroke-width="1"/>
                    <circle cx="12" cy="9" r="4" fill="white" opacity="0.9"/>
                </svg>
            `;
            el.style.cursor = 'pointer';
            el.style.pointerEvents = 'auto';
            el.style.transition = 'transform 0.2s ease-out';
            el.style.transformOrigin = 'bottom center'; // Scale from the bottom tip

            // Add hover tooltip
            el.title = `${d.album.title}${d.album.date ? ' - ' + d.album.date : ''}`;

            // Click handler
            el.addEventListener('click', () => {
                sessionStorage.setItem('currentAlbum', JSON.stringify(d.album));
                window.location.href = `album.html?id=${d.album.id}`;
            });

            return el;
        })
        // Clear old point markers
        .pointsData([])
        .labelsData([]);

    // Add dynamic scaling based on camera distance
    const controls = globeInstance.controls();
    const camera = globeInstance.camera();

    function updatePinSizes() {
        const distance = camera.position.length();
        // Scale pins inversely with distance: closer = LARGER pins
        // At max distance (800): scale = 0.5 (small)
        // At min distance (100): scale = 1.5 (large)
        
        // Calculate normalized distance (0 to 1, where 0 is closest)
        const minDst = 100;
        const maxDst = 800;
        const normalizedDist = Math.max(0, Math.min(1, (distance - minDst) / (maxDst - minDst)));
        
        // Invert: 1 is closest, 0 is furthest
        const proximity = 1 - normalizedDist;
        
        // Scale from 0.5 to 1.5
        const scale = 0.5 + (proximity * 1.0);

        document.querySelectorAll('.globe-pin').forEach(pin => {
            pin.style.transform = `scale(${scale})`;
        });
    }

    // Update pin sizes on zoom/pan
    controls.addEventListener('change', updatePinSizes);

    // Initial size update
    updatePinSizes();

    // Auto-rotate to show all markers
    if (pointsData.length > 0) {
        // Calculate center of all points
        const avgLat = pointsData.reduce((sum, p) => sum + p.lat, 0) / pointsData.length;
        const avgLng = pointsData.reduce((sum, p) => sum + p.lng, 0) / pointsData.length;

        // Animate to center view
        globeInstance.pointOfView({ lat: avgLat, lng: avgLng, altitude: 2.5 }, 2000);
    }

    globeMarkers = pointsData;
}

// Destroy globe instance
function destroyGlobe() {
    console.log('Destroying globe instance');

    try {
        if (globeInstance) {
            // Stop animation
            const controls = globeInstance.controls();
            if (controls) {
                controls.autoRotate = false;
                controls.dispose();
            }

            // Clear globe data
            globeInstance.pointsData([]);
            globeInstance.labelsData([]);
        }

        // Hide globe controls
        hideGlobeControls();

        // Clear the container completely
        const container = document.getElementById('map');
        if (container) {
            // Remove all children
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }

            // Reset any inline styles
            container.style.cssText = '';
        }

        globeInstance = null;
        globeMarkers = [];
        isRotating = true; // Reset to default

        console.log('Globe destroyed successfully');
    } catch (error) {
        console.warn('Failed to destroy globe:', error);

        // Fallback cleanup
        const container = document.getElementById('map');
        if (container) {
            container.innerHTML = '';
        }
        hideGlobeControls();
    }
}

// Check if Globe.GL is available
function isGlobeAvailable() {
    return typeof Globe !== 'undefined' && typeof THREE !== 'undefined';
}
