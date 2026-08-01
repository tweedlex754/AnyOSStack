'use strict';

// Preset save/load. A preset is a small JSON document describing a user's app
// selection (ids + target platform + language) so a curated install list can be
// shared across machines or teammates, Ninite/RepoHub style. The renderer builds
// and parses the JSON; this module only handles the native file dialogs and disk
// I/O, keeping fs out of the renderer.

const { ipcMain, dialog } = require('electron');
const fs = require('fs');

function registerFileOpsIpc(getWindow) {
  ipcMain.handle('preset:save', async (_e, { json, suggestedName }) => {
    const win = getWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save AnyOSStack preset',
      defaultPath: suggestedName || 'anyosstack-preset.json',
      filters: [{ name: 'AnyOSStack preset', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { saved: false };
    try {
      fs.writeFileSync(filePath, json, { encoding: 'utf8' });
      return { saved: true, path: filePath };
    } catch (err) {
      return { saved: false, reason: err.message };
    }
  });

  ipcMain.handle('preset:load', async () => {
    const win = getWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Open AnyOSStack preset',
      properties: ['openFile'],
      filters: [{ name: 'AnyOSStack preset', extensions: ['json'] }],
    });
    if (canceled || !filePaths || !filePaths[0]) return { loaded: false };
    try {
      const json = fs.readFileSync(filePaths[0], { encoding: 'utf8' });
      return { loaded: true, json };
    } catch (err) {
      return { loaded: false, reason: err.message };
    }
  });
}

module.exports = { registerFileOpsIpc };
