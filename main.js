const { app, BrowserWindow, ipcMain, screen, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

function safeLog(...args) {
    try {
        const p = path.join(app.getPath("userData"), "codetimer.log");
        const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
        fs.appendFileSync(p, line, "utf8");
    } catch { }
}

process.on("uncaughtException", (err) => {
    safeLog("uncaughtException:", err?.stack || String(err));
    try { dialog.showErrorBox("CodeTimer crash", String(err?.stack || err)); } catch { }
});

process.on("unhandledRejection", (err) => {
    safeLog("unhandledRejection:", String(err));
    try { dialog.showErrorBox("CodeTimer error", String(err)); } catch { }
});

let controlWin = null;
let displayWin = null;

let timerState = {
    durationMs: 15 * 60 * 1000,
    remainingMs: 15 * 60 * 1000,
    running: false,
    endTime: 0,
    warnMs: 3 * 60 * 1000,
    blinkEnabled: true,
    backgroundMode: "transparent", // "transparent" | "color"
    backgroundColor: "#00ff00",
    fullscreen: true,
    monitorId: null,
    fontScale: 1.0
};

let tickInterval = null;
let lastWindowedBounds = null;


// --------- Windows creation ---------

function createControlWindow() {
    controlWin = new BrowserWindow({
        width: 520,
        height: 720,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true
        }
    });

    controlWin.setMenuBarVisibility(false);
    controlWin.loadFile(path.join(__dirname, "renderer", "control.html"));

    controlWin.once("ready-to-show", () => {
        controlWin.show();
        controlWin.focus();
    });

    controlWin.on("closed", () => {
        controlWin = null;
    });
}

function getTargetDisplay() {
    const displays = screen.getAllDisplays();

    if (timerState.monitorId) {
        const found = displays.find(d => d.id === timerState.monitorId);
        if (found) return found;
    }

    return displays[displays.length - 1] || screen.getPrimaryDisplay();
}

function createDisplayWindow() {
    const target = getTargetDisplay();
    const b = target.bounds;

    displayWin = new BrowserWindow({
        x: b.x + 50,
        y: b.y + 50,
        width: 900,
        height: 500,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: "#00000000",
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true
        }
    });

    displayWin.setMenuBarVisibility(false);
    displayWin.loadFile(path.join(__dirname, "renderer", "display.html"));

    displayWin.once("ready-to-show", () => {
        placeDisplayWindow();
        displayWin.show();
    });

    displayWin.on("closed", () => {
        displayWin = null;
    });
}

function placeDisplayWindow() {
    if (!displayWin) return;

    const target = getTargetDisplay();
    timerState.monitorId = target.id;

    const b = target.bounds;
    const wantFull = !!timerState.fullscreen;

    // sortir du fullscreen avant de déplacer
    if (displayWin.isFullScreen()) displayWin.setFullScreen(false);

    const width = wantFull ? b.width : 900;
    const height = wantFull ? b.height : 500;

    const x = wantFull ? b.x : Math.round(b.x + (b.width - width) / 2);
    const y = wantFull ? b.y : Math.round(b.y + (b.height - height) / 2);

    displayWin.setBounds({ x, y, width, height }, false);

    if (wantFull) displayWin.setFullScreen(true);

    displayWin.setAlwaysOnTop(true, "screen-saver");
}

// --------- Timer logic ---------

function startTicker() {
    if (tickInterval) return;
    tickInterval = setInterval(() => {
        if (!timerState.running) return;

        const now = Date.now();
        timerState.remainingMs = Math.max(0, timerState.endTime - now);

        broadcastState();

        if (timerState.remainingMs <= 0) {
            timerState.running = false;
            broadcastState();
        }
    }, 100);
}

function broadcastState() {
    if (controlWin) controlWin.webContents.send("timer:state", timerState);
    if (displayWin) displayWin.webContents.send("timer:state", timerState);
}

// --------- IPC ---------

ipcMain.handle("app:getDisplays", () => {
    return screen.getAllDisplays().map(d => ({
        id: d.id,
        label: `${d.id} — ${d.size.width}x${d.size.height} (${d.bounds.x},${d.bounds.y})`
    }));
});

ipcMain.handle("display:open", () => {
    if (!displayWin) createDisplayWindow();
    broadcastState();
    return true;
});

ipcMain.handle("display:close", () => {
    if (displayWin) displayWin.close();
    displayWin = null;
    return true;
});

ipcMain.handle("timer:setConfig", (_evt, cfg) => {
    timerState = { ...timerState, ...cfg };

    timerState.durationMs = Math.max(0, Number(timerState.durationMs) || 0);
    timerState.warnMs = Math.max(0, Number(timerState.warnMs) || 0);
    timerState.fontScale = Math.min(3, Math.max(0.3, Number(timerState.fontScale) || 1.0));

    if (!timerState.running) {
        timerState.remainingMs = timerState.durationMs;
    }

    if (displayWin) placeDisplayWindow();

    broadcastState();
    return timerState;
});

ipcMain.handle("timer:reset", () => {
    timerState.running = false;
    timerState.remainingMs = timerState.durationMs;
    broadcastState();
    return timerState;
});

ipcMain.handle("timer:start", () => {
    if (timerState.remainingMs <= 0) timerState.remainingMs = timerState.durationMs;
    timerState.running = true;
    timerState.endTime = Date.now() + timerState.remainingMs;
    startTicker();
    broadcastState();
    return timerState;
});

ipcMain.handle("timer:pause", () => {
    if (!timerState.running) return timerState;
    timerState.remainingMs = Math.max(0, timerState.endTime - Date.now());
    timerState.running = false;
    broadcastState();
    return timerState;
});

// --------- App lifecycle ---------

app.whenReady().then(() => {
    safeLog("App ready. __dirname =", __dirname);
    createControlWindow();
    startTicker();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

