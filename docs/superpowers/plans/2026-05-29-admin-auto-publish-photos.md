# Admin Auto-Publish Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the owner opens an album whose photos are still private, the admin panel automatically publishes them so the cover chooser and public site never show broken images.

**Architecture:** Client-only "detect-then-share" in [admin.js](../../../admin.js). A failed cover thumbnail load signals private files; a one-shot guard fires a single existing `setSharing` write, then re-renders the grid with cache-busted URLs. The now-redundant per-album "Make this album public" button is removed; the album list gets a graceful broken-cover fallback.

**Tech Stack:** Vanilla ES module JS, Google Apps Script backend (unchanged), Vite dev server.

**Spec:** [docs/superpowers/specs/2026-05-29-admin-auto-publish-photos-design.md](../specs/2026-05-29-admin-auto-publish-photos-design.md)

> **Testing note:** This repo has no JS test harness (adding one is deferred to the security remediation per the spec). Verification is **manual** against the running dev server (`npm run dev`, already serving `/admin.html` on port 5174) plus a live `curl` content-type check. This is a deliberate, spec-sanctioned deviation from automated TDD.

> **Branch:** Before Task 1, create a dedicated branch off `main` — current branch `graphify-understand-anything` is unrelated work:
> ```bash
> git checkout main && git pull && git checkout -b admin-auto-publish-photos
> ```

---

## File Structure

- **Modify [admin.js](../../../admin.js)** — add `ensureAlbumPublic()` and `showCoverNote()` helpers; rewrite `loadCoverChoices()` with auto-share detection; add broken-cover fallback in `renderAlbumList()`; remove `handleMakePublic()`, its wiring, and all `sharing-row`/`sharing-status` references.
- **Modify [admin.html](../../../admin.html)** — remove the `#sharing-row` block; update the `#new-album-help` text that wrongly claims photos are already public.

No new files; no Apps Script change.

---

## Task 1: Auto-publish private photos in the cover chooser

**Files:**
- Modify: `admin.js` (replace `loadCoverChoices` at [admin.js:332-380](../../../admin.js#L332-L380); add two helpers just above it)

- [ ] **Step 1: Add the `showCoverNote` and `ensureAlbumPublic` helpers**

Insert these two functions in `admin.js` immediately **before** the existing `async function loadCoverChoices(` line:

```js
function showCoverNote(grid, message) {
  const note = document.createElement('p');
  note.className = 'admin-hint';
  note.textContent = message;
  grid.appendChild(note);
}

// Re-shares the folder and every file in it (videos included) as
// "anyone with link" — the access the lh3/thumbnail image URLs require.
async function ensureAlbumPublic(folderId) {
  setStatus('Publishing photos…');
  const result = await adminPost('setSharing', { folderId, public: true });
  setStatus(`Published ${result.filesUpdated} photos.`, 'success');
}
```

- [ ] **Step 2: Replace `loadCoverChoices` with the auto-share version**

Replace the entire existing `loadCoverChoices` function ([admin.js:332-380](../../../admin.js#L332-L380)) with:

```js
async function loadCoverChoices(folderId, { allowAutoShare = true } = {}) {
  const grid = document.getElementById('admin-cover-grid');
  grid.innerHTML = '';
  if (!folderId) return;

  let data;
  try {
    const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?folder=${folderId}&t=${Date.now()}`);
    data = await response.json();
  } catch (err) {
    showCoverNote(grid, 'Could not load photos: ' + err.message);
    return;
  }

  const images = (data.items || []).filter(
    (item) => item.size > 0 && item.mime && item.mime.startsWith('image/')
  );

  if (images.length === 0) {
    showCoverNote(grid, 'No photos in this folder yet.');
    return;
  }

  // A thumbnail that fails to load means the files are still private (Google
  // returns an HTML permission page, not image bytes). `handled` guarantees a
  // single reaction across all tiles: on the first failure we auto-share once,
  // then re-render with a cache-bust so the now-public thumbnails load. The
  // re-render passes allowAutoShare:false so a still-broken tile can't loop.
  let handled = false;
  const cacheBust = allowAutoShare ? '' : `&t=${Date.now()}`;

  images.forEach((item) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'admin-cover-thumb';
    thumb.dataset.id = item.id;
    thumb.setAttribute('aria-label', 'Use this photo as cover');

    const img = document.createElement('img');
    img.src = `https://drive.google.com/thumbnail?id=${item.id}&sz=w200${cacheBust}`;
    img.alt = item.description || '';
    img.loading = 'lazy';

    img.addEventListener('error', async () => {
      if (handled) return;
      handled = true;
      if (allowAutoShare) {
        try {
          await ensureAlbumPublic(folderId);
          loadCoverChoices(folderId, { allowAutoShare: false });
        } catch (err) {
          setStatus('Error: ' + err.message, 'error');
          showCoverNote(grid, 'Could not publish photos — check your token, then click Refresh.');
        }
      } else {
        showCoverNote(grid, 'Some photos could not be shown. Click Refresh to try again.');
      }
    });

    thumb.appendChild(img);

    thumb.addEventListener('click', () => {
      selectedCoverId = item.id;
      grid.querySelectorAll('.admin-cover-thumb').forEach((t) =>
        t.classList.toggle('selected', t.dataset.id === item.id)
      );
    });

    grid.appendChild(thumb);
  });
}
```

- [ ] **Step 3: Manually verify auto-publish on a private album**

The dev server is already running (`npm run dev`, http://localhost:5174). With your admin token saved:
1. Open http://localhost:5174/admin.html and click the **"Daniel's 9 bday"** album (currently private).
2. Expected: status briefly shows "Publishing photos…" then "Published N photos.", and the cover grid fills with real thumbnails (no broken tiles).

- [ ] **Step 4: Confirm the share took effect via the live API**

Run:
```bash
curl -sL -o /dev/null -w "%{content_type}\n" \
  "https://lh3.googleusercontent.com/d/1iV3nfJe-Ar-S0v6A48dRxztU9Lzp-ydK=s2000"
```
Expected: `image/jpeg` (before the fix it returned `text/html; charset=utf-8`).

- [ ] **Step 5: Confirm no redundant re-share on reopen**

Close and reopen the same album. Expected: thumbnails render immediately with **no** "Publishing photos…" status (already public → no thumbnail errors → no share call).

- [ ] **Step 6: Commit**

```bash
git add admin.js
git commit -m "feat(admin): auto-publish private album photos in cover chooser"
```

---

## Task 2: Graceful broken-cover fallback in the album list

**Files:**
- Modify: `admin.js` (`renderAlbumList`, the `if (album.cover)` block at [admin.js:91-102](../../../admin.js#L91-L102))

- [ ] **Step 1: Add an `error` handler that swaps in the placeholder**

Replace the `if (album.cover) { ... } else { ... }` block inside `renderAlbumList` ([admin.js:91-102](../../../admin.js#L91-L102)) with:

```js
    if (album.cover) {
      const img = document.createElement('img');
      img.className = 'admin-album-thumb';
      img.src = album.cover;
      img.alt = '';
      img.loading = 'lazy';
      // A private/missing cover returns an HTML permission page, not an image.
      // Swap in the empty placeholder instead of a broken-image icon. (Opening
      // the album is what actually publishes it; the list never auto-shares.)
      img.addEventListener(
        'error',
        () => {
          const placeholder = document.createElement('div');
          placeholder.className = 'admin-album-thumb admin-album-thumb-empty';
          img.replaceWith(placeholder);
        },
        { once: true }
      );
      button.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'admin-album-thumb admin-album-thumb-empty';
      button.appendChild(placeholder);
    }
```

- [ ] **Step 2: Manually verify the fallback**

Create a throwaway album in the panel (don't add photos) so it has no usable cover, then click **Refresh**. Expected: its list row shows the clean empty placeholder, not a broken-image icon. (Delete the throwaway folder in Drive afterward.)

- [ ] **Step 3: Commit**

```bash
git add admin.js
git commit -m "feat(admin): show placeholder instead of broken cover in album list"
```

---

## Task 3: Remove the now-redundant "Make this album public" button

**Files:**
- Modify: `admin.js` (remove `handleMakePublic` + wiring + `sharing-row`/`sharing-status` references)
- Modify: `admin.html` (remove `#sharing-row` block; fix `#new-album-help` text)

- [ ] **Step 1: Remove the sharing references in `admin.js`**

Make these four removals in `admin.js`:

1. In `selectAlbum`, delete these three lines ([admin.js:171-173](../../../admin.js#L171-L173)):
```js
  document.getElementById('sharing-row').hidden = false;
  document.getElementById('sharing-status').textContent =
    'Use the button if family report they cannot open this album.';
```

2. In `startNewAlbum`, delete this line ([admin.js:197](../../../admin.js#L197)):
```js
  document.getElementById('sharing-row').hidden = true; // auto-shared on create
```

3. In `handleSave` (the `mode === 'new'` branch), delete this line ([admin.js:427](../../../admin.js#L427)):
```js
      document.getElementById('sharing-row').hidden = false;
```

4. Delete the entire `handleMakePublic` function ([admin.js:457-466](../../../admin.js#L457-L466)):
```js
async function handleMakePublic() {
  if (!current) return;
  try {
    setStatus('Updating sharing…');
    const result = await adminPost('setSharing', { folderId: current.folderId, public: true });
    setStatus(`Album is public (${result.filesUpdated} photos updated).`, 'success');
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  }
}
```

- [ ] **Step 2: Remove the button's event wiring in `admin.js`**

In `init()`, delete this line ([admin.js:503](../../../admin.js#L503)):
```js
  document.getElementById('make-public-btn').addEventListener('click', handleMakePublic);
```

- [ ] **Step 3: Remove the `#sharing-row` block in `admin.html`**

Delete this block ([admin.html:132-135](../../../admin.html#L132-L135)):
```html
                <div class="admin-field admin-sharing-row" id="sharing-row">
                    <span id="sharing-status" class="admin-hint">Sharing: set with the button</span>
                    <button type="button" id="make-public-btn" class="admin-btn">Make this album public</button>
                </div>
```

- [ ] **Step 4: Fix the misleading help text in `admin.html`**

Replace the `#new-album-help` paragraph ([admin.html:142-147](../../../admin.html#L142-L147)) with:
```html
                <div id="new-album-help" class="admin-help" hidden>
                    <p><strong>Album created.</strong> Now add photos: open the folder in Google Drive and drag your
                        photos in, then come back, click Refresh, and open the album — your photos are published
                        automatically.</p>
                    <a id="open-drive-link" href="#" target="_blank" rel="noopener noreferrer" class="admin-btn">Open
                        folder in Drive</a>
                </div>
```

- [ ] **Step 5: Manually verify nothing broke**

Reload http://localhost:5174/admin.html. Expected:
1. No JavaScript errors in the browser console (confirms no dangling `getElementById('make-public-btn'/'sharing-row'/'sharing-status')` references).
2. Opening an album shows the editor with **no** "Make this album public" row, and the cover chooser still auto-publishes/renders (Task 1 behavior intact).
3. Creating a new album shows the updated help text.
4. **"Make all albums public"** on the main settings bar still exists and works.

- [ ] **Step 6: Commit**

```bash
git add admin.js admin.html
git commit -m "refactor(admin): remove redundant per-album make-public button"
```

---

## Final verification

- [ ] Full flow on a fresh private album: create album → add a photo in Drive → Refresh → open album → confirm it auto-publishes and the cover renders, with no manual sharing step anywhere.
- [ ] Browser console is clean across the list, editor, and new-album flows.
- [ ] `git log --oneline` shows the three feature commits on the `admin-auto-publish-photos` branch.
