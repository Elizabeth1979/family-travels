#!/usr/bin/env node
/**
 * One-time import: Google Apps Script / Drive metadata  ->  Supabase Postgres.
 *
 * Metadata only. No photo bytes move: each `photos.url` keeps pointing at the
 * existing Google CDN URL (https://lh3.googleusercontent.com/d/<id>=s2000), so
 * this is cheap, fast, and reversible.
 *
 * WHY THIS RUNS LOCALLY: Claude's remote container blocks outbound requests to
 * script.google.com (agent proxy returns 403 on CONNECT), so the import cannot
 * run from a Claude Code web session. Run it from your own machine, where the
 * Apps Script URL is reachable.
 *
 * Usage:
 *   export SUPABASE_URL="https://vsxbedlsnfmsbnlfayae.supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="<service_role key from Supabase dashboard>"
 *   export OWNER_ID="<uuid of the auth.users row that should own these albums>"
 *   node scripts/import-from-apps-script.mjs            # dry run, prints a plan
 *   node scripts/import-from-apps-script.mjs --write    # actually inserts
 *
 * The service-role key bypasses RLS (needed to insert rows on behalf of the
 * owner). Keep it in your shell only — never commit it, never ship it to the
 * browser.
 *
 * Idempotent: albums upsert on (owner_id, slug); photos are skipped when a row
 * with the same album + url already exists. Safe to re-run.
 */

import { createClient } from "@supabase/supabase-js";
import { CONFIG } from "../config.js";

const WRITE = process.argv.includes("--write");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_ID = process.env.OWNER_ID;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OWNER_ID) {
  console.error("Missing env. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OWNER_ID.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const APPS_SCRIPT_URL = CONFIG.APPS_SCRIPT_URL;
const MASTER_FOLDER_ID = CONFIG.MASTER_FOLDER_ID;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const body = await res.json();
  if (body && body.error) throw new Error(`Apps Script error: ${body.error}`);
  return body;
}

/** Apps Script `date` is free text ("March 2024"). Keep only what Postgres can store. */
function toDateOrNull(raw) {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toNumberOrNull(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log(`Reading albums from Apps Script (master ${MASTER_FOLDER_ID})…`);
  const albums = await getJson(`${APPS_SCRIPT_URL}?action=list&master=${MASTER_FOLDER_ID}`);

  if (!Array.isArray(albums)) {
    throw new Error("Expected an array of albums from ?action=list");
  }
  console.log(`Found ${albums.length} albums.\n`);

  let albumCount = 0;
  let photoCount = 0;

  for (const album of albums) {
    const albumRow = {
      owner_id: OWNER_ID,
      title: album.title,
      slug: album.id,
      date: toDateOrNull(album.date),
      description: album.description || null,
      lat: toNumberOrNull(album.lat),
      lng: toNumberOrNull(album.lng),
      type: album.type === "event" ? "event" : "travel",
      is_published: true, // these are already public on the live site
    };

    const photos = await getJson(`${APPS_SCRIPT_URL}?folder=${album.folderId}`);
    const items = (photos && photos.items) || [];

    console.log(
      `${album.title}  —  ${items.length} photos` +
        (albumRow.date ? `  (${albumRow.date})` : "  (no parsable date)")
    );

    albumCount += 1;
    photoCount += items.length;

    if (!WRITE) continue;

    // Albums re-sync from Drive on every run (Drive is still the source of
    // truth until the Phase 5 cutover), unlike photos below, which preserve
    // owner edits. Note this also re-asserts is_published — if you unpublish an
    // album in the app and then re-run the import, it comes back published.
    const { data: savedAlbum, error: albumError } = await supabase
      .from("albums")
      .upsert(albumRow, { onConflict: "owner_id,slug" })
      .select("id")
      .single();

    if (albumError) {
      console.error(`  ! album failed: ${albumError.message}`);
      continue;
    }

    const photoRows = items.map((item, index) => ({
      album_id: savedAlbum.id,
      owner_id: OWNER_ID,
      url: item.src,
      mime: item.mime || null,
      // Drive's single "description" was doing double duty. Seed both; the
      // in-app editor (Phase 3) and AI drafts (Phase 4) refine them later.
      caption: item.description || null,
      alt: item.description || null,
      sort_order: index,
    }));

    if (photoRows.length) {
      // ignoreDuplicates leans on the unique (album_id, url) constraint: new
      // photos are inserted, already-imported ones are left untouched. That
      // matters on a re-run — an update would clobber captions the owner has
      // since edited in the app.
      const { error: photoError } = await supabase
        .from("photos")
        .upsert(photoRows, { onConflict: "album_id,url", ignoreDuplicates: true });
      if (photoError) {
        console.error(`  ! photos failed: ${photoError.message}`);
        continue;
      }
    }

    // Point the album at its cover photo, matching the Apps Script's choice.
    if (album.cover) {
      const { data: cover } = await supabase
        .from("photos")
        .select("id")
        .eq("album_id", savedAlbum.id)
        .eq("url", album.cover)
        .maybeSingle();
      if (cover) {
        await supabase.from("albums").update({ cover_photo_id: cover.id }).eq("id", savedAlbum.id);
      }
    }
  }

  console.log(
    `\n${WRITE ? "Imported" : "Would import"} ${albumCount} albums / ${photoCount} photos.`
  );
  if (!WRITE) console.log("Dry run — re-run with --write to apply.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
