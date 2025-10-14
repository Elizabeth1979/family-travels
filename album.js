// Album page JavaScript
let currentAlbum = null;
let galleryItems = [];

// Replace this with your actual Google Apps Script URL
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwpZcOHQPdr2st43M5Riz3-d4Tq-gp00WEJR3QTgnbwsw-wtyHUkd4qbKFqL8FGodk/exec";

// Initialize the album page
async function initAlbum() {
  try {
    // Get album ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const albumId = urlParams.get("id");

    if (!albumId) {
      showError("No album ID provided");
      return;
    }

    // Load albums data
    const response = await fetch("albums.json");
    const albums = await response.json();

    // Find the current album
    currentAlbum = albums.find((a) => a.id === albumId);

    if (!currentAlbum) {
      showError("Album not found");
      return;
    }

    // Display album info
    displayAlbumInfo();

    // Initialize small location map
    initAlbumMap();

    // Load photos from Google Drive
    await loadPhotos();
  } catch (error) {
    console.error("Error loading album:", error);
    showError("Failed to load album");
  }
}

// Display album header information
function displayAlbumInfo() {
  document.getElementById("album-title").textContent = currentAlbum.title;
  // Hide date since it duplicates the folder name
  document.getElementById("album-date").style.display = "none";
  document.getElementById("album-description").textContent = currentAlbum.description || "";
  document.title = `${currentAlbum.title} - Family Travel Map`;
}

// Initialize the small map showing album location
function initAlbumMap() {
  const albumMap = L.map("album-map", {
    center: [currentAlbum.lat, currentAlbum.lng],
    zoom: 12,
    scrollWheelZoom: false,
    dragging: false,
    zoomControl: false,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(albumMap);

  L.marker([currentAlbum.lat, currentAlbum.lng], {
    title: currentAlbum.title,
  }).addTo(albumMap);
}

// Load photos from Google Drive via Apps Script
async function loadPhotos() {
  const loadingEl = document.getElementById("loading");
  const galleryEl = document.getElementById("gallery");

  try {
    loadingEl.style.display = "block";

    // Fetch files from Google Apps Script
    const response = await fetch(`${APPS_SCRIPT_URL}?folder=${currentAlbum.folderId}`);

    if (!response.ok) {
      throw new Error("Failed to fetch photos from Google Drive");
    }

    const data = await response.json();
    galleryItems = data.items || [];

    if (galleryItems.length === 0) {
      galleryEl.innerHTML = '<p class="no-photos">No photos found in this album.</p>';
      loadingEl.style.display = "none";
      return;
    }

    // Sort by type (images first, then videos), then by name within each type
    galleryItems.sort((a, b) => {
      const aIsVideo = a.mime && a.mime.startsWith("video/");
      const bIsVideo = b.mime && b.mime.startsWith("video/");

      // If one is video and other is not, images come first
      if (aIsVideo !== bIsVideo) {
        return aIsVideo ? 1 : -1;
      }

      // Within same type, sort by name
      return a.name.localeCompare(b.name);
    });

    // Render gallery
    renderGallery();

    // Load image dimensions before initializing PhotoSwipe
    await loadImageDimensions();

    // Initialize PhotoSwipe
    initPhotoSwipe();

    loadingEl.style.display = "none";
  } catch (error) {
    console.error("Error loading photos:", error);
    loadingEl.textContent =
      "Failed to load photos. Make sure the Google Apps Script is deployed and the folder is accessible.";
    loadingEl.style.color = "#d32f2f";
  }
}

// Load actual dimensions for each image
async function loadImageDimensions() {
  const galleryLinks = document.querySelectorAll('#gallery a');

  const promises = Array.from(galleryLinks).map((link, index) => {
    return new Promise((resolve) => {
      const item = galleryItems[index];
      const isVideo = item.mime && item.mime.startsWith("video/");

      if (isVideo) {
        // For videos, load video metadata to get actual dimensions
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
          link.setAttribute("data-pswp-width", video.videoWidth);
          link.setAttribute("data-pswp-height", video.videoHeight);
          resolve();
        };

        video.onerror = () => {
          // Fallback dimensions if video fails to load
          link.setAttribute("data-pswp-width", "1920");
          link.setAttribute("data-pswp-height", "1080");
          resolve();
        };

        video.src = link.href;
      } else {
        // For images, load and get natural dimensions
        const img = new Image();
        img.onload = () => {
          link.setAttribute("data-pswp-width", img.naturalWidth);
          link.setAttribute("data-pswp-height", img.naturalHeight);
          resolve();
        };
        img.onerror = () => {
          // Fallback dimensions if image fails to load
          link.setAttribute("data-pswp-width", "1920");
          link.setAttribute("data-pswp-height", "1080");
          resolve();
        };
        img.src = link.href;
      }
    });
  });

  await Promise.all(promises);
}

// Render gallery grid
function renderGallery() {
  const galleryEl = document.getElementById("gallery");
  galleryEl.innerHTML = "";

  let lastType = null; // Track if we've switched from images to videos

  galleryItems.forEach((item, index) => {
    const isVideo = item.mime && item.mime.startsWith("video/");

    // Add section header when we switch from images to videos
    if (lastType === false && isVideo === true) {
      const videoSectionHeader = document.createElement("div");
      videoSectionHeader.className = "section-header";
      videoSectionHeader.innerHTML = '<h2>Videos</h2>';
      galleryEl.appendChild(videoSectionHeader);
    } else if (lastType === null && isVideo === false) {
      // Add Photos header at the beginning if we have images
      const photoSectionHeader = document.createElement("div");
      photoSectionHeader.className = "section-header";
      photoSectionHeader.innerHTML = '<h2>Photos</h2>';
      galleryEl.appendChild(photoSectionHeader);
    } else if (lastType === null && isVideo === true) {
      // Only videos in album
      const videoSectionHeader = document.createElement("div");
      videoSectionHeader.className = "section-header";
      videoSectionHeader.innerHTML = '<h2>Videos</h2>';
      galleryEl.appendChild(videoSectionHeader);
    }

    lastType = isVideo;

    const galleryItem = document.createElement("a");
    galleryItem.href = item.src;
    galleryItem.className = "gallery-item";
    galleryItem.setAttribute("data-index", index);
    galleryItem.setAttribute("role", "listitem");
    // Let PhotoSwipe calculate dimensions from the actual image

    if (isVideo) {
      // For videos, try to get thumbnail from Google Drive
      const videoThumbnail = document.createElement("img");
      videoThumbnail.className = "gallery-media";
      videoThumbnail.setAttribute("loading", "lazy");

      // Extract file ID from Google Drive URL
      let thumbnailUrl = null;
      const fileIdMatch = item.src.match(/[?&]id=([^&]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        const fileId = fileIdMatch[1];
        // Use Google Drive thumbnail API (size options: s220, s400, s640, s1600)
        thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
      }

      if (thumbnailUrl) {
        videoThumbnail.src = thumbnailUrl;
        videoThumbnail.alt = item.name || "Video thumbnail";

        // Fallback to gradient placeholder if thumbnail fails to load
        videoThumbnail.onerror = () => {
          videoThumbnail.style.display = 'none';
          const placeholder = document.createElement("div");
          placeholder.className = "gallery-media video-placeholder";
          galleryItem.insertBefore(placeholder, galleryItem.firstChild);
        };
      } else {
        // Use gradient placeholder if we can't extract file ID
        videoThumbnail.style.display = 'none';
        const placeholder = document.createElement("div");
        placeholder.className = "gallery-media video-placeholder";
        galleryItem.appendChild(placeholder);
      }

      // Add video icon/text
      const videoLabel = document.createElement("div");
      videoLabel.className = "video-label";
      videoLabel.textContent = "VIDEO";

      const playIcon = document.createElement("div");
      playIcon.className = "play-icon";
      playIcon.innerHTML = "▶";

      galleryItem.appendChild(videoThumbnail);
      galleryItem.appendChild(videoLabel);
      galleryItem.appendChild(playIcon);
      galleryItem.setAttribute("data-pswp-type", "video");
    } else {
      // Image thumbnail
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.name || "Photo";
      img.className = "gallery-media";
      img.setAttribute("loading", "lazy");

      galleryItem.appendChild(img);
    }

    galleryEl.appendChild(galleryItem);
  });
}

// Initialize PhotoSwipe lightbox
function initPhotoSwipe() {
  const lightbox = new PhotoSwipeLightbox({
    gallery: "#gallery",
    children: "a",
    pswpModule: PhotoSwipe,

    // Allow downloading
    showHideAnimationType: "fade",

    // Custom options
    closeOnVerticalDrag: true,
    pinchToClose: true,
  });

  // Handle videos with custom content
  lightbox.on('contentLoad', (e) => {
    const { content, isLazy } = e;

    if (content.data.element && content.data.element.getAttribute('data-pswp-type') === 'video') {
      e.preventDefault();

      // Get the video URL from the href attribute
      let videoUrl = content.data.element.href || content.data.src;

      // Convert Google Drive URL to proper streaming format
      // From: https://drive.google.com/uc?export=view&id=FILE_ID
      // To: https://drive.google.com/file/d/FILE_ID/preview
      if (videoUrl.includes('drive.google.com')) {
        const fileIdMatch = videoUrl.match(/[?&]id=([^&]+)/);
        if (fileIdMatch && fileIdMatch[1]) {
          const fileId = fileIdMatch[1];
          videoUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        }
      }

      console.log('Loading video:', videoUrl);

      // Create a wrapper div that PhotoSwipe will size correctly
      const wrapper = document.createElement('div');
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.background = '#000';

      // Use an iframe for Google Drive videos with aspect ratio preserved
      const iframe = document.createElement('iframe');
      iframe.src = videoUrl;
      iframe.frameBorder = '0';
      iframe.allow = 'autoplay';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.objectFit = 'contain';

      wrapper.appendChild(iframe);
      content.element = wrapper;
      content.type = 'video';

      if (!isLazy) {
        content.onLoaded();
      }
    }
  });

  // Add ALT button functionality
  lightbox.on("uiRegister", function () {
    lightbox.pswp.ui.registerElement({
      name: "alt-button",
      order: 9,
      isButton: true,
      html: "ALT",
      onClick: (event, el) => {
        const caption = lightbox.pswp.currSlide.data.element.querySelector("img")?.alt;
        if (caption) {
          alert(caption);
        }
      },
    });
  });

  lightbox.init();
}

// Show error message
function showError(message) {
  const loadingEl = document.getElementById("loading");
  loadingEl.textContent = message;
  loadingEl.style.color = "#d32f2f";
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", initAlbum);
