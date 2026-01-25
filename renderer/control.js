function pad2(n) { return String(n).padStart(2, "0"); }

function formatMs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function msFromInputs(minEl, secEl) {
  const m = Math.max(0, Number(minEl.value) || 0);
  const s = Math.min(59, Math.max(0, Number(secEl.value) || 0));
  return (m * 60 + s) * 1000;
}

const els = {
  btnOpenDisplay: document.getElementById("btnOpenDisplay"),
  btnCloseDisplay: document.getElementById("btnCloseDisplay"),
  monitorSelect: document.getElementById("monitorSelect"),
  modeSelect: document.getElementById("modeSelect"),

  durMin: document.getElementById("durMin"),
  durSec: document.getElementById("durSec"),
  warnMin: document.getElementById("warnMin"),
  warnSec: document.getElementById("warnSec"),
  blinkEnabled: document.getElementById("blinkEnabled"),

  btnApply: document.getElementById("btnApply"),
  btnReset: document.getElementById("btnReset"),
  btnStart: document.getElementById("btnStart"),
  btnPause: document.getElementById("btnPause"),

  remaining: document.getElementById("remaining"),
  running: document.getElementById("running"),

  bgMode: document.getElementById("bgMode"),
  bgColor: document.getElementById("bgColor"),
  fontScale: document.getElementById("fontScale"),

  posX: document.getElementById("posX"),
  posY: document.getElementById("posY"),
  posW: document.getElementById("posW"),
  posH: document.getElementById("posH"),
  btnReadBounds: document.getElementById("btnReadBounds"),
  btnApplyBounds: document.getElementById("btnApplyBounds")
};

let lastState = null;

function clampSec(el) {
  el.addEventListener("change", () => {
    let v = Number(el.value) || 0;
    v = Math.min(59, Math.max(0, v));
    el.value = pad2(v);
  });
}
clampSec(els.durSec);
clampSec(els.warnSec);

async function refreshDisplays() {
  const displays = await window.api.getDisplays();
  els.monitorSelect.innerHTML = "";

  for (const d of displays) {
    const opt = document.createElement("option");
    opt.value = String(d.id);
    opt.textContent = d.label;
    els.monitorSelect.appendChild(opt);
  }

  // default selection if state known
  if (lastState?.monitorId) {
    els.monitorSelect.value = String(lastState.monitorId);
  }
}

async function applyFromUI() {
  const cfg = {
    durationMs: msFromInputs(els.durMin, els.durSec),
    warnMs: msFromInputs(els.warnMin, els.warnSec),
    blinkEnabled: els.blinkEnabled.checked,
    backgroundMode: els.bgMode.value,
    backgroundColor: els.bgColor.value,
    fullscreen: els.modeSelect.value === "true",
    monitorId: Number(els.monitorSelect.value) || null,
    fontScale: Number(els.fontScale.value) || 1.0
  };
  return await window.api.setConfig(cfg);
}

els.btnOpenDisplay.addEventListener("click", async () => {
  await window.api.openDisplay();
  await applyFromUI();
});

els.btnCloseDisplay.addEventListener("click", async () => {
  await window.api.closeDisplay();
});

els.btnApply.addEventListener("click", async () => {
  await applyFromUI();
});

els.btnReset.addEventListener("click", async () => {
  await window.api.reset();
});

els.btnStart.addEventListener("click", async () => {
  await applyFromUI();
  await window.api.start();
});

els.btnPause.addEventListener("click", async () => {
  await window.api.pause();
});

els.btnReadBounds.addEventListener("click", async () => {
  const b = await window.api.getDisplayBounds();
  if (!b) return;
  els.posX.value = b.x;
  els.posY.value = b.y;
  els.posW.value = b.width;
  els.posH.value = b.height;
});

els.btnApplyBounds.addEventListener("click", async () => {
  // ensure display exists
  await window.api.openDisplay();

  // force windowed
  els.modeSelect.value = "false";
  await applyFromUI();

  const bounds = {
    x: Number(els.posX.value),
    y: Number(els.posY.value),
    width: Number(els.posW.value),
    height: Number(els.posH.value)
  };
  await window.api.setDisplayBounds(bounds);
});

window.api.onState(async (state) => {
  lastState = state;
  els.remaining.textContent = formatMs(state.remainingMs);
  els.running.textContent = state.running ? "RUN" : "STOP";

  // sync UI
  els.bgMode.value = state.backgroundMode;
  els.bgColor.value = state.backgroundColor;
  els.blinkEnabled.checked = !!state.blinkEnabled;
  els.fontScale.value = String(state.fontScale ?? 1.0);
  els.modeSelect.value = String(!!state.fullscreen);

  // keep monitor selection synced when possible
  if (state.monitorId) els.monitorSelect.value = String(state.monitorId);
});

(async function init() {
  await refreshDisplays();
})();
