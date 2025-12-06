// =============================================================================
// CRITICAL: DO NOT MODIFY THIS FILE WITHOUT CAREFUL REVIEW
// This file handles the 3D Gallery initialization. Changes here can break
// the gallery loading. The async timing with React is critical.
// =============================================================================

// React-based 3D Card Gallery Implementation
// Replaces the previous Globe.GL implementation

let galleryUnmount = null;

// Initialize the 3D Gallery (formerly globe map)
// IMPORTANT: This function must be async to properly work with initMap() in map.js
async function initGlobeMap() {
    console.log('Initializing 3D Card Gallery');

    // Helper to wait for global functions (React module loads async)
    // DO NOT REMOVE - This is critical for the gallery to load correctly
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

    // Get the map container
    const container = document.getElementById('map');

    // Note: container cleanup is now handled by mountGallery in main.jsx
    // DO NOT clear innerHTML here - it interferes with React root management

    // Wait for mountGallery to be available (from React module)
    try {
        await waitForGlobal('mountGallery');

        // Pass the global albums array
        // Note: albums is a global variable from map.js (declared with let), so it's not on window
        galleryUnmount = window.mountGallery('map', albums || []);

        console.log('3D Card Gallery mounted');
    } catch (error) {
        console.error('mountGallery function not found:', error);
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

    // Note: We no longer clear innerHTML here since mountGallery handles cleanup
    // The React unmount above will clean up the React component
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
