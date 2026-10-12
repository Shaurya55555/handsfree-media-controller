/*
 * Content script. Hosts the tracker iframe (extension origin, owns the camera
 * and MediaPipe), receives debounced gesture names from it, and applies the
 * user's mapping to the page's <video>. No video frames are handled here.
 */
(function () {
  if (window.top !== window) return; // only the top frame hosts the tracker

  const { DEFAULT_MAPPING, findVideo, runAction } = self.HFMC;
  const TRACKER_URL = chrome.runtime.getURL("tracker.html");
  const TRACKER_ORIGIN = new URL(TRACKER_URL).origin;

  let frame = null;
  let mapping = Object.assign({}, DEFAULT_MAPPING);

  function loadMapping() {
    chrome.storage.local.get("mapping", (res) => {
      mapping = Object.assign({}, DEFAULT_MAPPING, res && res.mapping);
    });
  }
  loadMapping();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.mapping) loadMapping();
  });

  function start() {
    if (frame) return;
    frame = document.createElement("iframe");
    frame.src = TRACKER_URL;
    frame.allow = "camera";
    frame.setAttribute("data-hfmc", "tracker");
    frame.style.cssText =
      "position:fixed;right:12px;bottom:12px;width:200px;height:170px;" +
      "border:2px solid #4f46e5;border-radius:8px;z-index:2147483647;" +
      "background:#000;box-shadow:0 2px 10px rgba(0,0,0,.4);";
    document.documentElement.appendChild(frame);
  }

  function stop() {
    if (!frame) return;
    frame.remove(); // removing the iframe releases the camera
    frame = null;
  }

  function post(msg) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage(msg, TRACKER_ORIGIN);
  }

  window.addEventListener("message", (event) => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== TRACKER_ORIGIN) return;
    const data = event.data;
    if (!data || data.source !== "hfmc-tracker") return;

    if (data.type === "gesture") {
      const action = mapping[data.gesture];
      const label = runAction(findVideo(document), action, document);
      post({ type: "feedback", text: label || "No video" });
    } else if (data.type === "error") {
      post({ type: "feedback", text: data.message });
    }
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "hfmc-start") start();
    else if (msg && msg.type === "hfmc-stop") stop();
    else if (msg && msg.type === "hfmc-status") {
      sendResponse({ running: !!frame });
      return;
    }
    sendResponse({ running: !!frame });
  });
})();
