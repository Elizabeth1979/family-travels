// Shared map utilities and configuration

// World bounds to prevent grey areas
const WORLD_BOUNDS = L.latLngBounds(
  L.latLng(-90, -180),  // Southwest corner
  L.latLng(90, 180)     // Northeast corner
);

// Common tile layer configuration
const TILE_LAYER_CONFIG = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  options: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    minZoom: 2,
    noWrap: true
  }
};

// Common map options
const BASE_MAP_OPTIONS = {
  maxBounds: WORLD_BOUNDS,
  maxBoundsViscosity: 1.0  // Prevents panning outside bounds
};

/**
 * Create a tile layer with default configuration
 * @returns {L.TileLayer} Configured tile layer
 */
function createTileLayer() {
  return L.tileLayer(TILE_LAYER_CONFIG.url, TILE_LAYER_CONFIG.options);
}

/**
 * Create map options by merging base options with custom options
 * @param {Object} customOptions - Custom options to merge
 * @returns {Object} Merged map options
 */
function createMapOptions(customOptions = {}) {
  return { ...BASE_MAP_OPTIONS, ...customOptions };
}
