// ============================================
// CONFIGURATION
// ============================================

// Add your Gemini API key here
// Get it from: https://makersuite.google.com/app/apikey
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// Set to true to enable AI-generated alt text for images without descriptions
const ENABLE_AI_ALT_TEXT = false;  // Disabled - enable after testing

// Shared secret that gates all write actions (doPost). Set this to a long
// random string and enter the SAME value in the admin page. Keep it private:
// anyone with this token + the master folder ID can edit your albums.
const ADMIN_TOKEN = "CHANGE_ME_SET_A_LONG_RANDOM_SECRET";

// Master folder used when creating brand-new albums from the admin page.
const ADMIN_MASTER_FOLDER_ID = "1WMN1Y0Xa8tulV5zvP5tDawXz2uXCDxRL";

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

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
    const filesToProcess = []; // Track files needing AI descriptions

    while (files.hasNext()) {
      const file = files.next();
      const mimeType = file.getMimeType();

      if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
        const fileId = file.getId();
        let fileDescription = file.getDescription() || '';

        // Track images that need AI descriptions (but don't block on it)
        if (!fileDescription && mimeType.startsWith('image/') && ENABLE_AI_ALT_TEXT && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
          filesToProcess.push(fileId);
        }

        items.push({
          name: file.getName(),
          id: fileId,
          mime: mimeType,
          size: file.getSize(),
          created: file.getDateCreated(),
          description: fileDescription,  // Use as alt text (may be empty first time)
          src: mimeType.startsWith('image/')
            ? `https://lh3.googleusercontent.com/d/${fileId}=s2000`
            : `https://drive.google.com/uc?export=view&id=${fileId}`
        });
      }
    }

    // Process AI descriptions only if enabled and we have files to process
    if (ENABLE_AI_ALT_TEXT && filesToProcess.length > 0) {
      const MAX_AI_DESCRIPTIONS_PER_REQUEST = 3;
      let processedCount = 0;

      for (const fileId of filesToProcess) {
        if (processedCount >= MAX_AI_DESCRIPTIONS_PER_REQUEST) break;

        try {
          const description = generateAIDescription(fileId);
          if (description) {
            const item = items.find(i => i.id === fileId);
            if (item) {
              item.description = description;
            }
            processedCount++;
          }
        } catch (error) {
          Logger.log('AI description failed for ' + fileId + ': ' + error);
        }
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
      let coverId = '';
      let type = 'travel';

      if (description) {
        // Format: "lat,lng | date | description | coverFileId | type" (last two optional)
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

        // Parse explicit cover image file ID from fourth part
        if (parts[3]) {
          coverId = parts[3];
        }

        // Parse album type from fifth part ('event' or 'travel'); default travel
        if (parts[4] && parts[4].toLowerCase() === 'event') {
          type = 'event';
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

      // Get cover image: use explicit cover ID if set, else first image in folder
      let coverUrl = null;
      try {
        if (coverId) {
          coverUrl = `https://lh3.googleusercontent.com/d/${coverId}=s2000`;
        } else {
          // Use searchFiles for faster filtering - only get first image file
          const imageQuery = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
          const imageFiles = DriveApp.searchFiles(imageQuery);
          if (imageFiles.hasNext()) {
            const firstImage = imageFiles.next();
            coverUrl = `https://lh3.googleusercontent.com/d/${firstImage.getId()}=s2000`;
          }
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
        cover: coverUrl,
        type: type
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

      // Save description to Google Drive file so it persists for future views
      if (description) {
        file.setDescription(description);
        Logger.log('Saved description to file: ' + description);
      }

      return description;
    }

    return '';

  } catch (error) {
    Logger.log('Error generating AI description: ' + error.toString());
    return '';
  }
}

// ============================================
// WRITE API (admin panel) — every action is gated by ADMIN_TOKEN
// ============================================
//
// The admin page POSTs with Content-Type text/plain (a "simple" request that
// avoids a CORS preflight Apps Script cannot answer) and a JSON string body:
//   { "token": "...", "action": "setMeta", ... }
// Deploy the web app as "Execute as: Me" and "Who has access: Anyone".

function doPost(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    if (!ADMIN_TOKEN || ADMIN_TOKEN === 'CHANGE_ME_SET_A_LONG_RANDOM_SECRET') {
      return jsonResponse({ ok: false, error: 'Admin token is not configured in the script.' });
    }
    if (body.token !== ADMIN_TOKEN) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }

    switch (body.action) {
      case 'setMeta': return adminSetMeta(body);
      case 'rename': return adminRename(body);
      case 'setSharing': return adminSetSharing(body);
      case 'createAlbum': return adminCreateAlbum(body);
      case 'makeAllPublic': return adminMakeAllPublic(body);
      case 'uploadFile': return adminUploadFile(body);
      default: return jsonResponse({ ok: false, error: 'Unknown action: ' + body.action });
    }
  } catch (error) {
    return jsonResponse({ ok: false, error: error.toString() });
  }
}

// Build the folder-description metadata string from individual fields:
// "lat,lng | date | description | coverFileId | type" (coords/cover optional; type
// defaults to travel and is only written for events).
function buildMetaDescription(lat, lng, date, description, coverId, type) {
  const hasCoords = lat !== '' && lat != null && lng !== '' && lng != null;
  const coords = hasCoords ? `${lat},${lng}` : '';
  const parts = [coords, date || '', description || ''];
  const isEvent = (type || '').toLowerCase() === 'event';
  // coverId is slot 4 and type is slot 5; keep slot 4 present (even empty) when type is set.
  if (coverId || isEvent) parts.push(coverId || '');
  if (isEvent) parts.push('event');
  return parts.join(' | ');
}

function adminSetMeta(body) {
  const folder = DriveApp.getFolderById(body.folderId);
  folder.setDescription(
    buildMetaDescription(body.lat, body.lng, body.date, body.description, body.coverId, body.type)
  );
  return jsonResponse({ ok: true, folderId: body.folderId });
}

function adminRename(body) {
  const folder = DriveApp.getFolderById(body.folderId);
  const title = (body.title || '').trim();
  if (!title) return jsonResponse({ ok: false, error: 'Title is required' });
  folder.setName(title);
  return jsonResponse({ ok: true, folderId: body.folderId, title: title });
}

// Make the folder AND the media files inside it public (or private). File-level
// sharing is required so the lh3.googleusercontent.com thumbnail links work.
function adminSetSharing(body) {
  const folder = DriveApp.getFolderById(body.folderId);
  const makePublic = body.public !== false; // default: make public
  const access = makePublic ? DriveApp.Access.ANYONE_WITH_LINK : DriveApp.Access.PRIVATE;
  const permission = makePublic ? DriveApp.Permission.VIEW : DriveApp.Permission.NONE;

  folder.setSharing(access, permission);

  let filesUpdated = 0;
  const files = folder.getFiles();
  while (files.hasNext()) {
    try {
      files.next().setSharing(access, permission);
      filesUpdated++;
    } catch (err) {
      Logger.log('Sharing change failed for a file: ' + err);
    }
  }
  return jsonResponse({ ok: true, folderId: body.folderId, public: makePublic, filesUpdated: filesUpdated });
}

function adminCreateAlbum(body) {
  const master = DriveApp.getFolderById(body.masterId || ADMIN_MASTER_FOLDER_ID);
  const title = (body.title || '').trim();
  if (!title) return jsonResponse({ ok: false, error: 'Title is required' });

  const folder = master.createFolder(title);
  folder.setDescription(
    buildMetaDescription(body.lat, body.lng, body.date, body.description, body.coverId, body.type)
  );
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return jsonResponse({
    ok: true,
    folderId: folder.getId(),
    title: title,
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  });
}

function adminMakeAllPublic(body) {
  const master = DriveApp.getFolderById(body.masterId || ADMIN_MASTER_FOLDER_ID);
  const subfolders = master.getFolders();
  let foldersUpdated = 0;
  while (subfolders.hasNext()) {
    try {
      const folder = subfolders.next();
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      foldersUpdated++;
      const files = folder.getFiles();
      while (files.hasNext()) {
        try {
          files.next().setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (err) {
          Logger.log('File sharing failed: ' + err);
        }
      }
    } catch (err) {
      Logger.log('Folder sharing failed: ' + err);
    }
  }
  return jsonResponse({ ok: true, foldersUpdated: foldersUpdated });
}

// Upload one small base64-encoded file into an album folder, then make it
// public. Apps Script payload/runtime limits make this fine for a few photos
// at a time; large batches should still be added via Drive directly.
function adminUploadFile(body) {
  if (!body.dataBase64 || !body.filename) {
    return jsonResponse({ ok: false, error: 'filename and dataBase64 are required' });
  }
  const folder = DriveApp.getFolderById(body.folderId);
  const bytes = Utilities.base64Decode(body.dataBase64);
  const blob = Utilities.newBlob(bytes, body.mimeType || 'application/octet-stream', body.filename);
  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    Logger.log('Could not set file sharing: ' + err);
  }
  return jsonResponse({ ok: true, fileId: file.getId(), name: file.getName() });
}
