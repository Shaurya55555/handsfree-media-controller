const test = require("node:test");
const assert = require("node:assert/strict");
const { classify, createDebouncer } = require("../src/gestures.js");
const { runAction, DEFAULT_MAPPING } = require("../src/actions.js");

// Synthetic hand: wrist at the bottom, fingers pointing up. A finger is either
// extended (tip far from wrist) or curled (tip back near the knuckle).
const BASES = { index: 5, middle: 9, ring: 13, pinky: 17 };
const XS = { index: 0.42, middle: 0.5, ring: 0.58, pinky: 0.66 };

function makeHand(extended, rotate) {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.9, z: 0 }));
  lm[0] = { x: 0.5, y: 0.9, z: 0 };
  for (const [name, base] of Object.entries(BASES)) {
    const x = XS[name];
    const isOut = extended.includes(name);
    lm[base] = { x, y: 0.65, z: 0 }; // MCP
    lm[base + 1] = { x, y: 0.55, z: 0 }; // PIP
    lm[base + 2] = { x, y: isOut ? 0.45 : 0.6, z: 0 }; // DIP
    lm[base + 3] = { x, y: isOut ? 0.35 : 0.64, z: 0 }; // TIP
  }
  if (rotate) {
    return lm.map((p) => ({ x: 0.5 + (p.y - 0.9), y: 0.9 - (p.x - 0.5), z: p.z }));
  }
  return lm;
}

test("classifies the five gestures", () => {
  assert.equal(classify(makeHand(["index", "middle", "ring", "pinky"])), "open_palm");
  assert.equal(classify(makeHand([])), "fist");
  assert.equal(classify(makeHand(["index"])), "index_up");
  assert.equal(classify(makeHand(["index", "middle"])), "peace");
  assert.equal(classify(makeHand(["index", "middle", "ring"])), "three_fingers");
});

test("unknown pose and bad input return null", () => {
  assert.equal(classify(makeHand(["pinky"])), null);
  assert.equal(classify(makeHand(["middle", "ring"])), null);
  assert.equal(classify(null), null);
  assert.equal(classify([]), null);
});

test("classification is rotation invariant", () => {
  assert.equal(classify(makeHand(["index", "middle"], true)), "peace");
  assert.equal(classify(makeHand([], true)), "fist");
});

test("debouncer needs N stable frames", () => {
  const d = createDebouncer({ stableFrames: 3, cooldownMs: 0, releaseFrames: 1 });
  assert.equal(d.update("fist", 0), null);
  assert.equal(d.update("fist", 33), null);
  assert.equal(d.update("fist", 66), "fist");
});

test("flicker between gestures never fires", () => {
  const d = createDebouncer({ stableFrames: 3, cooldownMs: 0, releaseFrames: 1 });
  const seq = ["fist", "peace", "fist", "peace", "fist", "peace"];
  const fired = seq.map((g, i) => d.update(g, i * 33)).filter(Boolean);
  assert.deepEqual(fired, []);
});

test("holding a pose fires once, then again only after release", () => {
  const d = createDebouncer({ stableFrames: 2, cooldownMs: 100, releaseFrames: 2 });
  let t = 0;
  const step = (g) => d.update(g, (t += 50));
  assert.equal(step("fist"), null);
  assert.equal(step("fist"), "fist");
  for (let i = 0; i < 10; i++) assert.equal(step("fist"), null); // still held
  assert.equal(step(null), null);
  assert.equal(step(null), null); // released
  assert.equal(step("fist"), null);
  assert.equal(step("fist"), "fist"); // fires again
});

test("cooldown blocks a different gesture right after firing", () => {
  const d = createDebouncer({ stableFrames: 1, cooldownMs: 1000, releaseFrames: 1 });
  assert.equal(d.update("fist", 0), "fist");
  assert.equal(d.update("peace", 100), null);
  assert.equal(d.update("peace", 1200), "peace");
});

function fakeVideo(over) {
  return Object.assign(
    { paused: true, muted: false, playbackRate: 1, currentTime: 20, duration: 100, play() { this.paused = false; }, pause() { this.paused = true; } },
    over
  );
}

test("play/pause and mute toggle", () => {
  const v = fakeVideo();
  assert.equal(runAction(v, "play_pause"), "Play");
  assert.equal(v.paused, false);
  assert.equal(runAction(v, "play_pause"), "Pause");
  assert.equal(runAction(v, "mute_toggle"), "Muted");
  assert.equal(v.muted, true);
});

test("speed is stepped by 0.25 and clamped to 0.25..2", () => {
  const v = fakeVideo({ playbackRate: 1.75 });
  runAction(v, "speed_up");
  assert.equal(v.playbackRate, 2);
  runAction(v, "speed_up");
  assert.equal(v.playbackRate, 2);
  v.playbackRate = 0.25;
  runAction(v, "speed_down");
  assert.equal(v.playbackRate, 0.25);
});

test("skip moves 10s and stays within the video", () => {
  const v = fakeVideo({ currentTime: 95 });
  runAction(v, "skip_forward");
  assert.equal(v.currentTime, 100);
  v.currentTime = 4;
  runAction(v, "skip_backward");
  assert.equal(v.currentTime, 0);
});

test("no video or 'none' does nothing", () => {
  assert.equal(runAction(null, "play_pause"), null);
  assert.equal(runAction(fakeVideo(), "none"), null);
});

test("default mapping only uses known actions", () => {
  const { ACTIONS } = require("../src/actions.js");
  for (const a of Object.values(DEFAULT_MAPPING)) assert.ok(ACTIONS.includes(a));
});
