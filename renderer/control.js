function pad2(n) {
    return String(n).padStart(2, "0");
}
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
    fontScale: document.getElementById("fontScale")
};

let currentState = null;

async function refreshDisplays() {
    const displays = await window.api.getDisplays();
    els.monitorSelect.innerHTML = "";
    for (const d of displays) {
        const opt = document.createElement("option");
        opt.value = String(d.id);
        opt.textContent = d.label;
        els.monitorSelect.appendChild(opt);
    }
}

function clampSecondsInputs(secEl) {
    secEl.addEventListener("change", () => {
        let v = Number(secEl.value) || 0;
        v = Math.min(59, Math.max(0, v));
        secEl.value = pad2(v);
    });
}
clampSecondsInputs(els.durSec);
clampSecondsInputs(els.warnSec);

function applyFromUI() {
    const durationMs = msFromInputs(els.durMin, els.durSec);
    const warnMs = msFromInputs(els.warnMin, els.warnSec);

    const cfg = {
        durationMs,
        warnMs,
        blinkEnabled: els.blinkEnabled.checked,
        backgroundMode: els.bgMode.value,
        backgroundColor: els.bgColor.value,
        fullscreen: els.modeSelect.value === "true",
        monitorId: Number(els.monitorSelect.value) || null,
        fontScale: Number(els.fontScale.value) || 1.0
    };

    return window.api.setConfig(cfg);
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
    await applyFromUI(); // au cas où tu as modifié sans “appliquer”
    await window.api.start();
});

els.btnPause.addEventListener("click", async () => {
    await window.api.pause();
});

window.api.onState((state) => {
    currentState = state;
    els.remaining.textContent = formatMs(state.remainingMs);
    els.running.textContent = state.running ? "RUN" : "STOP";

    // synchro UI si besoin (quand tu relances)
    if (els.modeSelect.value !== String(!!state.fullscreen)) {
        els.modeSelect.value = String(!!state.fullscreen);
    }
    if (state.monitorId && els.monitorSelect.value !== String(state.monitorId)) {
        els.monitorSelect.value = String(state.monitorId);
    }
    els.bgMode.value = state.backgroundMode;
    els.bgColor.value = state.backgroundColor;
    els.blinkEnabled.checked = !!state.blinkEnabled;
    els.fontScale.value = String(state.fontScale ?? 1.0);
});

(async function init() {
    await refreshDisplays();
    // ouvre automatiquement la liste, mais n'ouvre pas la fenêtre timer
})();
