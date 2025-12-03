// Album page JavaScript
let currentAlbum = null;
let galleryItems = [];

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

    // Kick off fresh fetch right away so we can do work while it loads
    const albumsPromise = fetchAlbums();
    let photosPromise = Promise.resolve();
    let usedCachedAlbum = false;

    // Try to get album data from sessionStorage (instant!)
    const cachedAlbumData = sessionStorage.getItem('currentAlbum');
    if (cachedAlbumData) {
      try {
        const cachedAlbum = JSON.parse(cachedAlbumData);
        if (cachedAlbum.id === albumId) {
          currentAlbum = cachedAlbum;
          usedCachedAlbum = true;
          displayAlbumInfo();
          initAlbumMap();
          if (cachedAlbum.folderId) {
            photosPromise = loadPhotos(currentAlbum);
          }
        }
      } catch (e) {
        console.warn('Failed to parse cached album:', e);
      }
    }

    // If we don't have cached data, show temporary title
    if (!currentAlbum) {
      setTemporaryTitle(albumId);
    }

    const albums = await albumsPromise;

    const freshAlbum = albums.find((a) => a.id === albumId);

    if (!freshAlbum) {
      showError("Album not found");
      return;
    }

    const previousFolderId = currentAlbum ? currentAlbum.folderId : null;
    const hadFolderId = Boolean(previousFolderId);

    currentAlbum = freshAlbum;

    try {
      sessionStorage.setItem('currentAlbum', JSON.stringify(currentAlbum));
    } catch (e) {
      console.warn('Unable to cache album in sessionStorage:', e);
    }

    // Update display with fresh data
    displayAlbumInfo();
    if (!document.getElementById('album-map').hasChildNodes()) {
      initAlbumMap();
    }

    const shouldReloadPhotos =
      !usedCachedAlbum ||
      !hadFolderId ||
      previousFolderId !== currentAlbum.folderId;

    if (shouldReloadPhotos) {
      photosPromise = loadPhotos(currentAlbum);
    } else if (previousFolderId && previousFolderId !== currentAlbum.folderId) {
      photosPromise = photosPromise.catch(() => { }).then(() => loadPhotos(currentAlbum));
    }

    await photosPromise;
  } catch (error) {
    console.error("Error loading album:", error);
    showError("Failed to load album");
  }
}

// Set a temporary title while data is loading
function setTemporaryTitle(albumId) {
  // Try to get a friendly name from the album ID
  // Convert URL-friendly format back to readable text
  const friendlyName = albumId
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  document.getElementById("album-title").textContent = friendlyName;
  document.title = `${friendlyName} - Family Travel Map`;
}

// Display album header information
function displayAlbumInfo() {
  const titleEl = document.getElementById("album-title");

  // Remove loading placeholder if it exists
  const placeholder = titleEl.querySelector('.loading-placeholder');
  if (placeholder) {
    placeholder.remove();
  }

  titleEl.textContent = currentAlbum.title;
  // Hide date since it duplicates the folder name
  document.getElementById("album-date").style.display = "none";
  document.getElementById("album-description").textContent = currentAlbum.description || "";
  document.title = `${currentAlbum.title} - Family Travel Map`;
}

// Initialize the small map showing album location
function initAlbumMap() {
  // Check if currentAlbum has coordinates
  if (!currentAlbum || !currentAlbum.lat || !currentAlbum.lng) {
    console.warn("Cannot initialize map: missing coordinates");
    return;
  }

  const albumMap = L.map("album-map", createMapOptions({
    center: [currentAlbum.lat, currentAlbum.lng],
    zoom: 12,
    scrollWheelZoom: false,
    dragging: false,
    zoomControl: false,
  }));

  createTileLayer().addTo(albumMap);

  L.marker([currentAlbum.lat, currentAlbum.lng], {
    title: currentAlbum.title,
  }).addTo(albumMap);
}

// Load photos from Google Drive via Apps Script
async function loadPhotos(albumData = currentAlbum) {
  const galleryEl = document.getElementById("gallery");

  try {
    if (!albumData || !albumData.folderId) {
      console.warn("Skipping photo load due to missing folder ID");
      return;
    }

    // Fetch files from Google Apps Script with cache busting
    const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?folder=${albumData.folderId}&t=${Date.now()}`);

    if (!response.ok) {
      throw new Error("Failed to fetch photos from Google Drive");
    }

    const data = await response.json();
    // Filter out empty files (size 0) which cause broken thumbnails/videos
    galleryItems = (data.items || []).filter(item => item.size > 0);

    if (galleryItems.length === 0) {
      galleryEl.innerHTML = '<p class="no-photos">No photos found in this album.</p>';
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

    // Render gallery (this replaces the skeleton loader)
    renderGallery();

    // Initialize PhotoSwipe (it will handle dimensions automatically)
    initPhotoSwipe();

    // Load image dimensions in background for better PhotoSwipe experience
    // This doesn't block the UI anymore
    loadImageDimensions();
  } catch (error) {
    console.error("Error loading photos:", error);
    galleryEl.innerHTML = '<p class="error">Failed to load photos. Make sure the Google Apps Script is deployed and the folder is accessible.</p>';
  }
}

// Load actual dimensions for each image (lazy loaded in background)
async function loadImageDimensions() {
  const galleryLinks = document.querySelectorAll('#gallery a');

  // Process images in batches to avoid overwhelming the browser
  const batchSize = 5;
  const links = Array.from(galleryLinks);

  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize);

    await Promise.all(batch.map((link, batchIndex) => {
      return new Promise((resolve) => {
        const index = i + batchIndex;
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
    }));

    // Small delay between batches to keep UI responsive
    if (i + batchSize < links.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
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
        // Use description as alt text if available, otherwise generate from filename
        videoThumbnail.alt = item.description || generateAltTextFromFilename(item.name, currentAlbum.title) || "Video thumbnail";

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

      // Use Google Drive thumbnail URL which is more reliable than lh3 links
      // and doesn't have the same referrer/expiration issues
      if (item.id) {
        img.src = `https://drive.google.com/thumbnail?id=${item.id}&sz=w2000`;
      } else {
        img.src = item.src;
      }

      // Use description as alt text if available, otherwise generate from filename
      img.alt = item.description || generateAltTextFromFilename(item.name, currentAlbum.title) || "Photo";
      img.className = "gallery-media";
      img.setAttribute("loading", "lazy");

      // Fallback in case even the thumbnail fails
      img.onerror = () => {
        console.warn(`Image failed to load: ${img.src}`);
        // Try the original src as a last resort if we weren't already using it
        if (img.src.includes('drive.google.com/thumbnail') && item.src && item.src !== img.src) {
          img.src = item.src;
        }
      };

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

// Generate readable alt text from filename
function generateAltTextFromFilename(filename, albumTitle = currentAlbum?.title || "") {
  if (!filename) return "";

  // Remove file extension
  let name = filename.replace(/\.(jpg|jpeg|png|gif|webp|mp4|mov|avi)$/i, "");

  // Replace common separators with spaces
  name = name.replace(/[-_]/g, " ");

  // Remove common photo naming patterns
  name = name.replace(/^(IMG|DSC|DCIM|photo|image|vid|video)[\s_-]*/i, "");

  // Remove date patterns (YYYY-MM-DD, YYYYMMDD, etc.)
  name = name.replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, "");

  // Remove timestamp patterns
  name = name.replace(/\d{6,}/g, "");

  // Clean up extra spaces
  name = name.replace(/\s+/g, " ").trim();

  // If nothing left, return generic text
  if (!name) {
    return albumTitle ? `Photo from ${albumTitle}` : "Photo";
  }

  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1);

  return name;
}

// Show error message
function showError(message) {
  const galleryEl = document.getElementById("gallery");
  galleryEl.innerHTML = `<p class="error">${message}</p>`;
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", initAlbum);
