// Configuration for Family Travel Map
// Update these values with your Google Apps Script deployment URL and master folder ID

const CONFIG = {
  // Your Google Apps Script Web App URL
  // Get this from: Google Apps Script > Deploy > Web app URL
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbwpZcOHQPdr2st43M5Riz3-d4Tq-gp00WEJR3QTgnbwsw-wtyHUkd4qbKFqL8FGodk/exec",

  // Your "Family Trips" master folder ID
  // Get this from Google Drive URL: https://drive.google.com/drive/folders/[FOLDER_ID]
  // Example: If your URL is https://drive.google.com/drive/folders/1ABC123xyz, use "1ABC123xyz"
  MASTER_FOLDER_ID: "1WMN1Y0Xa8tulV5zvP5tDawXz2uXCDxRL",

  // Set to false to use static albums.json, true to fetch dynamically from Google Drive
  USE_DYNAMIC_ALBUMS: true,  // Ready to use dynamic albums!
};
