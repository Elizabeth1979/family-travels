// Supabase client for Family Travel Map.
//
// Like config.js, this is a static site — everything here ships to the browser.
// That is fine: the publishable ("anon") key is *designed* to be public. It grants
// no data access on its own; Row-Level Security on `albums`/`photos` decides what
// an anonymous visitor can read (published albums only) and what a logged-in owner
// can write (their own rows). Never put the service-role key here.
//
// Override per-environment via Vite env vars: VITE_SUPABASE_URL, VITE_SUPABASE_KEY.

import { createClient } from "@supabase/supabase-js";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};

export const SUPABASE_URL = env.VITE_SUPABASE_URL || "https://vsxbedlsnfmsbnlfayae.supabase.co";

export const SUPABASE_KEY =
  env.VITE_SUPABASE_KEY || "sb_publishable_G8aIBjhnmrVHVzIeYkIynQ_MbrIw7hn";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Map a Supabase `albums` row (joined with its cover photo) onto the album shape
 * the existing frontend already understands, so map.js / album.js / the gallery
 * keep working unchanged during the migration.
 */
export function albumRowToLegacyShape(row) {
  return {
    id: row.id,
    name: row.title,
    slug: row.slug,
    date: row.date || "",
    description: row.description || "",
    lat: row.lat,
    lng: row.lng,
    type: row.type,
    coverUrl: row.cover_photo?.url || null,
  };
}

/**
 * Map a Supabase `photos` row onto the legacy item shape used by the gallery and
 * PhotoSwipe. `caption` is the visible text; `alt` is the accessibility text.
 */
export function photoRowToLegacyShape(row) {
  return {
    id: row.id,
    url: row.url,
    thumbUrl: row.thumb_url || row.url,
    mimeType: row.mime || "",
    caption: row.caption || "",
    alt: row.alt || row.caption || "",
    width: row.width || null,
    height: row.height || null,
  };
}
