const debugEl = document.getElementById("debug");

function setDebug(msg) {
  if (debugEl) debugEl.textContent = msg;
}

if (!window.api) {
  setDebug("ERROR: window.api is missing (preload not loaded)");
} else {
  setDebug("OK: window.api loaded");
}

function pad2(n) { return String(n).padStart(2, "0"); }

function formatMs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

const timeEl = document.getElementById("time");

window.api.onState((state) => {
  // background
  if (state.backgroundMode === "color") {
    document.body.style.background = state.backgroundColor || "#00ff00";
  } else {
    document.body.style.background = "transparent";
  }

  // font scale
  const scale = state.fontScale ?? 1.0;
  timeEl.style.transform = `scale(${scale})`;

  // update time
  timeEl.textContent = formatMs(state.remainingMs);

  // blink logic
  timeEl.classList.remove("blink", "zero");

  const warn = state.warnMs ?? 0;
  const shouldBlink = !!state.blinkEnabled && state.remainingMs > 0 && state.remainingMs <= warn;

  if (shouldBlink) timeEl.classList.add("blink");
  if (state.remainingMs <= 0) timeEl.classList.add("zero");
});

