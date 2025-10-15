// ============================================
// CONFIGURATION
// ============================================

// Add your Gemini API key here
// Get it from: https://makersuite.google.com/app/apikey
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// Set to true to enable AI-generated alt text for images without descriptions
const ENABLE_AI_ALT_TEXT = false;  // Disabled for performance

// ============================================
// MAIN FUNCTION
// ============================================

function doGet(e) {
  try {
    const action = e.parameter.action;

    // List all albums from master folder
    if (action === 'list') {
      const masterId = e.parameter.master;
      if (!masterId) {
        return ContentService.createTextOutput(JSON.stringify({
          error: 'No master folder ID provided'
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }
      return listAlbums(masterId);
    }

    // Get photos from specific folder (existing functionality)
    const folderId = e.parameter.folder;
    if (!folderId) {
      return ContentService.createTextOutput(JSON.stringify({
        error: 'No folder ID provided'
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }

    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const items = [];

    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();

      if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
        const fileId = file.getId();
        let fileDescription = file.getDescription() || '';

        // Generate AI description for images without manual description
        if (!fileDescription && mimeType.startsWith('image/') && ENABLE_AI_ALT_TEXT && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
          try {
            fileDescription = generateAIDescription(fileId);
          } catch (error) {
            Logger.log('AI description generation failed: ' + error);
            // Continue without AI description
          }
        }

        items.push({
          name: file.getName(),
          id: fileId,
          mime: mimeType,
          size: file.getSize(),
          created: file.getDateCreated(),
          description: fileDescription,  // Use as alt text
          src: mimeType.startsWith('image/')
            ? `https://lh3.googleusercontent.com/d/${fileId}=s2000`
            : `https://drive.google.com/uc?export=view&id=${fileId}`
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      items: items,
      count: items.length,
      folder: folder.getName()
    }))
    .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Lists all albums from the master "Family Trips" folder
 * Parses folder descriptions for metadata in format: "lat,lng | date | description"
 * Example: "31.7833,35.0000 | October 2025 | Hiking in the forest"
 */
function listAlbums(masterId) {
  try {
    const masterFolder = DriveApp.getFolderById(masterId);
    const subfolders = masterFolder.getFolders();
    const albums = [];

    while (subfolders.hasNext()) {
      const folder = subfolders.next();
      const folderId = folder.getId();
      const folderName = folder.getName();
      const description = folder.getDescription() || '';

      // Parse folder description: "lat,lng | date | description"
      // If no description, use defaults
      let lat = 31.7683; // Default to Jerusalem
      let lng = 35.2137;
      let date = '';
      let albumDesc = '';

      if (description) {
        const parts = description.split('|').map(p => p.trim());

        // Parse coordinates from first part
        if (parts[0]) {
          const coords = parts[0].split(',').map(c => parseFloat(c.trim()));
          if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            lat = coords[0];
            lng = coords[1];
          }
        }

        // Parse date from second part
        if (parts[1]) {
          date = parts[1];
        }

        // Parse description from third part
        if (parts[2]) {
          albumDesc = parts[2];
        }
      }

      // Extract date from folder name if not in description
      // Pattern: "Name Month Year" or "Name Mon YYYY"
      if (!date) {
        const dateMatch = folderName.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}/i);
        if (dateMatch) {
          date = dateMatch[0];
        }
      }

      // Generate album ID from folder name
      const albumId = folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      // Get cover image (first image in folder) - optimized
      let coverUrl = null;
      try {
        // Use searchFiles for faster filtering - only get first image file
        const imageQuery = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
        const imageFiles = DriveApp.searchFiles(imageQuery);
        if (imageFiles.hasNext()) {
          const firstImage = imageFiles.next();
          coverUrl = `https://lh3.googleusercontent.com/d/${firstImage.getId()}=s2000`;
        }
      } catch (e) {
        Logger.log('Error getting cover image: ' + e);
        // Continue without cover
      }

      albums.push({
        id: albumId,
        title: folderName,
        date: date,
        description: albumDesc,
        lat: lat,
        lng: lng,
        folderId: folderId,
        cover: coverUrl
      });
    }

    return ContentService.createTextOutput(JSON.stringify(albums))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Generates an AI description for an image using Google Gemini API
 * @param {string} fileId - The Google Drive file ID
 * @returns {string} Generated description or empty string on error
 */
function generateAIDescription(fileId) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return '';
  }

  try {
    // Get image data from Google Drive
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const imageBytes = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType();

    // Prepare Gemini API request
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const payload = {
      contents: [{
        parts: [
          {
            text: "Generate a concise, descriptive alt text for this family photo (1-2 sentences). Focus on what's visible: people, activities, location, and setting. Be specific but brief."
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBytes
            }
          }
        ]
      }]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      Logger.log('Gemini API error: ' + response.getContentText());
      return '';
    }

    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      const description = result.candidates[0].content.parts[0].text.trim();
      Logger.log('Generated description: ' + description);
      return description;
    }

    return '';

  } catch (error) {
    Logger.log('Error generating AI description: ' + error.toString());
    return '';
  }
}
