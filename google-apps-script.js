function doGet(e) {
  try {
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
        items.push({
          name: file.getName(),
          id: fileId,
          mime: mimeType,
          size: file.getSize(),
          created: file.getDateCreated(),
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
