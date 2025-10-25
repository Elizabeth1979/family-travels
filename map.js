// Main map page JavaScript
let map;
let albums = [];
let markerLayer;

// Initialize the map container immediately while album data loads in background
function initMap() {
    if (!map) {
        map = L.map('map', createMapOptions()).setView([32.0, 34.8], 8);
        createTileLayer().addTo(map);
        markerLayer = L.layerGroup().addTo(map);
    }

    // Try to show pins from cache immediately
    const cachedAlbums = getCachedAlbums();
    if (cachedAlbums && cachedAlbums.length > 0) {
        albums = cachedAlbums;
        renderMarkers();
        populateAlbumList();
    }

    // Then fetch fresh data in background
    loadAlbumsAndMarkers();
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
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    const bounds = [];

    albums.forEach(album => {
        if (typeof album.lat !== 'number' || typeof album.lng !== 'number') {
            return;
        }

        const marker = L.marker([album.lat, album.lng], {
            title: album.title,
            alt: `Location of ${album.title}`
        });

        marker.addTo(markerLayer);

        const popupContent = createPopupContent(album);
        marker.bindPopup(popupContent, {
            maxWidth: 300
        });

        bounds.push([album.lat, album.lng]);

        marker.on('keypress', (e) => {
            if (e.originalEvent.key === 'Enter') {
                marker.openPopup();
            }
        });
    });

    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Create popup content with cover image and link
function createPopupContent(album) {
    const div = document.createElement('div');
    div.className = 'popup-content';

    if (album.cover) {
        const img = document.createElement('img');
        img.src = album.cover;
        img.alt = `Cover photo for ${album.title}`;
        img.className = 'popup-cover';
        img.style.width = '100%';
        img.style.height = '150px';
        img.style.objectFit = 'cover';
        img.style.marginBottom = '10px';
        img.style.borderRadius = '4px';
        div.appendChild(img);
    }

    const title = document.createElement('h3');
    title.textContent = album.title;
    title.style.margin = '0 0 10px 0';
    div.appendChild(title);

    if (album.date) {
        const date = document.createElement('p');
        date.textContent = album.date;
        date.style.margin = '0 0 10px 0';
        date.style.color = '#666';
        date.style.fontSize = '14px';
        div.appendChild(date);
    }

    const button = document.createElement('a');
    button.href = `album.html?id=${album.id}`;
    button.textContent = 'Open Album';
    button.className = 'open-album-btn';
    button.style.display = 'inline-block';
    button.style.padding = '8px 16px';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = 'white';
    button.style.textDecoration = 'none';
    button.style.borderRadius = '4px';
    button.style.fontWeight = 'bold';

    // Store album data for instant loading on album page
    button.addEventListener('click', () => {
        sessionStorage.setItem('currentAlbum', JSON.stringify(album));
    });

    div.appendChild(button);

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

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initMenuToggle();
});
