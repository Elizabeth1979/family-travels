// Main map page JavaScript
let map;
let albums = [];

// Initialize the map
async function initMap() {
    try {
        // Fetch albums data using shared utility
        albums = await fetchAlbums();

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
                maxWidth: 300
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
