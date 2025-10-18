// Shared utility functions for the Family Travel Map

/**
 * Fetches albums dynamically from Google Apps Script
 * @returns {Promise<Array>} Array of album objects
 * @throws {Error} If fetch fails
 */
async function fetchAlbums() {
  const response = await fetch(
    `${CONFIG.APPS_SCRIPT_URL}?action=list&master=${CONFIG.MASTER_FOLDER_ID}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch albums: ${response.status}`);
  }

  return await response.json();
}
