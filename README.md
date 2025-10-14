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

### 1. Configure Google Drive & Apps Script

1. Create a Google Drive folder for each trip
2. Set folder permissions to "Anyone with the link can view"
3. Note the folder ID from the URL (the part after `/folders/`)
4. Go to [Google Apps Script](https://script.google.com/)
5. Create a new project and paste the code from `google-apps-script.js`
6. Deploy as Web App:
   - Click "Deploy" > "New deployment"
   - Select type: "Web app"
   - Execute as: "Me"
   - Who has access: "Anyone"
   - Click "Deploy"
7. Copy the Web App URL

### 2. Update Configuration

1. Open `album.js`
2. Replace `YOUR_SCRIPT_ID` in `APPS_SCRIPT_URL` with your deployed script URL
3. Open `albums.json`
4. Add your albums with:
   - `id`: unique identifier (e.g., "trip-name-2025")
   - `title`: album title
   - `date`: date or period
   - `description`: optional description
   - `lat` / `lng`: coordinates (get from Google Maps by right-clicking)
   - `folderId`: Google Drive folder ID
   - `cover`: optional cover image URL

Example:
```json
{
  "id": "paris-2025",
  "title": "Paris Trip 2025",
  "date": "May 2025",
  "description": "Our amazing trip to Paris",
  "lat": 48.8566,
  "lng": 2.3522,
  "folderId": "YOUR_FOLDER_ID",
  "cover": "https://drive.google.com/uc?export=view&id=COVER_IMAGE_ID"
}
```

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
├── styles.css              # All styles
├── map.js                  # Map page logic
├── album.js                # Album page logic
├── albums.json             # Album data
├── google-apps-script.js   # Drive API script
├── netlify.toml            # Netlify configuration
└── README.md               # This file
```

## Adding New Albums

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

**Photos not loading:**
- Verify Google Apps Script is deployed correctly
- Check folder permissions are set to "Anyone with link"
- Verify folder IDs in albums.json are correct
- Check browser console for errors

**Map not displaying:**
- Check internet connection (Leaflet requires CDN)
- Verify coordinates in albums.json are valid

## License

Personal family project - not for commercial use.

## Support

For issues or questions, please check:
1. The setup instructions above
2. Browser console for error messages
3. Google Apps Script logs
