// Album page JavaScript
let currentAlbum = null;
let galleryItems = [];
let albumMap = null;

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

    // Check if this is a shared link (hide back button)
    const isShared = urlParams.get("shared") === "true";
    if (isShared) {
      const backLink = document.querySelector('.back-link');
      if (backLink) {
        backLink.style.display = 'none';
      }
    }

    // Kick off fresh fetch right away so we can do work while it loads
    const albumsPromise = fetchAlbums();
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
          // Initialize map immediately from cache - don't wait for photos!
          initAlbumMap();
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

    currentAlbum = freshAlbum;

    try {
      sessionStorage.setItem('currentAlbum', JSON.stringify(currentAlbum));
    } catch (e) {
      console.warn('Unable to cache album in sessionStorage:', e);
    }

    // Update display with fresh data
    displayAlbumInfo();

    // Initialize map with fresh data if not already done or if coordinates changed
    const mapContainer = document.getElementById('album-map');
    const mapNeedsInit = !mapContainer.hasChildNodes() || !albumMap;
    if (mapNeedsInit && currentAlbum.lat && currentAlbum.lng) {
      initAlbumMap();
    }

    // Load photos asynchronously - DO NOT await, let the map show immediately
    // Always load photos on page load - we need to fetch from the API
    if (currentAlbum.folderId) {
      // Start photo loading but don't block on it
      loadPhotos(currentAlbum).catch(error => {
        console.error("Error loading photos:", error);
      });
    }
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
    console.warn("Cannot initialize map: missing coordinates", {
      hasAlbum: !!currentAlbum,
      lat: currentAlbum?.lat,
      lng: currentAlbum?.lng
    });
    return;
  }

  // Clean up existing map if present
  if (albumMap) {
    albumMap.remove();
    albumMap = null;
  }

  albumMap = L.map("album-map", createMapOptions({
    center: [currentAlbum.lat, currentAlbum.lng],
    zoom: 12,
    scrollWheelZoom: false,
    dragging: false,
    zoomControl: false,
  }));

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

  // Add base layer
  createTileLayer(currentTheme).addTo(albumMap);

  // Add labels if dark mode (Satellite)
  if (currentTheme === 'dark') {
    createTileLayer('labels').addTo(albumMap);
  }

  L.marker([currentAlbum.lat, currentAlbum.lng], {
    title: currentAlbum.title,
  }).addTo(albumMap);

  // Set Google Maps link
  const mapLink = document.getElementById("map-link");
  if (mapLink) {
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${currentAlbum.lat},${currentAlbum.lng}`;
  }
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
      // Preserve header if it exists
      const headerHtml = '<div class="section-header"><h2>Photos</h2></div>';
      galleryEl.innerHTML = headerHtml + '<p class="no-photos">No photos found in this album.</p>';
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
    const headerHtml = '<div class="section-header"><h2>Photos</h2></div>';
    galleryEl.innerHTML = headerHtml + '<p class="error">Failed to load photos. Make sure the Google Apps Script is deployed and the folder is accessible.</p>';
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

// Render gallery grid with staggered animation
function renderGallery() {
  const galleryEl = document.getElementById("gallery");
  galleryEl.innerHTML = "";

  let lastType = null; // Track if we've switched from images to videos
  let itemCount = 0; // Track item index for staggered animation

  galleryItems.forEach((item, index) => {
    const isVideo = item.mime && item.mime.startsWith("video/");

    // Add section header when we switch from images to videos
    if (lastType === false && isVideo === true) {
      const videoSectionHeader = document.createElement("div");
      videoSectionHeader.className = "section-header";
      videoSectionHeader.innerHTML = '<h2>Videos</h2>';
      galleryEl.appendChild(videoSectionHeader);
      itemCount = 0; // Reset count for video section
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
    // Start hidden for staggered reveal animation
    galleryItem.className = "gallery-item gallery-item-hidden";
    galleryItem.setAttribute("data-index", index);
    galleryItem.setAttribute("role", "listitem");
    // Set animation delay based on position for cascade effect
    galleryItem.style.animationDelay = `${itemCount * 50}ms`;
    itemCount++;

    if (isVideo) {
      // For videos, try to get thumbnail from Google Drive
      const videoThumbnail = document.createElement("img");
      videoThumbnail.className = "gallery-media loading";
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
        // Use description as alt text if available, otherwise empty (will be generated by AI)
        videoThumbnail.alt = item.description || "";

        // Progressive loading: fade in when loaded
        videoThumbnail.onload = () => {
          videoThumbnail.classList.remove('loading');
        };

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

      // Use description as alt text if available, otherwise empty (will be generated by AI)
      img.alt = item.description || "";
      img.className = "gallery-media loading";
      img.setAttribute("loading", "lazy");

      // Progressive loading: fade in when loaded
      img.onload = () => {
        img.classList.remove('loading');
      };

      // Fallback in case even the thumbnail fails
      img.onerror = () => {
        console.warn(`Image failed to load: ${img.src}`);
        img.classList.remove('loading');
        // Try the original src as a last resort if we weren't already using it
        if (img.src.includes('drive.google.com/thumbnail') && item.src && item.src !== img.src) {
          img.src = item.src;
        }
      };

      galleryItem.appendChild(img);
    }

    galleryEl.appendChild(galleryItem);
  });

  // Trigger staggered reveal animation after items are in the DOM
  requestAnimationFrame(() => {
    const hiddenItems = galleryEl.querySelectorAll('.gallery-item-hidden');
    hiddenItems.forEach(item => {
      item.classList.remove('gallery-item-hidden');
      item.classList.add('gallery-item-visible');
    });
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
      // Use max dimensions to preserve aspect ratio within the container
      iframe.style.maxWidth = '100%';
      iframe.style.maxHeight = '100%';
      iframe.style.width = '90vw';
      iframe.style.height = '80vh';
      iframe.style.aspectRatio = '16 / 9';
      iframe.style.border = 'none';

      wrapper.appendChild(iframe);
      content.element = wrapper;
      content.type = 'video';

      if (!isLazy) {
        content.onLoaded();
      }
    }
  });

  // ALT button and caption overlay removed - to be re-added when proper alt text strategy is implemented

  // Pause previous video when changing slides
  lightbox.on('change', () => {
    const contentElements = document.querySelectorAll('.pswp__content');
    const currentSlideIndex = lightbox.pswp.currIndex;

    contentElements.forEach((content, i) => {
      if (i !== currentSlideIndex) {
        const iframe = content.querySelector('iframe');
        if (iframe) {
          // Pause non-current videos by resetting src
          const currentSrc = iframe.src;
          iframe.src = '';
          iframe.src = currentSrc;
        }
      }
    });
  });

  // Pause all videos when lightbox closes
  lightbox.on('close', () => {
    const iframes = document.querySelectorAll('.pswp__content iframe');
    iframes.forEach(iframe => {
      iframe.src = '';
    });
  });

  lightbox.init();

  // Set up Intersection Observer to pause videos when scrolling out of view
  setupVideoObserver();
}

// Set up Intersection Observer to pause videos when they scroll out of view
function setupVideoObserver() {
  // Observe the PhotoSwipe container for video iframes
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        // Video is out of view, pause it by resetting the iframe src
        const iframe = entry.target;
        const currentSrc = iframe.src;
        if (currentSrc) {
          iframe.src = '';
          iframe.src = currentSrc;
        }
      }
    });
  }, {
    threshold: 0.1 // Trigger when less than 10% is visible
  });

  // Also observe any video elements in the gallery (though we mainly use iframes)
  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Look for iframes in the PhotoSwipe container
          const iframes = node.querySelectorAll ? node.querySelectorAll('iframe') : [];
          iframes.forEach(iframe => observer.observe(iframe));

          // If the node itself is an iframe
          if (node.tagName === 'IFRAME') {
            observer.observe(node);
          }
        }
      });
    });
  });

  // Watch for PhotoSwipe content being added to the DOM
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// generateAltTextFromFilename removed - now using AI-generated descriptions from Apps Script

// Show error message
function showError(message) {
  const galleryEl = document.getElementById("gallery");
  // Preserve header if it exists or add it
  const headerHtml = '<div class="section-header"><h2>Photos</h2></div>';
  galleryEl.innerHTML = headerHtml + `<p class="error">${message}</p>`;
}

// Handle share button click
function handleShare() {
  if (!currentAlbum) return;

  // Create shared URL
  const url = new URL(window.location.href);
  url.searchParams.set('shared', 'true');
  const sharedUrl = url.toString();

  // Copy to clipboard
  navigator.clipboard.writeText(sharedUrl).then(() => {
    showToast('Link copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy link:', err);
    showToast('Failed to copy link');
  });
}

// Show toast notification
function showToast(message) {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create new toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${message}</span>
    `;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
  initAlbum();

  // Add share button listener
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', handleShare);
  }
});
// Update album map theme dynamically
window.updateAlbumMapTheme = function (theme) {
  console.log('Updating album map theme to:', theme);

  if (!albumMap) return;

  // Find existing tile layer and remove it
  albumMap.eachLayer((layer) => {
    if (layer instanceof L.TileLayer) {
      albumMap.removeLayer(layer);
    }
  });

  // Add new tile layer
  createTileLayer(theme).addTo(albumMap);

  // Add labels if dark mode (Satellite)
  if (theme === 'dark') {
    createTileLayer('labels').addTo(albumMap);
  }

  // Re-add marker if needed (though Leaflet usually keeps overlays on top of tiles)
  // But just to be safe and ensure stacking context is correct
  albumMap.eachLayer((layer) => {
    if (layer instanceof L.Marker) {
      layer.bringToFront();
    }
  });
};
