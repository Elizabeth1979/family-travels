import React from 'react'
import ReactDOM from 'react-dom/client'
import StellarCardGallery from './StellarCardGallery'
import './index.css'

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

    const root = ReactDOM.createRoot(container);
    root.render(
        <React.StrictMode>
            <StellarCardGallery cards={cards} />
        </React.StrictMode>
    );

    // Return unmount function for cleanup
    return () => root.unmount();
};
