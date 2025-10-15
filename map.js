// Main map page JavaScript
let map;
let albums = [];

// Initialize the map
async function initMap() {
    try {
        // Fetch albums data
        let response;
        if (CONFIG.USE_DYNAMIC_ALBUMS && CONFIG.MASTER_FOLDER_ID !== 'YOUR_MASTER_FOLDER_ID_HERE') {
            // Fetch dynamically from Google Apps Script
            response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=list&master=${CONFIG.MASTER_FOLDER_ID}`);
        } else {
            // Fall back to static albums.json
            response = await fetch('albums.json');
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        albums = await response.json();

        // Initialize Leaflet map
        map = L.map('map').setView([32.0, 34.8], 8);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        // Add markers for each album
        const bounds = [];
        albums.forEach(album => {
            const marker = L.marker([album.lat, album.lng], {
                title: album.title,
                alt: `Location of ${album.title}`
            }).addTo(map);

            // Create popup content
            const popupContent = createPopupContent(album);
            marker.bindPopup(popupContent, {
                maxWidth: 320,
                className: 'map-popup-shell'
            });

            // Add to bounds for auto-fitting
            bounds.push([album.lat, album.lng]);

            // Make marker keyboard accessible
            marker.on('keypress', (e) => {
                if (e.originalEvent.key === 'Enter') {
                    marker.openPopup();
                }
            });
        });

        // Fit map to show all markers
        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        // Populate album list sidebar
        populateAlbumList();

    } catch (error) {
        console.error('Error loading albums:', error);
        document.getElementById('album-list-items').innerHTML =
            '<li class="error">Failed to load albums. Please try again later.</li>';
    }
}

// Create popup content with cover image and link
function createPopupContent(album) {
    const container = document.createElement('div');
    container.className = 'map-popup';

    if (album.cover) {
        const img = document.createElement('img');
        img.src = album.cover;
        img.alt = `Cover photo for ${album.title}`;
        img.className = 'popup-cover';
        container.appendChild(img);
    }

    const title = document.createElement('h3');
    title.textContent = album.title;
    title.className = 'popup-title';
    container.appendChild(title);

    if (album.date) {
        const date = document.createElement('p');
        date.textContent = album.date;
        date.className = 'popup-meta';
        container.appendChild(date);
    }

    const actions = document.createElement('div');
    actions.className = 'popup-actions';

    const button = document.createElement('a');
    button.href = `album.html?id=${album.id}`;
    button.textContent = 'Open Album';
    button.className = 'btn-primary';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', `Open the ${album.title} album`);

    actions.appendChild(button);
    container.appendChild(actions);

    return container;
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

        link.textContent = album.title;

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
        albumMenu.setAttribute('aria-hidden', 'true');

        // Open menu
        menuToggle.addEventListener('click', () => {
            const isOpen = albumMenu.classList.toggle('is-open');
            menuToggle.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', isOpen);
            albumMenu.setAttribute('aria-hidden', String(!isOpen));
        });

        // Close menu with close button
        if (menuClose) {
            menuClose.addEventListener('click', (e) => {
                e.stopPropagation();
                albumMenu.classList.remove('is-open');
                menuToggle.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                albumMenu.setAttribute('aria-hidden', 'true');
            });
        }

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!albumMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                albumMenu.classList.remove('is-open');
                menuToggle.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                albumMenu.setAttribute('aria-hidden', 'true');
            }
        });
    }
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    initMenuToggle();
});
