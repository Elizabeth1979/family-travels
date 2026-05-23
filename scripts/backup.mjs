// Local backup of the whole family archive.
//
// Downloads the album list + every photo/video into ./backup so the family
// always owns an offline copy, independent of Google Drive staying available.
// Run with:  npm run backup
//
// Note: images are pulled at full available resolution; if a file can't be
// fetched (e.g. not shared publicly) it is skipped and reported at the end.

import { CONFIG } from "../config.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = "backup";

function sanitize(name) {
  return String(name || "file").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 120);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function downloadTo(url, dest) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(dest, buffer);
}

function downloadUrl(item) {
  if (item.mime && item.mime.startsWith("image/")) {
    return `https://lh3.googleusercontent.com/d/${item.id}=s0`;
  }
  return `https://drive.google.com/uc?export=download&id=${item.id}`;
}

async function main() {
  const failures = [];
  console.log("Fetching album list…");
  const albums = await fetchJson(
    `${CONFIG.APPS_SCRIPT_URL}?action=list&master=${CONFIG.MASTER_FOLDER_ID}`
  );
  if (!Array.isArray(albums)) {
    throw new Error("Unexpected album list response: " + JSON.stringify(albums));
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, "albums.json"), JSON.stringify(albums, null, 2));
  console.log(`Found ${albums.length} albums.`);

  for (const album of albums) {
    const albumDir = join(OUT_DIR, sanitize(album.id || album.title));
    await mkdir(albumDir, { recursive: true });

    let photos = { items: [] };
    try {
      photos = await fetchJson(`${CONFIG.APPS_SCRIPT_URL}?folder=${album.folderId}`);
    } catch (err) {
      failures.push(`${album.title}: list failed (${err.message})`);
      continue;
    }

    const items = (photos.items || []).filter((item) => item.size > 0);
    await writeFile(join(albumDir, "index.json"), JSON.stringify(items, null, 2));
    console.log(`\n${album.title} — ${items.length} files`);

    let index = 0;
    for (const item of items) {
      index += 1;
      const dest = join(albumDir, `${String(index).padStart(3, "0")}_${sanitize(item.name)}`);
      try {
        await downloadTo(downloadUrl(item), dest);
        process.stdout.write(".");
      } catch (err) {
        failures.push(`${album.title}/${item.name}: ${err.message}`);
        process.stdout.write("x");
      }
    }
  }

  console.log(`\n\nBackup written to ./${OUT_DIR}`);
  if (failures.length) {
    console.log(`\n${failures.length} item(s) could not be downloaded:`);
    failures.forEach((line) => console.log("  - " + line));
  }
}

main().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
