import { CONFIG } from './config.js';

/**
 * Fetches albums dynamically from Google Apps Script with caching
 * @returns {Promise<Array>} Array of album objects
 * @throws {Error} If fetch fails
 */
export async function fetchAlbums() {
  const CACHE_KEY = 'family_travel_albums';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Try to get from cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // If cache is still valid, return it immediately
      if (now - timestamp < CACHE_DURATION) {
        console.log('Using cached albums data');
        return data;
      }
    }
  } catch (e) {
    console.warn('Cache read failed:', e);
  }

  // Fetch fresh data
  const response = await fetch(
    `${CONFIG.APPS_SCRIPT_URL}?action=list&master=${CONFIG.MASTER_FOLDER_ID}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch albums: ${response.status}`);
  }

  const data = await response.json();

  // Cache the result
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Cache write failed:', e);
  }

  return data;
}


