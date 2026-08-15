# Videos: replacing Drive's embedded player with a native one

**Keywords:** video, playback, "There was a problem playing this video", Google Drive preview,
iframe, PhotoSwipe, lightbox, HEVC, transcode, controls cut off, landscape, rotation,
`drive.usercontent.google.com`, CSP media-src, album.js.

## What we set out to do

Elizabeth reported two things from her phone, both on album video slides:

1. Some videos never play. Drive's player shows **"There was a problem playing this video —
   Learn More / Download"**. The Download button on the same screen works fine, so the file
   itself is intact.
2. Landscape videos show an overlay with the seek bar riding *above* the picture and the
   player's buttons clipped off at the bottom edge.

## Key findings

**Both symptoms came from the same decision: video slides embedded Google Drive's own player
(`drive.google.com/file/d/<id>/preview`) in an iframe.**

- *Problem 1 is Drive-side and not fixable from our code.* Drive's embedded player doesn't
  serve the original file — it serves a stream Drive transcoded itself. When that transcode
  never happened or failed, the player has nothing to play and shows exactly that error, even
  though the original downloads perfectly. Phone clips in formats Drive won't transcode
  (HEVC / 4K / high frame rate — the "high efficiency" setting on newer Samsung handsets) hit
  this routinely, which matches "some videos" rather than all.
- *Problem 2 was ours.* `loadImageDimensions` sized each video slide to the **clip's** aspect
  ratio, measured from its Drive thumbnail. On a portrait phone a 16:9 clip therefore became a
  short horizontal strip, and Drive's player draws its chrome relative to the box it is given —
  so the seek bar sat on the strip's top edge and the button row fell outside the bottom.
- A third, unreported bug found on the way: `setupVideoObserver()` watched every iframe in the
  document and reloaded any that dropped below 10% visibility (`iframe.src = ''` then back).
  PhotoSwipe keeps neighbouring slides in the DOM off-screen, so this fired on every slide
  change — on top of the `_resetVideo` swap already doing that job — repeatedly reloading Drive
  embeds. The blank `src` also briefly loaded the album page into the iframe.

## Decisions

**Play the original file in a real `<video>`, keep Drive's player as the fallback.**
`drive.usercontent.google.com/download?id=…&export=download&confirm=t` serves the original
bytes with Range support (`confirm=t` skips the virus-scan interstitial Drive returns for files
over ~100 MB). If the browser can't decode the original, or Drive answers with an HTML page
instead of the file, the `error` event swaps the Drive embed back in — so nothing that played
before stops playing. We chose native-first specifically because it is the only *detectable*
direction: a cross-origin iframe's internal failure can't be observed, so Drive-first would
leave the visitor stuck at the error with no recovery.

**Give video slides the whole screen instead of the clip's aspect ratio.** Both players
letterbox the picture themselves, so nothing is distorted, and the chrome gets room to sit
where it belongs. Slide size is re-pointed at PhotoSwipe's pan area on every `calcSlideSize`,
so rotating the phone mid-video refills the screen rather than leaving a portrait-shaped column.

**Delete `setupVideoObserver` outright** rather than narrow it — `_resetVideo` on slide change
and close already covers stopping playback.

Note this leaves the aspect-ratio probe removed from `loadImageDimensions` for videos: it cost
a thumbnail request per video and its answer is no longer used.

## Artifacts

- `album.js` — native player + fallback, `driveFileId` helper, full-screen video slides,
  `calcSlideSize` hook, `setupVideoObserver` removed.
- `styles.css` — `.pswp-video-wrapper video` (`object-fit: contain`).
- `vercel.json` — CSP gained `media-src` (without it the `<video>` src falls under
  `default-src 'self'` and is blocked).
- Verified with a throwaway Playwright harness that loads the real album page with Apps Script,
  Drive and the CDNs mocked: 11 checks covering native playback, the streamed URL, decode,
  full-screen sizing, rotation, and the fallback to the Drive embed. Not committed — it needs
  vendored copies of PhotoSwipe/Leaflet to work without network access.

## Next step

Elizabeth to confirm on her phone against the albums that were failing. If a video still shows
Drive's error, that now means the browser couldn't decode the original either — the useful next
move would be re-encoding those clips to H.264 in Drive rather than more frontend work.
