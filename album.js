import { fetchAlbums } from './utils.js';
import { CONFIG } from './config.js';
import { createTileLayer, createMapOptions } from './mapUtils.js';

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
function initAlbumMap(retryCount = 0) {
  // Check if currentAlbum has coordinates
  if (!currentAlbum || !currentAlbum.lat || !currentAlbum.lng) {
    console.warn("Cannot initialize map: missing coordinates", {
      hasAlbum: !!currentAlbum,
      lat: currentAlbum?.lat,
      lng: currentAlbum?.lng
    });
    return;
  }

  const mapContainer = document.getElementById("album-map");

  // Check if container has dimensions (important for mobile)
  if (mapContainer && (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0)) {
    if (retryCount < 3) {
      console.log(`Map container not ready, retrying... (attempt ${retryCount + 1})`);
      setTimeout(() => initAlbumMap(retryCount + 1), 200);
      return;
    }
    console.warn("Map container still has no dimensions after retries");
  }

  // Clean up existing map if present
  if (albumMap) {
    albumMap.remove();
    albumMap = null;
  }

  try {
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

    // Force map to recalculate size after initialization (helps on mobile)
    setTimeout(() => {
      if (albumMap) {
        albumMap.invalidateSize();
      }
    }, 100);
  } catch (error) {
    console.error("Failed to initialize map:", error);
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
          // For images, use a smaller version to get dimensions (much faster!)
          // We only need the aspect ratio, not the full resolution
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
          // Use 800px version for dimension detection instead of 2000px
          // This is ~75% smaller and aspect ratio will be identical
          if (item.id) {
            img.src = `https://lh3.googleusercontent.com/d/${item.id}=s800`;
          } else {
            img.src = link.href;
          }
        }
      });
    }));

    // Small delay between batches to keep UI responsive
    if (i + batchSize < links.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Render gallery grid with true progressive row-by-row loading
function renderGallery() {
  const galleryEl = document.getElementById("gallery");
  galleryEl.innerHTML = "";

  // Estimate items per row based on typical grid (usually 3-4 on desktop)
  const ITEMS_PER_ROW = 4;
  const EAGER_LOAD_COUNT = ITEMS_PER_ROW; // First row loads eagerly (no lazy loading)

  let lastType = null;
  let itemCount = 0;

  // Create all gallery items and add them to DOM immediately
  // Each image will reveal itself when it loads (via onload handler)
  galleryItems.forEach((item, index) => {
    const result = createGalleryItem(item, index, lastType, itemCount, index < EAGER_LOAD_COUNT);

    if (result.header) {
      galleryEl.appendChild(result.header);
    }
    galleryEl.appendChild(result.element);

    lastType = result.isVideo;
    itemCount = result.itemCount;
  });
}

// Create a single gallery item element
// eagerLoad: if true, don't use lazy loading (for first row)
function createGalleryItem(item, index, lastType, itemCount, eagerLoad = false) {
  const isVideo = item.mime && item.mime.startsWith("video/");
  let header = null;

  // Add section header when we switch from images to videos
  if (lastType === false && isVideo === true) {
    header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = '<h2>Videos</h2>';
    itemCount = 0;
  } else if (lastType === null && isVideo === false) {
    header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = '<h2>Photos</h2>';
  } else if (lastType === null && isVideo === true) {
    header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = '<h2>Videos</h2>';
  }

  const galleryItem = document.createElement("a");
  galleryItem.href = item.src;
  galleryItem.className = "gallery-item gallery-item-hidden";
  galleryItem.setAttribute("data-index", index);
  galleryItem.setAttribute("role", "listitem");
  // Stagger animation delay based on position - creates waterfall effect
  galleryItem.style.animationDelay = `${(itemCount % 4) * 50}ms`;
  itemCount++;

  // Helper to reveal item when its media loads
  // Add minimum delay based on row position for visible progressive effect
  const revealItem = () => {
    // Calculate row number (assuming ~4 items per row)
    const rowNumber = Math.floor(index / 4);
    const minDelay = rowNumber * 100; // 100ms between rows minimum

    setTimeout(() => {
      galleryItem.classList.remove('gallery-item-hidden');
      galleryItem.classList.add('gallery-item-visible');
    }, minDelay);
  };

  if (isVideo) {
    const videoThumbnail = document.createElement("img");
    videoThumbnail.className = "gallery-media loading";

    // Use eager loading for first row, lazy for rest
    if (!eagerLoad) {
      videoThumbnail.setAttribute("loading", "lazy");
    }

    let thumbnailUrl = null;
    const fileIdMatch = item.src.match(/[?&]id=([^&]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w400`;
    }

    if (thumbnailUrl) {
      videoThumbnail.src = thumbnailUrl;
      videoThumbnail.alt = item.description || "";

      videoThumbnail.onload = () => {
        videoThumbnail.classList.remove('loading');
        galleryItem.classList.add('gallery-item-loaded');
        revealItem();
      };

      videoThumbnail.onerror = () => {
        videoThumbnail.style.display = 'none';
        const placeholder = document.createElement("div");
        placeholder.className = "gallery-media video-placeholder";
        galleryItem.insertBefore(placeholder, galleryItem.firstChild);
        galleryItem.classList.add('gallery-item-loaded');
        revealItem();
      };
    } else {
      videoThumbnail.style.display = 'none';
      const placeholder = document.createElement("div");
      placeholder.className = "gallery-media video-placeholder";
      galleryItem.appendChild(placeholder);
      // No image to load, reveal immediately
      requestAnimationFrame(revealItem);
    }

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
    const img = document.createElement("img");

    // Use smaller thumbnail (400px) for gallery grid - much faster loading
    if (item.id) {
      img.src = `https://drive.google.com/thumbnail?id=${item.id}&sz=w400`;
    } else {
      img.src = item.src;
    }

    img.alt = item.description || "";
    img.className = "gallery-media loading";

    // Use eager loading for first row, lazy for rest
    if (!eagerLoad) {
      img.setAttribute("loading", "lazy");
    }

    img.onload = () => {
      img.classList.remove('loading');
      galleryItem.classList.add('gallery-item-loaded');
      revealItem();
    };

    img.onerror = () => {
      console.warn(`Image failed to load: ${img.src}`);
      img.classList.remove('loading');
      galleryItem.classList.add('gallery-item-loaded');
      if (img.src.includes('drive.google.com/thumbnail') && item.src && item.src !== img.src) {
        img.src = item.src;
      } else {
        revealItem(); // Reveal even on error so item doesn't stay hidden
      }
    };

    galleryItem.appendChild(img);
  }

  return { element: galleryItem, header, isVideo, itemCount };
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

  // Add custom download button to toolbar
  lightbox.on('uiRegister', () => {
    lightbox.pswp.ui.registerElement({
      name: 'download-button',
      order: 8, // Position before zoom button (zoom is typically order 9)
      isButton: true,
      tagName: 'a',
      html: {
        isCustomSVG: true,
        inner: '<path d="M20.5 14.3 17.1 18V10h-2.2v7.9l-3.4-3.6L10 15.7l6 6.3 6-6.3-1.5-1.4ZM23 23H9v2h14" id="pswp__icn-download"/>',
        outlineID: 'pswp__icn-download'
      },
      onInit: (el, pswp) => {
        el.setAttribute('download', '');
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
        el.setAttribute('title', 'Download');

        pswp.on('change', () => {
          const currSlideData = pswp.currSlide.data;
          // Get the original source URL
          el.href = currSlideData.src || currSlideData.element?.href || '';
        });
      },
      onClick: async (event, el, pswp) => {
        event.preventDefault();
        const currSlideData = pswp.currSlide.data;
        const isVideo = currSlideData.element?.getAttribute('data-pswp-type') === 'video';

        // Get the source URL
        let sourceUrl = currSlideData.src || currSlideData.element?.href || '';

        // Get the filename from the gallery item
        const index = pswp.currIndex;
        const filename = galleryItems[index]?.name || 'download';

        // For videos, open Google Drive download page in new tab (can't fetch cross-origin)
        if (isVideo) {
          const fileIdMatch = sourceUrl.match(/[?&]id=([^&]+)/);
          if (fileIdMatch && fileIdMatch[1]) {
            window.open(`https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`, '_blank');
          }
          return;
        }

        // For images, fetch as blob and trigger download
        // This bypasses Google's redirect to their viewer
        try {
          // Show loading state
          el.style.opacity = '0.5';
          el.style.pointerEvents = 'none';

          const response = await fetch(sourceUrl);
          const blob = await response.blob();

          // Create object URL and trigger download
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up object URL after a short delay
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (error) {
          console.error('Download failed:', error);
          // Fallback: open in new tab
          window.open(sourceUrl, '_blank');
        } finally {
          // Reset loading state
          el.style.opacity = '';
          el.style.pointerEvents = '';
        }
      }
    });
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
