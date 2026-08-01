'use strict';

// AnyOSStack - Electron main process.
// Owns the single BrowserWindow that hosts the renderer (the original web app,
// copied verbatim) and wires up the desktop-only IPC surface: the optional
// "Run Now" script executor and the preset save/load dialogs. The renderer runs
// with contextIsolation on and nodeIntegration off; it never touches Node
// directly and can only reach the whitelisted bridge exposed by preload.js.

const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

const { registerRunScriptIpc } = require('./ipc/runScript');
const { registerFileOpsIpc } = require('./ipc/fileOps');
const { registerWindowIpc } = require('./ipc/window');
const { buildMenu } = require('./menu');
const { initUpdater } = require('./updater');

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
const BUILD_DIR = path.join(__dirname, '..', '..', 'build');
const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';

// App icon for the window/taskbar. On Windows the taskbar icon comes from the
// embedded exe icon, but setting it here also fixes the in-window/dev icon.
const WINDOW_ICON = path.join(BUILD_DIR, process.platform === 'win32' ? 'icon.ico' : 'icons/icon-512.png');

let mainWindow = null;
let wireMaximize = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#181410', // matches the app's near-black ink; avoids white flash on load
    show: false,
    // Native desktop chrome instead of a browser window: a frameless shell with
    // our own title bar on Windows/Linux, and the inset traffic-lights on macOS.
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
    title: 'AnyOSStack',
    icon: WINDOW_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload needs Node built-ins (child_process/fs) behind the bridge
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadFile(path.join(RENDERER_DIR, 'index.html'));
  if (wireMaximize) wireMaximize(mainWindow);

  // External links (GitHub, "Inspired by" projects) open in the user's real
  // browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (url !== current) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function hardenSession() {
  // Belt-and-suspenders on top of the renderer's own CSP meta tag: deny every
  // permission request (camera, geolocation, notifications, ...). A package
  // installer front-end never needs any of them.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
}

// Single-instance: focus the existing window instead of opening a second one.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    hardenSession();
    registerRunScriptIpc(() => mainWindow);
    registerFileOpsIpc(() => mainWindow);
    ({ wire: wireMaximize } = registerWindowIpc(() => mainWindow));
    createWindow();
    buildMenu(() => mainWindow);
    initUpdater(() => mainWindow);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
