// Serverless function that gives shared album links a rich preview.
//
// When a link like /trip/eilat-2024 is shared in WhatsApp/Messages/etc., the
// crawler reads the Open Graph tags below (cover photo + title). Real browsers
// are redirected straight to the album page. Wired up via the rewrite in
// vercel.json: /trip/:id -> /api/trip/:id

const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  process.env.VITE_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbwpZcOHQPdr2st43M5Riz3-d4Tq-gp00WEJR3QTgnbwsw-wtyHUkd4qbKFqL8FGodk/exec";

const MASTER_FOLDER_ID =
  process.env.MASTER_FOLDER_ID ||
  process.env.VITE_MASTER_FOLDER_ID ||
  "1WMN1Y0Xa8tulV5zvP5tDawXz2uXCDxRL";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Cover photos are stored at full resolution (=s2000), which is fine in the
// app but too heavy for link-preview crawlers — WhatsApp in particular skips
// images that are large or slow to fetch, so the photo silently doesn't show.
// Serve a lighter ~1200px version to the crawler instead.
function previewImage(cover) {
  if (!cover) return "";
  return String(cover).replace(/=s\d+(-[a-z0-9]+)*$/i, "=w1200");
}

async function findAlbum(id) {
  try {
    const response = await fetch(
      `${APPS_SCRIPT_URL}?action=list&master=${MASTER_FOLDER_ID}`
    );
    const albums = await response.json();
    if (!Array.isArray(albums)) return null;
    return albums.find((album) => album.id === id) || null;
  } catch (err) {
    return null;
  }
}

export default async function handler(req, res) {
  const id = req.query.id || "";
  const album = await findAlbum(id);

  const title = album ? album.title : "Family Travel Map";
  const description = album && album.description
    ? album.description
    : "Explore our family travels through an interactive map.";
  const image = album && album.cover ? previewImage(album.cover) : "";

  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers.host || "";
  const pageUrl = `${proto}://${host}/trip/${encodeURIComponent(id)}`;
  const target = `/album.html?id=${encodeURIComponent(id)}&shared=true`;

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeTarget = escapeHtml(target);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Our Family Adventures">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
${safeImage ? `<meta property="og:image" content="${safeImage}">
<meta property="og:image:secure_url" content="${safeImage}">
<meta property="og:image:alt" content="${safeTitle}">` : ""}
<meta name="twitter:card" content="${safeImage ? "summary_large_image" : "summary"}">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
${safeImage ? `<meta name="twitter:image" content="${safeImage}">` : ""}
<meta http-equiv="refresh" content="0; url=${safeTarget}">
<link rel="canonical" href="${escapeHtml(pageUrl)}">
</head>
<body>
<p>Opening album… <a href="${safeTarget}">Continue to ${safeTitle}</a></p>
<script>window.location.replace(${JSON.stringify(target)});</script>
</body>
</html>`;

  // Let social crawlers and CDNs cache the preview briefly.
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).send(html);
}
