function pad2(n) { return String(n).padStart(2, "0"); }

function formatMs(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${pad2(m)}:${pad2(s)}`;
}

const timeEl = document.getElementById("time");

window.api.onState((state) => {
    // fond
    if (state.backgroundMode === "color") {
        document.body.style.background = state.backgroundColor || "#00ff00";
    } else {
        document.body.style.background = "transparent";
    }

    // échelle de police
    const scale = state.fontScale ?? 1.0;
    timeEl.style.transform = `scale(${scale})`;

    // texte
    timeEl.textContent = formatMs(state.remainingMs);

    // classes blink / zero
    timeEl.classList.remove("blink", "zero");

    const shouldBlink =
        !!state.blinkEnabled &&
        state.remainingMs > 0 &&
        state.remainingMs <= (state.warnMs ?? 0);

    if (shouldBlink) timeEl.classList.add("blink");
    if (state.remainingMs <= 0) timeEl.classList.add("zero");
});

// Bonus pratique : double-click pour quitter le fullscreen (si tu l’as mis)
document.addEventListener("dblclick", () => {
    // Rien ici : le fullscreen est piloté par la fenêtre main.
    // Mais tu peux ajouter un IPC si tu veux.
});
