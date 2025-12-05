// React-based 3D Card Gallery Implementation
// Replaces the previous Globe.GL implementation

let galleryUnmount = null;

// Initialize the 3D Gallery (formerly globe map)
async function initGlobeMap() {
    console.log('Initializing 3D Card Gallery');

    // Get the map container
    const container = document.getElementById('map');

    // Clear any existing content
    container.innerHTML = '';

    // Check if mountGallery is available (loaded from src/main.jsx)
    if (typeof window.mountGallery === 'function') {
        // We need albums data. It should be available globally in 'albums' variable from map.js
        // If empty, we might need to wait, but usually initMap is called after basic setup

        // Pass the global albums array
        // Note: albums is a global variable from map.js (declared with let), so it's not on window
        galleryUnmount = window.mountGallery('map', albums || []);

        console.log('3D Card Gallery mounted');
    } else {
        console.error('mountGallery function not found. React app might not be loaded.');
        container.innerHTML = '<div class="error-message">Failed to load 3D Gallery. Please refresh.</div>';
    }

    // Show controls (using the same container ID for simplicity, or we can hide them if not needed)
    // The new gallery has built-in controls, so we might want to hide the external ones
    hideGlobeControls();
}

// Render markers (Refresh data in React)
function renderGlobeMarkers() {
    // React handles its own rendering based on props. 
    // If we need to update data, we would need to re-mount or expose an update function.
    // For now, simpler to just re-mount if data changes significantly.

    if (galleryUnmount) {
        galleryUnmount();
        galleryUnmount = null;
    }
    initGlobeMap();
}

// Destroy globe instance
function destroyGlobe() {
    console.log('Destroying 3D Card Gallery');

    if (galleryUnmount) {
        galleryUnmount();
        galleryUnmount = null;
    }

    const container = document.getElementById('map');
    if (container) {
        container.innerHTML = '';
    }
}

// Toggle globe rotation (No-op or custom implementation for React)
function toggleGlobeRotation() {
    // The React component manages its own rotation state internally or via props
    // We could expose a method to toggle it if strictly required, but usually internal controls are better
    console.log('Rotation toggle handled by React component');
}

// Helpers stubbed to prevent errors if called
function showGlobeControls() {
    const controls = document.getElementById('globe-controls');
    if (controls) controls.classList.remove('hidden');
}

function hideGlobeControls() {
    const controls = document.getElementById('globe-controls');
    if (controls) controls.classList.add('hidden');
}
