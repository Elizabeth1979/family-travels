# Family Travel Map & Album Site

An interactive map-based website where each location pin opens an album of photos and videos from family trips.

## Features

- Interactive global map showing all travel locations
- Click pins to view album details and cover photos
- Album pages with photo/video galleries
- Full-screen viewer with swipe navigation
- Accessible design with keyboard support
- Mobile responsive
- Zero backend - hosted on Netlify

## Setup Instructions

### Local Development

To preview changes locally and run linting before deploys, follow the steps in `docs/local-development.md`. The guide covers both the npm-based workflow (`npm start`) and a lightweight Python fallback server.

### 1. Configure Google Drive & Apps Script

1. **Create a master "Family Trips" folder** in Google Drive
2. Set the master folder permissions to "Anyone with the link can view"
3. Note the **master folder ID** from the URL (the part after `/folders/`)
   - Example: `https://drive.google.com/drive/folders/1ABC123xyz` → use `1ABC123xyz`
4. Go to [Google Apps Script](https://script.google.com/)
5. Create a new project and paste the code from `google-apps-script.js`
6. Deploy as Web App:
   - Click "Deploy" > "New deployment"
   - Select type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone"
   - Click "Deploy"
7. **Copy the Web App URL** - you'll need this for configuration

### 2. Update Configuration

1. Open `config.js`
2. Replace `APPS_SCRIPT_URL` with your deployed Web App URL from step 1.7
3. Replace `MASTER_FOLDER_ID` with your "Family Trips" folder ID from step 1.3
4. Set `USE_DYNAMIC_ALBUMS` to `true` for automatic album updates

Example configuration:
```javascript
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
  MASTER_FOLDER_ID: "1ABC123xyz",
  USE_DYNAMIC_ALBUMS: true
};
```

**Note:** If you prefer to use static `albums.json` instead, set `USE_DYNAMIC_ALBUMS: false`

### 3. Deploy to Netlify

#### Option A: Drag & Drop
1. Go to [Netlify](https://app.netlify.com/)
2. Drag the entire project folder to the deploy area
3. Your site is live!

#### Option B: Git Integration
1. Create a Git repository
2. Push your code to GitHub
3. Connect your repo to Netlify
4. Netlify will auto-deploy on every push

## Project Structure

```
travels/
├── index.html              # Main map page
├── album.html              # Album page template
├── styles/                 # Modular CSS (base, layout, components, utilities)
├── config.js               # Configuration (URLs, folder IDs)
├── map.js                  # Map page logic
├── album.js                # Album page logic
├── albums.json             # Album data (legacy/fallback)
├── google-apps-script.js   # Drive API script (deploy separately)
├── netlify.toml            # Netlify configuration
└── README.md               # This file
```

## Adding New Albums

With dynamic album updates enabled, adding new albums is super easy:

### Quick Method (Automatic)

1. **Create a new folder** inside your "Family Trips" master folder (e.g., "Eshtaol forest")
2. **Add photos/videos** to the folder
3. **Set folder description** in Google Drive with location info:
   - Right-click folder → "View details" → Add description
   - Format: `lat,lng | date | description`
   - Example: `31.7833,35.0000 | October 2025 | Hiking in the beautiful forest`
4. **Done!** The album appears on your site automatically

### Notes on Folder Description Format

- **Coordinates (required)**: `lat,lng` - Get from Google Maps by right-clicking on the location
- **Date (optional)**: If not provided, will try to extract from folder name (e.g., "Oct 2025")
- **Description (optional)**: Shows on the map and album page
- **Separators**: Use `|` (pipe) to separate fields

Example descriptions:
```
31.4618,35.3889 | September 2025 | Hiking Ein Gedi
32.6333,34.9167 | October 2025 | Beach day with family
31.7683,35.2137
```

### Adding Alt Text to Photos (Optional, for Accessibility)

You can add descriptive alt text to individual photos for better accessibility:

1. **Right-click a photo** in Google Drive
2. **Select "View details"**
3. **Add a description** (e.g., "Family hiking on mountain trail")
4. The description becomes the image's alt text

This helps screen readers describe images to visually impaired users. If no description is added, the filename is used as alt text.

### Legacy Method (Static albums.json)

If you set `USE_DYNAMIC_ALBUMS: false` in config.js:

1. Create a new Google Drive folder with your photos/videos
2. Set folder to "Anyone with the link can view"
3. Get the folder ID from the URL
4. Add a new entry to `albums.json`
5. Commit and push (or re-deploy to Netlify)

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Map Library**: Leaflet
- **Gallery Library**: PhotoSwipe
- **Data Source**: Google Drive + Apps Script
- **Hosting**: Netlify

## Accessibility Features

- Keyboard navigation support
- Focus indicators on all interactive elements
- ARIA labels on map regions
- Alt text support for images
- Screen reader friendly
- Reduced motion support

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Android)

## Future Enhancements (Stage 2)

- Admin panel for managing albums
- Private/unlisted album visibility
- Search and filter capabilities
- Short share links with expiry
- Migration to CDN storage (Cloudflare R2)

## Troubleshooting

**Albums not appearing on the map:**
- Verify `config.js` has the correct `MASTER_FOLDER_ID`
- Check that `USE_DYNAMIC_ALBUMS` is set to `true`
- Make sure the Google Apps Script is deployed and the URL is correct
- Verify folder descriptions have coordinates in the format: `lat,lng | date | description`
- Open browser console (F12) to check for errors
- Test the script directly: `YOUR_SCRIPT_URL?action=list&master=YOUR_FOLDER_ID`

**Photos not loading:**
- Verify Google Apps Script is deployed correctly
- Check folder permissions are set to "Anyone with link can view"
- Verify the album's folder ID is correct
- Check browser console for errors
- Ensure photos are directly in the album folder (not in subfolders)

**Map not displaying:**
- Check internet connection (Leaflet requires CDN)
- Verify coordinates in folder descriptions are valid
- Coordinates should be in decimal format (e.g., 31.7683, not degrees/minutes/seconds)

**Need to use static albums.json instead:**
- Set `USE_DYNAMIC_ALBUMS: false` in `config.js`
- Site will fall back to reading from `albums.json`

## License

Personal family project - not for commercial use.

## Support

For issues or questions, please check:
1. The setup instructions above
2. Browser console for error messages
3. Google Apps Script logs
