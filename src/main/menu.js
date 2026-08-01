'use strict';

// Native application menu. Kept intentionally small: the app's real navigation
// lives in the renderer. This provides the platform-expected menu bar (mostly
// for macOS, where an app without one feels broken), an About box, and a manual
// "Check for Updates" entry that drives the electron-updater flow.

const { Menu, app, dialog, shell } = require('electron');
const { checkForUpdates } = require('./updater');

const REPO_URL = 'https://github.com/tweedlex754/AnyOSStack';

function buildMenu(getWindow) {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { label: 'Check for Updates...', click: () => checkForUpdates(getWindow, true) },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        ...(!isMac ? [{ label: 'Check for Updates...', click: () => checkForUpdates(getWindow, true) }] : []),
        {
          label: 'About AnyOSStack',
          click: () => {
            dialog.showMessageBox(getWindow(), {
              type: 'info',
              title: 'About AnyOSStack',
              message: 'AnyOSStack',
              detail: `Version ${app.getVersion()}\nOne stack for every OS.\n\nLicensed under GPL-3.0.`,
              buttons: ['OK'],
            });
          },
        },
        { label: 'Project on GitHub', click: () => shell.openExternal(REPO_URL) },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
