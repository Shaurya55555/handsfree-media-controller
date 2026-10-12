/*
 * Actions applied to the page's <video> element. Classic script (global HFMC)
 * so the content script can use it; also loadable in Node for tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HFMC = Object.assign(root.HFMC || {}, api);
})(typeof self !== "undefined" ? self : this, function () {
  const ACTIONS = [
    "none",
    "play_pause",
    "mute_toggle",
    "speed_up",
    "speed_down",
    "skip_forward",
    "skip_backward",
    "next_short",
    "prev_short",
  ];

  const DEFAULT_MAPPING = {
    open_palm: "play_pause",
    fist: "mute_toggle",
    index_up: "speed_up",
    peace: "skip_forward",
    three_fingers: "skip_backward",
  };

  const SPEED_MIN = 0.25;
  const SPEED_MAX = 2;
  const SPEED_STEP = 0.25;
  const SKIP_SECONDS = 10;

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  // Prefer a playing video, then the largest visible one.
  function findVideo(doc) {
    const videos = Array.from(doc.querySelectorAll("video"));
    if (!videos.length) return null;
    const playing = videos.find((v) => !v.paused && !v.ended);
    if (playing) return playing;
    const area = (v) => {
      const r = v.getBoundingClientRect();
      return r.width * r.height;
    };
    return videos.sort((a, b) => area(b) - area(a))[0];
  }

  // Returns a short label describing what happened (shown in the overlay),
  // or null when there was nothing to act on.
  function runAction(video, action, doc) {
    if (!action || action === "none") return null;

    if (action === "next_short" || action === "prev_short") {
      const sel = action === "next_short" ? "#navigation-button-down button" : "#navigation-button-up button";
      const btn = doc && doc.querySelector(sel);
      if (!btn) return null;
      btn.click();
      return action === "next_short" ? "Next short" : "Previous short";
    }

    if (!video) return null;
    switch (action) {
      case "play_pause":
        if (video.paused) {
          const p = video.play();
          if (p && p.catch) p.catch(() => {});
          return "Play";
        }
        video.pause();
        return "Pause";
      case "mute_toggle":
        video.muted = !video.muted;
        return video.muted ? "Muted" : "Unmuted";
      case "speed_up":
        video.playbackRate = clamp(video.playbackRate + SPEED_STEP, SPEED_MIN, SPEED_MAX);
        return "Speed " + video.playbackRate + "x";
      case "speed_down":
        video.playbackRate = clamp(video.playbackRate - SPEED_STEP, SPEED_MIN, SPEED_MAX);
        return "Speed " + video.playbackRate + "x";
      case "skip_forward":
        video.currentTime = clamp(video.currentTime + SKIP_SECONDS, 0, video.duration || Infinity);
        return "+" + SKIP_SECONDS + "s";
      case "skip_backward":
        video.currentTime = clamp(video.currentTime - SKIP_SECONDS, 0, video.duration || Infinity);
        return "-" + SKIP_SECONDS + "s";
      default:
        return null;
    }
  }

  return { ACTIONS, DEFAULT_MAPPING, findVideo, runAction };
});
