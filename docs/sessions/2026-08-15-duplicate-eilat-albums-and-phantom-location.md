# Two "Eilat 2026" albums & the sticky "No location" badge

**Keywords:** admin, duplicate albums, no location badge, Jerusalem default, 31.7683, folder
description metadata, album slug collision, selectAlbum, Drive folders, hasLocation.

## What we set out to do

Elizabeth asked two questions about the admin page: why the album list showed two
Eilat-2026-ish albums, and why one carried a red **No location** badge when she had set
a location while creating the album.

## Key findings

Albums are not rows in a database — each one **is** a Drive subfolder of the master folder,
with its metadata packed into the folder *description*
(`lat,lng | date | description | coverFileId | type`). Reading the live folder list settled
both questions.

Two genuinely separate folders existed, created 78 seconds apart:

| Folder | Created | Stored description | Photos |
| --- | --- | --- | --- |
| `Eilat 2026` | 07:07:00 | `29.556935,34.949795 \| August 2026 \|` | none |
| `Eilat Aug 2026` | 07:08:18 | `31.7683,35.2137 \| Aug 2026 \| \| 1xBkeQ…` | yes, cover set |

1. **The duplicate was two create actions, not a bug that cloned anything.** Nothing in the
   admin or the Apps Script dedupes; "Create album" simply makes another folder. The location
   *was* saved correctly — on `Eilat 2026`, the 07:07 one, which is why that row has no badge.
2. **The badge belonged to the other album.** `Eilat Aug 2026` was created without a pin. Its
   `Aug 2026` date never came from the Date field either — with no date stored,
   `parseAlbumFolder` regex-extracts a month/year out of the *folder name*.
3. **The real bug: the Jerusalem fallback leaked from display into stored data.** When an album
   has no coordinates, the Apps Script hands back the Jerusalem default (31.7683, 35.2137).
   `selectAlbum` wrote those numbers straight into the lat/lng inputs, so the next Save — even
   one only meant to pick a cover — persisted them as though they were a real pin. That is
   exactly how `Eilat Aug 2026` ended up with hard-coded Jerusalem coordinates in Drive at
   07:12, four minutes after it was created empty. The public map pins every album with numeric
   coordinates and does not filter the default, so such an album lands in Jerusalem rather than
   going unpinned.

## Decisions (and why)

- **Leave the fields empty instead of pre-filling the fallback.** `selectAlbum` now blanks
  lat/lng and opens the picker on the world view (identical to the new-album flow) when
  `hasLocation()` is false. Saving an unplaced album keeps it unplaced instead of quietly
  moving it to Jerusalem. Same reasoning applied to the in-memory `current` object built after
  `createAlbum`, which was substituting the same fake default.
- **Confirm before creating a title that already exists.** Two folders whose names reduce to
  the same slug collide on the album URL — `album.js` does `albums.find(a => a.id === albumId)`,
  so only the first is ever reachable. The guard matches on the exact normalized slug.
- **Rejected: fuzzy duplicate detection.** `Eilat Apr 2023`, `Eilat Aug 2024`, `Eilat Aug 2026`
  are all legitimately distinct albums under a `<Place> <Month> <Year>` naming habit. Warning on
  a shared leading word would fire constantly and train the owner to click through it. It also
  would not have caught this case cleanly, since the two titles genuinely differ.
- **Did not touch Drive.** Deleting or merging the owner's folders is her call; the duplicate is
  data, not code.

## Artifacts

- `admin.js` — `toAlbumSlug()` helper; `selectAlbum()` no longer pre-fills the fallback;
  slug-collision confirm in `handleSave()`.

## Next step

Owner decides what to do with the two folders: most likely move the photos from
`Eilat Aug 2026` into the located `Eilat 2026` and trash the empty one, or just place a pin on
`Eilat Aug 2026` and delete the empty `Eilat 2026`. Nothing in the repo blocks either.

Unrelated, noticed in passing: `npm run lint:js` cannot run at all — ESLint 10 is installed but
the repo only has the old `.eslintrc` style config, so there is no flat `eslint.config.js` for it
to find. Pre-existing, not touched here.
