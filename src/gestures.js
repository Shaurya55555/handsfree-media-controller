/*
 * Gesture classification and debouncing. No browser APIs, so it runs in the
 * extension (classic script, global HFMC) and in Node (require) for tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HFMC = Object.assign(root.HFMC || {}, api);
})(typeof self !== "undefined" ? self : this, function () {
  // MediaPipe hand landmark ids.
  const WRIST = 0;
  const FINGERS = {
    index: { pip: 6, tip: 8 },
    middle: { pip: 10, tip: 12 },
    ring: { pip: 14, tip: 16 },
    pinky: { pip: 18, tip: 20 },
  };

  const GESTURES = ["open_palm", "fist", "index_up", "peace", "three_fingers"];

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  }

  // A finger counts as extended when its tip is clearly farther from the
  // wrist than its PIP joint. Distance based, so it works at any hand rotation.
  function extendedFingers(landmarks) {
    const wrist = landmarks[WRIST];
    const out = {};
    for (const [name, { pip, tip }] of Object.entries(FINGERS)) {
      out[name] = dist(landmarks[tip], wrist) > dist(landmarks[pip], wrist) * 1.15;
    }
    return out;
  }

  // Returns one of GESTURES, or null when the pose is not a known gesture.
  // The thumb is ignored on purpose: it is the least reliable landmark group.
  function classify(landmarks) {
    if (!landmarks || landmarks.length < 21) return null;
    const f = extendedFingers(landmarks);
    const key = [f.index, f.middle, f.ring, f.pinky].map((v) => (v ? 1 : 0)).join("");
    switch (key) {
      case "1111": return "open_palm";
      case "0000": return "fist";
      case "1000": return "index_up";
      case "1100": return "peace";
      case "1110": return "three_fingers";
      default: return null;
    }
  }

  // Fires a gesture once after it has been seen for `stableFrames` frames in a
  // row. After firing, nothing fires until `cooldownMs` has passed AND the
  // hand has left that gesture (different gesture or no gesture) for
  // `releaseFrames` frames, so holding a pose does not toggle repeatedly.
  function createDebouncer(opts) {
    const stableFrames = (opts && opts.stableFrames) || 6;
    const cooldownMs = opts && opts.cooldownMs != null ? opts.cooldownMs : 1000;
    const releaseFrames = (opts && opts.releaseFrames) || 3;

    let candidate = null;
    let count = 0;
    let firedGesture = null;
    let released = 0;
    let cooldownUntil = -Infinity;

    return {
      update(gesture, now) {
        if (firedGesture !== null) {
          if (gesture !== firedGesture) {
            released += 1;
            if (released >= releaseFrames) {
              firedGesture = null;
              released = 0;
            }
          } else {
            released = 0;
          }
        }

        if (gesture === candidate) count += 1;
        else {
          candidate = gesture;
          count = 1;
        }

        if (
          gesture !== null &&
          count >= stableFrames &&
          firedGesture === null &&
          now >= cooldownUntil
        ) {
          firedGesture = gesture;
          released = 0;
          cooldownUntil = now + cooldownMs;
          return gesture;
        }
        return null;
      },
      reset() {
        candidate = null;
        count = 0;
        firedGesture = null;
        released = 0;
        cooldownUntil = -Infinity;
      },
    };
  }

  return { GESTURES, classify, extendedFingers, createDebouncer };
});
