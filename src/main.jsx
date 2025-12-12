import React from 'react'
import ReactDOM from 'react-dom/client'
import StellarCardGallery from './StellarCardGallery'
import MapTypeToggle from './components/MapTypeToggle'
import './index.css'

// =============================================================================
// CRITICAL: DO NOT MODIFY WITHOUT CAREFUL REVIEW
// This handles React mounting for the 3D gallery. The root caching is critical.
// =============================================================================

// Cache for React roots to avoid createRoot() errors on re-mount
// CRITICAL: These must be properly managed to prevent React errors
let galleryRoot = null;
let galleryContainer = null;
let toggleRoot = null;

// This function will be called from map.js/globe.js
window.mountGallery = function (containerId, albums) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id "${containerId}" not found`);
        return;
    }

    // Transform albums to cards format
    const cards = albums.map(album => ({
        id: album.id,
        imageUrl: album.cover,
        alt: album.title,
        title: album.title,
        date: album.date,
        url: `album.html?id=${album.id}`,
        ...album
    }));

    // Check if we need a new root:
    // - If no root exists
    // - If the container element changed (e.g., was replaced in the DOM)
    // - If the container was cleared (innerHTML = '') by other code (e.g., map.js switchMapType)
    // DO NOT REMOVE - This prevents createRoot() errors on re-mount
    const containerWasCleared = galleryContainer === container && container.childElementCount === 0;
    const needsNewRoot = !galleryRoot || galleryContainer !== container || containerWasCleared;

    if (needsNewRoot) {
        // If there was an old root, unmount it first
        if (galleryRoot) {
            try {
                galleryRoot.unmount();
            } catch (e) {
                console.warn('Failed to unmount old gallery root:', e);
            }
        }
        // Clear any existing content before creating new root
        container.innerHTML = '';
        galleryRoot = ReactDOM.createRoot(container);
        galleryContainer = container;
    }

    galleryRoot.render(
        <React.StrictMode>
            <StellarCardGallery cards={cards} />
        </React.StrictMode>
    );

    // Return unmount function for cleanup
    // CRITICAL: This resets both root AND container reference
    return () => {
        if (galleryRoot) {
            try {
                galleryRoot.unmount();
            } catch (e) {
                console.warn('Failed to unmount gallery root:', e);
            }
            galleryRoot = null;
            galleryContainer = null;
        }
    };
};

// Mount MapTypeToggle component for view switching
window.mountMapToggle = function (containerId, initialValue, onValueChange) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id "${containerId}" not found`);
        return;
    }

    // Create a wrapper component to handle state
    const MapToggleWrapper = () => {
        const [value, setValue] = React.useState(initialValue);

        const handleChange = (newValue) => {
            setValue(newValue);
            if (onValueChange) {
                onValueChange(newValue);
            }
        };

        // Expose setValue to allow external updates
        React.useEffect(() => {
            window.setMapToggleValue = setValue;
        }, []);

        return <MapTypeToggle value={value} onValueChange={handleChange} />;
    };

    const root = ReactDOM.createRoot(container);
    root.render(
        <React.StrictMode>
            <MapToggleWrapper />
        </React.StrictMode>
    );

    // Return unmount function for cleanup
    return () => root.unmount();
};

