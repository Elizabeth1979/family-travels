// Globe.GL implementation for 3D interactive globe
let globeInstance = null;
let globeMarkers = [];
let isRotating = true;

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
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 200;
    controls.maxDistance = 800;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Set initial camera position
    globeInstance.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 0);

    console.log('Globe.GL initialized successfully');

    // Show rotation toggle button
    showRotationToggle();

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

// Show rotation toggle button
function showRotationToggle() {
    const toggleBtn = document.getElementById('rotation-toggle');
    if (toggleBtn) {
        toggleBtn.classList.remove('hidden');
        updateRotationToggleUI();
    }
}

// Hide rotation toggle button
function hideRotationToggle() {
    const toggleBtn = document.getElementById('rotation-toggle');
    if (toggleBtn) {
        toggleBtn.classList.add('hidden');
    }
}

// Render markers on the globe
function renderGlobeMarkers() {
    if (!globeInstance || !albums || albums.length === 0) return;

    console.log('Rendering globe markers for', albums.length, 'albums');

    // Prepare points data for Globe.GL
    const pointsData = albums
        .filter(album => typeof album.lat === 'number' && typeof album.lng === 'number')
        .map(album => ({
            lat: album.lat,
            lng: album.lng,
            size: 0.5,
            color: '#FF6B6B',
            album: album
        }));

    // Add points layer
    globeInstance
        .pointsData(pointsData)
        .pointAltitude(0.01)
        .pointRadius('size')
        .pointColor('color')
        .pointLabel(d => `
            <div style="
                background: white;
                padding: 12px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                max-width: 200px;
            ">
                <strong style="font-size: 14px; color: #667eea;">${d.album.title}</strong>
                ${d.album.date ? `<div style="font-size: 12px; color: #718096; margin-top: 4px;">${d.album.date}</div>` : ''}
            </div>
        `)
        .onPointClick(point => {
            // Store album data and navigate
            sessionStorage.setItem('currentAlbum', JSON.stringify(point.album));
            window.location.href = `album.html?id=${point.album.id}`;
        })
        .onPointHover(point => {
            // Change cursor on hover
            document.body.style.cursor = point ? 'pointer' : 'default';
        });

    // Add labels layer for better visibility
    const labelsData = albums
        .filter(album => typeof album.lat === 'number' && typeof album.lng === 'number')
        .map(album => ({
            lat: album.lat,
            lng: album.lng,
            text: album.title,
            size: 0.8,
            color: '#667eea',
            album: album
        }));

    globeInstance
        .labelsData(labelsData)
        .labelLat('lat')
        .labelLng('lng')
        .labelText('text')
        .labelSize('size')
        .labelColor('color')
        .labelDotRadius(0.5)
        .labelAltitude(0.02)
        .labelResolution(2)
        .onLabelClick(label => {
            // Store album data and navigate
            sessionStorage.setItem('currentAlbum', JSON.stringify(label.album));
            window.location.href = `album.html?id=${label.album.id}`;
        })
        .onLabelHover(label => {
            // Change cursor on hover
            document.body.style.cursor = label ? 'pointer' : 'default';
        });

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

        // Hide rotation toggle button
        hideRotationToggle();

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
        hideRotationToggle();
    }
}

// Check if Globe.GL is available
function isGlobeAvailable() {
    return typeof Globe !== 'undefined' && typeof THREE !== 'undefined';
}
