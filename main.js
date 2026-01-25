const { app, BrowserWindow, ipcMain, screen, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

function safeLog(...args) {
  try {
    const p = path.join(app.getPath("userData"), "codetimer.log");
    const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
    fs.appendFileSync(p, line, "utf8");
  } catch {}
}

process.on("uncaughtException", (err) => {
  safeLog("uncaughtException:", err?.stack || String(err));
  try { dialog.showErrorBox("CodeTimer crash", String(err?.stack || err)); } catch {}
});

process.on("unhandledRejection", (err) => {
  safeLog("unhandledRejection:", String(err));
  try { dialog.showErrorBox("CodeTimer error", String(err)); } catch {}
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

// --- mémorisation position/taille fenêtré ---
let lastWindowedBounds = null;
const boundsFile = () => path.join(app.getPath("userData"), "windowedBounds.json");

function loadBoundsFromDisk() {
  try {
    const p = boundsFile();
    if (fs.existsSync(p)) {
      const obj = JSON.parse(fs.readFileSync(p, "utf8"));
      if (obj && typeof obj.x === "number" && typeof obj.y === "number") {
        lastWindowedBounds = obj;
      }
    }
  } catch (e) {
    safeLog("loadBounds error:", String(e));
  }
}

function saveBoundsToDisk(bounds) {
  try {
    fs.writeFileSync(boundsFile(), JSON.stringify(bounds), "utf8");
  } catch (e) {
    safeLog("saveBounds error:", String(e));
  }
}

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

  // par défaut : dernier écran
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

  // ✅ IMPORTANT : enregistrer position/taille quand tu bouges/redimensionnes (fenêtré)
  const rememberBounds = () => {
    try {
      if (!displayWin) return;
      if (displayWin.isFullScreen()) return; // on ne mémorise pas en plein écran
      const bds = displayWin.getBounds();
      lastWindowedBounds = bds;
      saveBoundsToDisk(bds);
    } catch {}
  };

  displayWin.on("move", rememberBounds);
  displayWin.on("resize", rememberBounds);

  displayWin.once("ready-to-show", () => {
    placeDisplayWindow({ force: true });
    displayWin.show();
  });

  displayWin.on("closed", () => {
    displayWin = null;
  });
}

// options: { force: boolean }
function placeDisplayWindow(options = {}) {
  if (!displayWin) return;

  const target = getTargetDisplay();
  timerState.monitorId = target.id;

  const bounds = target.bounds;
  const wantFull = !!timerState.fullscreen;

  // Toujours sortir du fullscreen avant de déplacer
  if (displayWin.isFullScreen()) displayWin.setFullScreen(false);

  if (!wantFull) {
    // Fenêtré : on garde les bounds existants si l'utilisateur a déjà bougé la fenêtre
    if (lastWindowedBounds) {
      displayWin.setBounds(lastWindowedBounds, false);
    } else {
      // première fois : centré + taille défaut
      const width = 900;
      const height = 500;
      const x = Math.round(bounds.x + (bounds.width - width) / 2);
      const y = Math.round(bounds.y + (bounds.height - height) / 2);
      displayWin.setBounds({ x, y, width, height }, false);
    }
    displayWin.setAlwaysOnTop(true, "screen-saver");
    return;
  }

  // Plein écran : coller à l'écran choisi
  displayWin.setBounds(
    { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    false
  );
  displayWin.setFullScreen(true);
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
// ✅ NOUVEAU : lire les bounds actuels de la fenêtre Timer
ipcMain.handle("display:getBounds", () => {
  if (!displayWin) return null;
  return displayWin.getBounds(); // {x,y,width,height}
});

// ✅ NOUVEAU : appliquer des bounds (fenêtré) à la fenêtre Timer
ipcMain.handle("display:setBounds", (_evt, bds) => {
  if (!displayWin) return false;

  // On force le mode fenêtré si on applique une position/taille
  timerState.fullscreen = false;

  try {
    if (displayWin.isFullScreen()) displayWin.setFullScreen(false);

    // Sécurités : nombres + minimums
    const x = Number(bds?.x);
    const y = Number(bds?.y);
    const width = Math.max(200, Number(bds?.width) || 900);
    const height = Math.max(120, Number(bds?.height) || 500);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

    const next = { x, y, width, height };

    displayWin.setBounds(next, false);

    // mémorise pour les prochains lancements (si tu as lastWindowedBounds + saveBoundsToDisk)
    if (typeof lastWindowedBounds !== "undefined") lastWindowedBounds = next;
    if (typeof saveBoundsToDisk === "function") saveBoundsToDisk(next);

    displayWin.setAlwaysOnTop(true, "screen-saver");
    broadcastState();
    return true;
  } catch (e) {
    safeLog("display:setBounds error:", String(e));
    return false;
  }
});


ipcMain.handle("timer:setConfig", (_evt, cfg) => {
  // 🔒 on sauvegarde l'état avant modif pour savoir si on doit repositionner
  const prevFullscreen = timerState.fullscreen;
  const prevMonitorId = timerState.monitorId;

  timerState = { ...timerState, ...cfg };

  timerState.durationMs = Math.max(0, Number(timerState.durationMs) || 0);
  timerState.warnMs = Math.max(0, Number(timerState.warnMs) || 0);
  timerState.fontScale = Math.min(3, Math.max(0.3, Number(timerState.fontScale) || 1.0));

  if (!timerState.running) {
    timerState.remainingMs = timerState.durationMs;
  }

  // ✅ Ne repositionner QUE si écran/plein écran change
  const monitorChanged = (cfg.monitorId != null && Number(cfg.monitorId) !== prevMonitorId);
  const fullscreenChanged = (typeof cfg.fullscreen === "boolean" && cfg.fullscreen !== prevFullscreen);

  if (displayWin && (monitorChanged || fullscreenChanged)) {
    // si on change d'écran, on évite un vieux bounds fenêtré hors écran
    if (monitorChanged) lastWindowedBounds = null;
    placeDisplayWindow({ force: true });
  }

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
  loadBoundsFromDisk();
  createControlWindow();
  startTicker();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

