// Shared utility functions for the Family Travel Map

/**
 * Fetches albums from Google Apps Script or static file based on config
 * @returns {Promise<Array>} Array of album objects
 * @throws {Error} If fetch fails
 */
async function fetchAlbums() {
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

  return await response.json();
}
