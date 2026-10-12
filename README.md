# Handsfree Media Controller

A Manifest V3 Chrome extension that controls video playback with hand gestures
from your webcam. Hand tracking runs on-device with MediaPipe, so no video
leaves the machine.

It targets pages with a standard HTML5 `<video>` element.

## Gestures and default actions

| Gesture | Default action |
| --- | --- |
| Open palm (four fingers up) | Play / pause |
| Fist | Mute / unmute |
| Index finger up | Speed up (+0.25x, max 2x) |
| Peace (index + middle) | Skip forward 10s |
| Three fingers (index + middle + ring) | Skip back 10s |

Every gesture can be remapped in the popup to any action: play/pause, mute,
speed up, speed down (0.25x to 2x), skip forward, skip back, next short,
previous short, or none. The mapping is stored in `chrome.storage.local`.

## How it works

1. The content script adds a small iframe (`tracker.html`, extension origin)
   to the page when you press Start in the popup.
2. The iframe opens the webcam with `getUserMedia` and runs the MediaPipe
   HandLandmarker on each video frame, giving 21 landmarks per hand.
3. `src/gestures.js` classifies the pose. A finger counts as extended when its
   tip is clearly farther from the wrist than its PIP joint, so it works at any
   hand rotation. The thumb is ignored.
4. A debouncer requires the same gesture for 6 frames, then enforces a 1 second
   cooldown and requires the hand to leave the pose before it can fire again.
5. Only the gesture name is posted to the page. The content script applies the
   mapped action to the page's `<video>`.

MediaPipe (JS bundle, WASM, and the `hand_landmarker.task` model) is bundled
under `vendor/`, so there is no remote code and no network call at runtime.

## Install (unpacked)

1. Open `chrome://extensions`, enable Developer mode.
2. Click Load unpacked and select this folder.
3. Open a page with a video (for example YouTube), reload it, click the
   extension icon, and press Start on this tab.
4. Allow the camera prompt.

## Tests

```
npm test
```

Covers the gesture classifier (including rotation), the debouncer, and the
video actions with a fake video element. No dependencies are needed.

## Known limitations

- The camera and MediaPipe path has not been benchmarked. No accuracy, latency
  or FPS numbers are claimed.
- Next short / previous short click YouTube's Shorts navigation buttons and are
  not verified against the live site.
- Only the SIMD WASM build is bundled, so very old browsers without WebAssembly
  SIMD are not supported.
- One hand at a time. Lighting and camera angle affect detection.
- Not published on the Chrome Web Store.

## Third party

MediaPipe Tasks Vision 0.10.21 and the hand landmarker model are by Google,
licensed Apache-2.0.

## License

MIT
