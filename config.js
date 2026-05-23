// Configuration for Family Travel Map
//
// These values can be overridden via Vite env vars (e.g. a local .env file or
// Vercel project settings): VITE_APPS_SCRIPT_URL, VITE_MASTER_FOLDER_ID.
// Note: this is a static site, so anything here ships to the browser and is
// inherently public. Env vars help with rotation/hygiene, not secrecy.

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

export const CONFIG = {
  // Your Google Apps Script Web App URL
  // Get this from: Google Apps Script > Deploy > Web app URL
  APPS_SCRIPT_URL:
    env.VITE_APPS_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbwpZcOHQPdr2st43M5Riz3-d4Tq-gp00WEJR3QTgnbwsw-wtyHUkd4qbKFqL8FGodk/exec",

  // Your "Family Trips" master folder ID
  // Get this from Google Drive URL: https://drive.google.com/drive/folders/[FOLDER_ID]
  // Example: If your URL is https://drive.google.com/drive/folders/1ABC123xyz, use "1ABC123xyz"
  MASTER_FOLDER_ID:
    env.VITE_MASTER_FOLDER_ID || "1WMN1Y0Xa8tulV5zvP5tDawXz2uXCDxRL",
};
