// Link-preview image for the home page (the interactive map).
//
// index.html is a static file with no cover photo of its own, so when the bare
// site link is shared in WhatsApp/Messages/etc. there is nothing for the
// crawler to show. This endpoint resolves a current album cover and redirects
// to a lightweight (~1200px) version of it, so the home link gets a real
// family photo in its preview. Referenced from index.html's og:image tag.

const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  process.env.VITE_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbwpZcOHQPdr2st43M5Riz3-d4Tq-gp00WEJR3QTgnbwsw-wtyHUkd4qbKFqL8FGodk/exec";

const MASTER_FOLDER_ID =
  process.env.MASTER_FOLDER_ID ||
  process.env.VITE_MASTER_FOLDER_ID ||
  "1WMN1Y0Xa8tulV5zvP5tDawXz2uXCDxRL";

// Cover photos are stored at full resolution (=s2000); serve a lighter version
// to the crawler so the preview loads quickly and isn't skipped for size.
function previewImage(cover) {
  return String(cover).replace(/=s\d+(-[a-z0-9]+)*$/i, "=w1200");
}

async function findFirstCover() {
  try {
    const response = await fetch(
      `${APPS_SCRIPT_URL}?action=list&master=${MASTER_FOLDER_ID}`
    );
    const albums = await response.json();
    if (!Array.isArray(albums)) return "";
    const withCover = albums.find((album) => album && album.cover);
    return withCover ? previewImage(withCover.cover) : "";
  } catch (err) {
    return "";
  }
}

export default async function handler(req, res) {
  const cover = await findFirstCover();

  if (!cover) {
    // No cover available — let the crawler fall back to a text-only preview.
    res.status(404).send("No preview image available");
    return;
  }

  // Cache briefly so repeated crawls are cheap but the photo can still refresh.
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.setHeader("Location", cover);
  res.status(302).end();
}
