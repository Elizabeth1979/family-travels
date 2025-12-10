// Shared map utilities and configuration

// =============================================================================
// LEAFLET CONFIGURATION
// =============================================================================

// =============================================================================
// LEAFLET CONFIGURATION
// =============================================================================

// World bounds to prevent grey areas
const WORLD_BOUNDS_LEAFLET = {
  southWest: [-90, -180],
  northEast: [90, 180]
};

// Map Providers Configuration
export const MAP_PROVIDERS = {
  // Light Mode Default (Esri NatGeo World Map)
  light: {
    id: 'esri_natgeo',
    name: 'Esri NatGeo World Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC',
      maxZoom: 16
    }
  },
  // Dark Mode Default (Esri World Imagery / Satellite)
  dark: {
    id: 'esri_world_imagery',
    name: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18
    }
  },
  // Overlay: Place Labels
  labels: {
    id: 'esri_labels',
    name: 'Place Labels',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: '',
      pane: 'shadowPane' // Use a different pane to ensure it stays on top of base layers but below markers
    }
  },
  // Alternative Light (Esri World Street Map)
  esri_world_street_map: {
    id: 'esri_world_street_map',
    name: 'Esri World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
    }
  },
  // Additional Light (Esri World Topo Map)
  esri_world_topo_map: {
    id: 'esri_world_topo_map',
    name: 'Esri World Topo Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    }
  }
};

/**
 * Get all configured tile layers
 * @returns {Object} Object containing baseMaps and overlayMaps for L.control.layers
 */
export function getLeafletLayers() {
  if (typeof L === 'undefined') return null;

  const baseMaps = {
    [MAP_PROVIDERS.light.name]: L.tileLayer(MAP_PROVIDERS.light.url, MAP_PROVIDERS.light.options),
    [MAP_PROVIDERS.dark.name]: L.tileLayer(MAP_PROVIDERS.dark.url, MAP_PROVIDERS.dark.options),
    [MAP_PROVIDERS.esri_world_street_map.name]: L.tileLayer(MAP_PROVIDERS.esri_world_street_map.url, MAP_PROVIDERS.esri_world_street_map.options),
    [MAP_PROVIDERS.esri_world_topo_map.name]: L.tileLayer(MAP_PROVIDERS.esri_world_topo_map.url, MAP_PROVIDERS.esri_world_topo_map.options)
  };

  const overlayMaps = {
    [MAP_PROVIDERS.labels.name]: L.tileLayer(MAP_PROVIDERS.labels.url, MAP_PROVIDERS.labels.options)
  };

  return { baseMaps, overlayMaps };
}

/**
 * Create a specific Leaflet tile layer
 * @param {string} providerKey - Key from MAP_PROVIDERS (e.g., 'light', 'dark')
 * @returns {L.TileLayer} Configured tile layer
 */
function createTileLayer(providerKey = 'light') {
  if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded');
    return null;
  }

  const provider = MAP_PROVIDERS[providerKey] || MAP_PROVIDERS.light;
  return L.tileLayer(provider.url, provider.options);
}

/**
 * Create Leaflet map options by merging base options with custom options
 * @param {Object} customOptions - Custom options to merge
 * @returns {Object} Merged map options
 */
export function createLeafletMapOptions(customOptions = {}) {
  if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded');
    return customOptions;
  }

  const bounds = L.latLngBounds(
    L.latLng(WORLD_BOUNDS_LEAFLET.southWest[0], WORLD_BOUNDS_LEAFLET.southWest[1]),
    L.latLng(WORLD_BOUNDS_LEAFLET.northEast[0], WORLD_BOUNDS_LEAFLET.northEast[1])
  );

  return {
    maxBounds: bounds,
    maxBoundsViscosity: 1.0,
    ...customOptions
  };
}

// =============================================================================
// MAPLIBRE GL CONFIGURATION
// =============================================================================

// MapLibre GL style URLs
const MAPLIBRE_STYLES = {
  outdoor: 'https://demotiles.maplibre.org/style.json',
  streets: 'https://demotiles.maplibre.org/style.json',
  satellite: 'https://demotiles.maplibre.org/style.json'
};

/**
 * Create MapLibre GL style URL or object
 * @param {string} styleType - Type of style (outdoor, streets, satellite)
 * @returns {string} Style URL
 */
function createMapStyle(styleType = 'outdoor') {
  return MAPLIBRE_STYLES[styleType] || MAPLIBRE_STYLES.outdoor;
}

/**
 * Create MapLibre GL map options
 * @param {Object} customOptions - Custom options to merge
 * @returns {Object} MapLibre GL map options
 */
function createMapLibreOptions(customOptions = {}) {
  return {
    container: 'map',
    style: createMapStyle('outdoor'),
    center: [0, 0],
    zoom: 2,
    maxBounds: [[-180, -90], [180, 90]],
    maxPitch: 85,
    ...customOptions
  };
}

/**
 * Create custom marker element for MapLibre GL
 * @param {string} color - Marker color (default: #FF6B6B)
 * @returns {HTMLElement} Marker element
 */
function createMarkerElement(color = '#FF6B6B') {
  const el = document.createElement('div');
  el.className = 'custom-marker';
  el.innerHTML = `
    <svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26c0-8.837-7.163-16-16-16z"
            fill="${color}"
            stroke="white"
            stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>
  `;
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Map marker');
  return el;
}

/**
 * MapLibre GL custom control for style switching
 */
class MapStyleControl {
  constructor(onStyleChange) {
    this.onStyleChange = onStyleChange;
  }

  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group map-style-control';

    const styles = [
      { id: 'outdoor', label: 'Outdoor', title: 'Outdoor map style' },
      { id: 'streets', label: 'Streets', title: 'Streets map style' },
      { id: 'satellite', label: 'Satellite', title: 'Satellite map style' }
    ];

    styles.forEach(style => {
      const btn = document.createElement('button');
      btn.className = 'map-style-btn';
      btn.textContent = style.label;
      btn.title = style.title;
      btn.setAttribute('aria-label', style.title);
      btn.onclick = () => {
        if (this.onStyleChange) {
          this.onStyleChange(style.id);
        }
        // Update active state
        this._container.querySelectorAll('.map-style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };

      if (style.id === 'outdoor') {
        btn.classList.add('active');
      }

      this._container.appendChild(btn);
    });

    return this._container;
  }

  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

// =============================================================================
// MAP TYPE SELECTION (ACCESSIBLE VS ENHANCED)
// =============================================================================

/**
 * Get user's map preference from localStorage
 * @returns {string} 'globe', 'accessible', or 'enhanced'
 */
export function getMapPreference() {
  // Check explicit user choice
  const saved = localStorage.getItem('mapStyle');
  if (saved === 'globe' || saved === 'accessible' || saved === 'enhanced') {
    return saved;
  }

  // Check system preferences for reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'accessible';
  }

  // Check WebGL support
  const hasWebGL = (() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  })();

  // Default to globe if WebGL supported, otherwise accessible
  return hasWebGL ? 'globe' : 'accessible';
}

/**
 * Save user's map preference
 * @param {string} preference - 'globe', 'accessible', or 'enhanced'
 */
export function saveMapPreference(preference) {
  localStorage.setItem('mapStyle', preference);
}

/**
 * Load Leaflet library dynamically
 * @returns {Promise<void>}
 */
export async function loadLeaflet() {
  // Check if already loaded
  if (typeof L !== 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Load CSS
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    css.crossOrigin = '';
    document.head.appendChild(css);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Leaflet'));
    document.head.appendChild(script);
  });
}

/**
 * Unified createMapOptions that delegates to library-specific function
 * Used by map.js for backwards compatibility
 * @param {Object} customOptions - Custom options to merge
 * @returns {Object} Map options for current library
 */
function createMapOptions(customOptions = {}) {
  // Check which library is loaded or should be loaded
  const preference = getMapPreference();

  if (preference === 'accessible' && typeof L !== 'undefined') {
    return createLeafletMapOptions(customOptions);
  } else if (typeof maplibregl !== 'undefined') {
    return createMapLibreOptions(customOptions);
  }

  // Default to MapLibre options
  return createMapLibreOptions(customOptions);
}
