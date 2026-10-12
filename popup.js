const { GESTURES, ACTIONS, DEFAULT_MAPPING } = self.HFMC;

const toggleBtn = document.getElementById("toggle");
const statusEl = document.getElementById("status");
const mappingEl = document.getElementById("mapping");

const pretty = (s) => s.replace(/_/g, " ");

function activeTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then((t) => t[0]);
}

async function sendToTab(type) {
  const tab = await activeTab();
  if (!tab) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (_e) {
    return null; // restricted page, or tab loaded before the extension
  }
}

function render(running) {
  toggleBtn.textContent = running ? "Stop on this tab" : "Start on this tab";
  toggleBtn.dataset.running = running ? "1" : "";
}

toggleBtn.addEventListener("click", async () => {
  const running = !!toggleBtn.dataset.running;
  const res = await sendToTab(running ? "hfmc-stop" : "hfmc-start");
  if (!res) {
    statusEl.textContent = "Cannot run here. Open a page with a video and reload it.";
    return;
  }
  statusEl.textContent = "";
  render(res.running);
});

function buildMapping(mapping) {
  mappingEl.textContent = "";
  for (const gesture of GESTURES) {
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("label");
    label.textContent = pretty(gesture);
    const select = document.createElement("select");
    for (const action of ACTIONS) {
      const opt = document.createElement("option");
      opt.value = action;
      opt.textContent = pretty(action);
      if (mapping[gesture] === action) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener("change", () => {
      mapping[gesture] = select.value;
      chrome.storage.local.set({ mapping });
    });
    row.append(label, select);
    mappingEl.appendChild(row);
  }
}

document.getElementById("reset").addEventListener("click", () => {
  const mapping = Object.assign({}, DEFAULT_MAPPING);
  chrome.storage.local.set({ mapping });
  buildMapping(mapping);
});

(async function init() {
  const { mapping } = await chrome.storage.local.get("mapping");
  buildMapping(Object.assign({}, DEFAULT_MAPPING, mapping));
  const res = await sendToTab("hfmc-status");
  render(!!(res && res.running));
})();
