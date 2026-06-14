// ============================================
// CONFIGURATION
// ============================================

// Add your Gemini API key here
// Get it from: https://makersuite.google.com/app/apikey
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// Gemini model used for alt-text generation. NOTE: gemini-1.5-flash is being
// retired by Google — if generateContent calls start returning 404/"model not
// found", change this to a current Flash model (e.g. gemini-2.5-flash).
const GEMINI_MODEL = "gemini-2.0-flash";

// Optional: tell Gemini who the family members are so it can NAME them in
// descriptions (instead of writing "a woman and a young boy"). Leave the string
// empty for generic descriptions. One person per line, "Name — details":
//   const FAMILY_ROSTER =
//     "Elli — mother, ~45, glasses, dark hair usually in a bun.\n" +
//     "Daniel — son, ~9, blond, often missing a front tooth.\n" +
//     "Jonathan — toddler son, ~3.";
const FAMILY_ROSTER = "";

// Set to true to enable AI-generated alt text for images without descriptions
const ENABLE_AI_ALT_TEXT = false;  // Disabled - enable after testing

// Shared secret that gates all write actions (doPost). Stored in Script
// Properties (Project Settings → Script Properties → ADMIN_TOKEN), NOT in this
// file, so the secret never lands in source control. Enter the SAME value in
// the admin page. Anyone with this token + the master folder ID can edit albums.
const ADMIN_TOKEN = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');

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
 * Lists all albums from the master "Family Trips" folder.
 * Parses folder descriptions for metadata in format:
 *   "lat,lng | date | description | coverFileId | type"
 *
 * Performance: uses the advanced Drive service (Drive.Files.list, Drive API v3)
 * so the whole listing is ~2 Drive calls total instead of ~2 per album. Old
 * DriveApp code made one searchFiles() round-trip PER folder just to find a
 * cover image, which made this 6-9s with a dozen+ albums.
 *
 * REQUIRES the "Drive API" advanced service enabled in the editor
 * (Services → + → Drive API → v3). Without it, `Drive` is undefined and the
 * call throws; the album list returns an { error } payload until it's enabled.
 */
function listAlbums(masterId) {
  try {
    // 1) One (paginated) call: every album subfolder WITH its description.
    const folders = listChildFolders(masterId);

    const albums = [];
    const foldersNeedingCover = []; // folderIds with no explicit cover stored

    folders.forEach(folder => {
      const album = parseAlbumFolder(folder.id, folder.name, folder.description || '');
      albums.push(album);
      if (!album.cover) {
        foldersNeedingCover.push(folder.id);
      }
    });

    // 2) One (chunked/paginated) batched call: the cover image for every folder
    //    that lacks an explicit one. Map each image back to its parent folder.
    if (foldersNeedingCover.length) {
      const coverByFolder = findFirstImagePerFolder(foldersNeedingCover);
      albums.forEach(album => {
        const imageId = coverByFolder[album.folderId];
        if (!album.cover && imageId) {
          album.cover = `https://lh3.googleusercontent.com/d/${imageId}=s2000`;
        }
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
 * Fetch all non-trashed subfolders of a parent, with id/name/description, in as
 * few Drive API calls as possible (1 call per 1000 folders).
 */
function listChildFolders(parentId) {
  const out = [];
  let pageToken = null;
  do {
    const resp = Drive.Files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name, description)',
      pageSize: 1000,
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    (resp.files || []).forEach(f => out.push(f));
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return out;
}

/**
 * Given a list of folder IDs, return a map { folderId: firstImageFileId } using
 * batched Drive queries (up to ~30 folders per query to keep the query string
 * sane). "First" matches the old behavior: whichever image the API returns
 * first for that folder.
 */
function findFirstImagePerFolder(folderIds) {
  const coverByFolder = {};
  const CHUNK = 30;
  for (let i = 0; i < folderIds.length; i += CHUNK) {
    const chunk = folderIds.slice(i, i + CHUNK);
    const parentsClause = chunk.map(id => `'${id}' in parents`).join(' or ');
    const q = `(${parentsClause}) and mimeType contains 'image/' and trashed = false`;
    let pageToken = null;
    do {
      const resp = Drive.Files.list({
        q: q,
        fields: 'nextPageToken, files(id, parents)',
        pageSize: 1000,
        pageToken: pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      (resp.files || []).forEach(file => {
        (file.parents || []).forEach(parentId => {
          if (!coverByFolder[parentId]) coverByFolder[parentId] = file.id;
        });
      });
      pageToken = resp.nextPageToken;
    } while (pageToken);
  }
  return coverByFolder;
}

/**
 * Turn one album folder's name + description into the album object the front end
 * expects. `cover` is only set here when an explicit coverFileId is stored;
 * otherwise it's left null for listAlbums() to fill in via a batched lookup.
 */
function parseAlbumFolder(folderId, folderName, description) {
  // Parse folder description: "lat,lng | date | description | coverFileId | type"
  // If no description, use defaults.
  let lat = 31.7683; // Default to Jerusalem
  let lng = 35.2137;
  let date = '';
  let albumDesc = '';
  let coverId = '';
  let type = 'travel';

  if (description) {
    const parts = description.split('|').map(p => p.trim());

    // Coordinates (first part)
    if (parts[0]) {
      const coords = parts[0].split(',').map(c => parseFloat(c.trim()));
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        lat = coords[0];
        lng = coords[1];
      }
    }

    if (parts[1]) date = parts[1];                 // date (second part)
    if (parts[2]) albumDesc = parts[2];            // description (third part)
    if (parts[3]) coverId = parts[3];              // explicit cover file ID (fourth)
    if (parts[4] && parts[4].toLowerCase() === 'event') type = 'event'; // type (fifth)
  }

  // Extract date from folder name if not in description ("Name Month Year").
  if (!date) {
    const dateMatch = folderName.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}/i);
    if (dateMatch) date = dateMatch[0];
  }

  return {
    id: folderName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: folderName,
    date: date,
    description: albumDesc,
    lat: lat,
    lng: lng,
    folderId: folderId,
    cover: coverId ? `https://lh3.googleusercontent.com/d/${coverId}=s2000` : null,
    type: type
  };
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
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Base prompt, plus an optional family roster so Gemini can name people it
    // recognizes. Without a roster it falls back to generic descriptions.
    let promptText = "Generate a concise, descriptive alt text for this family photo (1-2 sentences). Focus on what's visible: people, activities, location, and setting. Be specific but brief.";
    if (FAMILY_ROSTER) {
      promptText += "\n\nThese are the family members who may appear in the photo. Use these names when you are confident a person matches the description; if you are unsure, describe them generically instead of guessing a name:\n" + FAMILY_ROSTER;
    }

    const payload = {
      contents: [{
        parts: [
          {
            text: promptText
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

// ============================================
// BATCH ALT-TEXT BACKFILL  (run from the editor, not the web)
// ============================================
//
// Fills in AI descriptions for every image in ONE album folder and saves each
// one onto the Drive file (so the album page picks them up automatically).
//
// How to run:
//   1. Put a real key in GEMINI_API_KEY (top of this file).
//   2. (Optional) fill in FAMILY_ROSTER so people are named instead of "a woman".
//   3. Paste the album's Drive folder ID into BACKFILL_FOLDER_ID below.
//   4. In the editor, pick `backfillAlbumDescriptions` from the function
//      dropdown and click Run. Watch progress in View → Logs (Executions).
//
// It SKIPS images that already have a description, so if it stops at Apps
// Script's ~6-minute limit, just run it again to continue where it left off.
// Set OVERWRITE_EXISTING = true to regenerate descriptions that already exist.
//
// ENABLE_AI_ALT_TEXT does NOT need to be true for this — that flag only controls
// the slow 3-at-a-time backfill during normal page loads.

const BACKFILL_FOLDER_ID = "PASTE_ALBUM_FOLDER_ID_HERE";
const OVERWRITE_EXISTING = false;
const BACKFILL_DELAY_MS = 1500; // pause between Gemini calls to respect rate limits

function backfillAlbumDescriptions() {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    Logger.log('Set GEMINI_API_KEY at the top of the file first.');
    return;
  }
  if (!BACKFILL_FOLDER_ID || BACKFILL_FOLDER_ID === 'PASTE_ALBUM_FOLDER_ID_HERE') {
    Logger.log('Set BACKFILL_FOLDER_ID to the album folder ID first.');
    return;
  }

  const folder = DriveApp.getFolderById(BACKFILL_FOLDER_ID);
  const files = folder.getFiles();

  const start = Date.now();
  const MAX_RUN_MS = 5 * 60 * 1000; // stop before the ~6-min Apps Script cap
  let generated = 0, skipped = 0, failed = 0;

  while (files.hasNext()) {
    if (Date.now() - start > MAX_RUN_MS) {
      Logger.log('Approaching the time limit — stopping. Run again to continue.');
      break;
    }

    const file = files.next();
    if (!file.getMimeType().startsWith('image/')) continue;

    if (!OVERWRITE_EXISTING && (file.getDescription() || '')) {
      skipped++;
      continue;
    }

    try {
      // generateAIDescription() saves the result onto the file itself.
      const description = generateAIDescription(file.getId());
      if (description) {
        generated++;
        Logger.log('OK  ' + file.getName() + ' -> ' + description);
      } else {
        failed++;
        Logger.log('NO  ' + file.getName() + ' (empty/blocked response)');
      }
    } catch (err) {
      failed++;
      Logger.log('ERR ' + file.getName() + ': ' + err);
    }

    Utilities.sleep(BACKFILL_DELAY_MS);
  }

  Logger.log(`Backfill finished for "${folder.getName()}": generated=${generated}, skipped=${skipped}, failed=${failed}.`);
}
