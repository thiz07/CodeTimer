function pad2(n) { return String(n).padStart(2, "0"); }

function formatMsCeil(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${pad2(m)}:${pad2(s)}`;
}

function formatMsFloor(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${pad2(m)}:${pad2(s)}`;
}

const timeEl = document.getElementById("time");
const overtimeEl = document.getElementById("overtime");

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
    overtimeEl.style.transform = `scale(${scale})`;

    // main timer (reste)
    timeEl.textContent = formatMsCeil(state.remainingMs);

    // overtime (depassement)
    const ot = Number(state.overtimeMs) || 0;
    if (ot > 0) {
        overtimeEl.textContent = "-" + formatMsFloor(ot);
        overtimeEl.classList.add("show");
    } else {
        overtimeEl.textContent = "";
        overtimeEl.classList.remove("show");
    }

    // blink / zero
    timeEl.classList.remove("blink", "zero");

    const warn = state.warnMs ?? 0;
    const shouldBlink = !!state.blinkEnabled && state.remainingMs > 0 && state.remainingMs <= warn;

    if (shouldBlink) timeEl.classList.add("blink");
    if (state.remainingMs <= 0) timeEl.classList.add("zero");
});
