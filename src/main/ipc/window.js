'use strict';

// Window-control IPC for the custom (frameless) title bar. On Windows/Linux the
// renderer draws its own minimize/maximize/close buttons and calls these; on
// macOS the native traffic lights are used instead (hiddenInset), so only the
// maximize-state notifications matter there.

const { ipcMain } = require('electron');

function registerWindowIpc(getWindow) {
  ipcMain.handle('win:minimize', () => { const w = getWindow(); if (w) w.minimize(); });
  ipcMain.handle('win:toggle-maximize', () => {
    const w = getWindow();
    if (!w) return false;
    if (w.isMaximized()) { w.unmaximize(); return false; }
    w.maximize();
    return true;
  });
  ipcMain.handle('win:close', () => { const w = getWindow(); if (w) w.close(); });
  ipcMain.handle('win:is-maximized', () => {
    const w = getWindow();
    return !!(w && w.isMaximized());
  });

  // Push maximize-state changes so the button can swap its restore/maximize glyph.
  function wire(win) {
    if (!win) return;
    const send = () => {
      if (!win.isDestroyed()) win.webContents.send('win:maximized-changed', win.isMaximized());
    };
    win.on('maximize', send);
    win.on('unmaximize', send);
  }
  return { wire };
}

module.exports = { registerWindowIpc };
