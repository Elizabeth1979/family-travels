# Quick Setup Guide - Dynamic Album Updates

This guide will help you set up automatic album updates from Google Drive.

## What Changed?

Previously, you had to manually edit `albums.json` every time you added a new album. Now, the site automatically reads all folders from your "Family Trips" Google Drive folder!

## One-Time Setup

### Step 1: Get Your Master Folder ID

1. Open your "Family Trips" folder in Google Drive
2. Look at the URL in your browser:
   ```
   https://drive.google.com/drive/folders/1ABC123xyz456DEF
   ```
3. Copy the part after `/folders/` - that's your folder ID: `1ABC123xyz456DEF`

### Step 2: Get Gemini API Key (for AI-generated alt text)

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the API key - you'll need it in the next step

### Step 3: Update Google Apps Script

1. Go to [Google Apps Script](https://script.google.com/)
2. Open your existing script project
3. **Replace all the code** with the new code from `google-apps-script.js` in this repository
4. **At the top of the script**, find these lines:
   ```javascript
   const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
   const ENABLE_AI_ALT_TEXT = true;
   ```
5. **Replace `YOUR_GEMINI_API_KEY_HERE`** with your actual Gemini API key from Step 2
6. Keep `ENABLE_AI_ALT_TEXT = true` to enable AI descriptions
7. Click "Deploy" > "Manage deployments"
8. Click the edit icon (pencil) on your existing deployment
9. Change "Version" to "New version"
10. Click "Deploy"
11. Make sure you copy the Web App URL (should still be the same)

### Step 4: Update config.js

1. Open `config.js` in this project
2. Update these two values:
   ```javascript
   const CONFIG = {
     APPS_SCRIPT_URL: "YOUR_SCRIPT_URL_HERE",  // Paste your Web App URL
     MASTER_FOLDER_ID: "YOUR_FOLDER_ID_HERE",   // Paste your folder ID from Step 1
     USE_DYNAMIC_ALBUMS: true                    // Keep this as true
   };
   ```

### Step 5: Deploy to Vercel

1. Commit and push your changes to GitHub
2. Vercel will automatically redeploy your site
3. Done!

## Adding New Albums (Super Easy!)

### For Each New Trip:

1. **Create a folder** inside "Family Trips" with your trip photos
   - Example: "Eshtaol forest"

2. **Add a description** to the folder with location info:
   - Right-click the folder in Google Drive
   - Click "View details" (or "i" icon in the top-right)
   - In the "Description" field, add:
     ```
     31.7833,35.0000 | October 2025 | Beautiful forest hike
     ```

3. **That's it!** The album appears on your site immediately.

### Optional: Add or Edit Alt Text for Photos

**AI-Generated Alt Text (Automatic):**

- Photos without descriptions will automatically get AI-generated alt text
- Gemini AI analyzes each image and creates a description
- Example: "A family of four hiking on a mountain trail surrounded by pine trees"

**Manual Alt Text (Override AI):**

If you want to customize the description for specific photos:

1. **Right-click on a photo** in Google Drive
2. **Click "View details"** or click the info icon (ℹ️)
3. **Add a description** like:
   - "Family hiking on the trail"
   - "Sunset view from the mountain"
   - "Children playing by the waterfall"
4. Your manual description overrides the AI-generated one

**Priority:**

1. Manual description (if you added one) ✓
2. AI-generated description (automatic)
3. Filename (fallback if AI is disabled)

## Folder Description Format

```
latitude,longitude | date | description
```

- **Coordinates**: Required (get from Google Maps by right-clicking)
- **Date**: Optional (will extract from folder name if missing)
- **Description**: Optional (shows on the map popup)

### Examples:

**Full format:**
```
31.4618,35.3889 | September 2025 | Hiking and exploring Ein Gedi
```

**Minimal (just coordinates):**
```
32.6333,34.9167
```

**With date extracted from folder name:**
If your folder is named "HaBonim Oct 2025", you can just use:
```
32.6333,34.9167 | Beach day with family
```

## Finding Coordinates on Google Maps

1. Go to [Google Maps](https://maps.google.com)
2. Search for your location
3. Right-click on the exact spot
4. Click the coordinates at the top (they'll be copied!)
5. Paste into folder description

Example: Right-clicking on Ein Gedi copies: `31.4618, 35.3889`

## Testing Your Setup

1. After updating `config.js`, open your browser console (F12)
2. Visit your site
3. Check the console for any errors
4. Try this URL directly to test your script:
   ```
   YOUR_SCRIPT_URL?action=list&master=YOUR_FOLDER_ID
   ```
   You should see a JSON array of all your albums!

## Common Issues

**No albums showing up?**
- Check that `config.js` has the correct folder ID
- Verify the Apps Script URL is correct
- Make sure folders have descriptions with coordinates

**Cover images not showing?**
- The first image in each folder becomes the cover automatically
- Make sure there's at least one photo in each folder

**Old albums disappeared?**
- They might not have folder descriptions yet
- Add coordinates to each folder's description

## Need Help?

Check the main [README.md](README.md) for full troubleshooting steps.
