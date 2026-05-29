# Design: Auto-publish album photos in the admin panel

Date: 2026-05-29
Status: Approved (pending spec review)

## Context

The admin panel ([admin.html](../../../admin.html) / [admin.js](../../../admin.js))
lets the owner create albums and pick a cover photo. An album is a Google Drive
subfolder; the map and the cover chooser render thumbnails from direct Google URLs
(`https://lh3.googleusercontent.com/d/<id>` and
`https://drive.google.com/thumbnail?id=<id>`). **These URLs only return image
bytes for files shared "Anyone with link."**

When the owner creates an album and then adds photos from their phone (Google
Drive app), the new files are **private** by default. The folder was shared
public on create, but later-added files do not inherit per-file public access.
Result: `loadCoverChoices()` ([admin.js:332](../../../admin.js#L332)) renders a
grid of **broken image tiles**, and the album's cover is broken on the public
site.

Today the only fix is the per-album **"Make this album public"** button
([admin.js:457](../../../admin.js#L457)), framed as a *reactive* step ("Use the
button if family report they cannot open this album",
[admin.js:172-173](../../../admin.js#L172-L173)). The owner has no reason to
expect that adding photos leaves them invisible, so the broken state is easy to
hit — and that is exactly what happened.

There is no concept of a private album anywhere in this app; every album is meant
to be publicly viewable. So the manual sharing step is a footgun, not a feature.

**Intended outcome:** opening an album with private photos automatically makes
them public, so the cover chooser (and the public site) never shows broken
images. No manual button, no thinking about "sharing."

## Decisions

- **Auto-share, not gate.** When private photos are detected, publish them
  automatically rather than hiding the chooser behind a manual button.
- **Approach: detect-then-share, client-only.** No Apps Script change or
  redeploy. Detect "private" from a failed thumbnail load, then call the
  existing `setSharing` write action and re-render. Shares only when needed.
- **Keep the admin token.** The token is the only wall between the public
  internet and write access to the owner's Drive (the Apps Script endpoint URL
  ships in the public site bundle, [config.js:13](../../../config.js#L13)). It
  is already saved in localStorage and auto-filled, so it adds no friction. The
  auto-share reuses the saved token silently. Properly replacing the token with
  Google-account auth is deferred to the separate security remediation.

## Behavior

Opening an album in the editor:

- If its photos are **already public** → cover grid renders immediately, nothing
  else happens.
- If any photo is **private** → status shows "Publishing N photos…", the panel
  calls `setSharing(public: true)`, then re-renders the grid (cache-busted) with
  the now-public thumbnails. The album's list thumbnail and public-site cover are
  fixed by the same share.

Auto-share triggers **only when an album is opened in the editor**, never
passively from the album list.

## Implementation (all in [admin.js](../../../admin.js))

### `loadCoverChoices(folderId, { allowAutoShare = true } = {})`

- Add the `allowAutoShare` option (default `true`).
- For each rendered thumbnail `<img>`, attach an `onerror` handler.
- A **one-shot guard** (a single boolean per `loadCoverChoices` call) ensures
  that the first failing tile triggers exactly one auto-share, even though many
  tiles will fail. Subsequent `onerror` events are ignored once the guard is set.
- On the first failure, if `allowAutoShare` is `true`, call
  `ensureAlbumPublic(folderId)`, then re-invoke
  `loadCoverChoices(folderId, { allowAutoShare: false })`.
- On the retry pass (`allowAutoShare: false`), append a cache-bust param
  (`&t=<timestamp>`) to each thumbnail `src` so Google's CDN serves the freshly
  public image instead of a cached permission page. If tiles still fail on this
  pass, do **not** retry again (no loop); show a fallback note (see below).

### `ensureAlbumPublic(folderId)` (new, small)

```
async function ensureAlbumPublic(folderId) {
  setStatus('Publishing photos…');
  const result = await adminPost('setSharing', { folderId, public: true });
  setStatus(`Published ${result.filesUpdated} photos.`, 'success');
}
```

Reuses the existing `adminPost('setSharing', …)` call that
`handleMakePublic` ([admin.js:461](../../../admin.js#L461)) uses today.

### Cleanup

- Remove the per-album **"Make this album public"** button and its
  `handleMakePublic` handler ([admin.js:457-466](../../../admin.js#L457-L466)),
  its wiring ([admin.js:503](../../../admin.js#L503)), the `sharing-row` /
  `sharing-status` show/hide logic ([admin.js:171-173](../../../admin.js#L171-L173),
  [admin.js:197](../../../admin.js#L197), [admin.js:427](../../../admin.js#L427)),
  and the corresponding markup in [admin.html](../../../admin.html).
- Keep **"Make all albums public"** ([admin.js:468](../../../admin.js#L468)) on
  the main screen as a bulk-repair tool.
- **Album list graceful fallback:** in `renderAlbumList()`
  ([admin.js:91-102](../../../admin.js#L91-L102)), when a cover `<img>` fails to
  load, swap it for the existing empty-placeholder element instead of leaving a
  broken image. (Same root cause; no auto-sharing from the list.)

## Error handling

- **No saved token:** `adminPost` throws "Enter your admin token first."
  ([admin.js:30](../../../admin.js#L30)); caught and shown via
  `setStatus(..., 'error')`. The grid shows a fallback note; no loop.
- **`setSharing` fails (network / wrong token):** error status plus a fallback
  note in the grid hinting to fix the token / hit Refresh. No retry loop.
- **CDN still serving cached permission page after share:** the cache-bust param
  forces a fresh fetch; if a tile still fails on the no-retry pass, the fallback
  note tells the owner to click Refresh.
- **Videos:** `setSharing` already re-shares *all* files in the folder
  ([google-apps-script.js:381](../../../google-apps-script.js#L381)), so video
  playback is fixed by the same call — no special handling.

## Testing / Verification

No automated test harness exists in this repo yet (adding one is part of the
separate remediation). Verify manually against the local dev server
(`npm run dev`, `/admin.html`):

1. Open the currently-private **"Daniel's 9 bday"** album → confirm status shows
   "Publishing N photos…" and the cover grid fills in with real thumbnails.
2. Live re-check: the cover file URL flips from `Content-Type: text/html`
   (permission page) to `image/jpeg`.
3. Reopen the same album → no re-share occurs, grid renders immediately
   (confirms "only share when needed").
4. Load the home map → the album's cover renders correctly.
5. Open an album with **no** photos → "No photos in this folder yet." note, no
   sharing call, no error.

## Out of scope (deferred to security remediation)

- Replacing the admin token with Google-account authentication.
- Moving secrets out of committed files.
- Backend (`?folder=`) returning a `public` flag (the cleaner Approach 3).
- Automated smoke tests.
