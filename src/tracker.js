// Runs inside tracker.html (extension origin). Camera frames and landmarks
// stay in this document; only the debounced gesture name is posted out.
import { FilesetResolver, HandLandmarker } from "../vendor/vision_bundle.mjs";

const { classify, createDebouncer } = self.HFMC;

const video = document.getElementById("cam");
const canvas = document.getElementById("overlay");
const labelEl = document.getElementById("label");
const ctx = canvas.getContext("2d");
const PARENT = window.parent;

let feedbackUntil = 0;

function setLabel(text) {
  labelEl.textContent = text;
}

function send(msg) {
  PARENT.postMessage(Object.assign({ source: "hfmc-tracker" }, msg), "*");
}

window.addEventListener("message", (event) => {
  if (event.source !== PARENT) return;
  const data = event.data;
  if (data && data.type === "feedback") {
    setLabel(data.text);
    feedbackUntil = performance.now() + 1200;
  }
});

function drawLandmarks(landmarks) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  ctx.fillStyle = "#22c55e";
  for (const p of landmarks) {
    ctx.beginPath();
    ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function main() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();

  setLabel("Loading hand model...");
  const fileset = await FilesetResolver.forVisionTasks("../vendor/wasm");
  const landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "../vendor/hand_landmarker.task" },
    runningMode: "VIDEO",
    numHands: 1,
  });

  const debouncer = createDebouncer({ stableFrames: 6, cooldownMs: 1000, releaseFrames: 3 });
  setLabel("Show a gesture");

  let lastVideoTime = -1;
  function loop() {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      const landmarks = result.landmarks && result.landmarks[0];
      drawLandmarks(landmarks);
      const gesture = landmarks ? classify(landmarks) : null;
      if (now > feedbackUntil) setLabel(gesture ? gesture.replace("_", " ") : "No gesture");
      const fired = debouncer.update(gesture, now);
      if (fired) send({ type: "gesture", gesture: fired });
    }
    video.requestVideoFrameCallback(loop);
  }
  video.requestVideoFrameCallback(loop);
}

main().catch((err) => {
  const message = err && err.name === "NotAllowedError" ? "Camera permission denied" : "Tracker error: " + (err && err.message);
  setLabel(message);
  send({ type: "error", message });
});
