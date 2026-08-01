'use strict';

// Auto-update wiring against GitHub Releases via electron-updater.
//
// The infrastructure ships in v1.0 but automatic background checks stay OFF
// until there is a prior published release to diff against (and, ideally, code
// signing - unsigned auto-updates can trip SmartScreen/Gatekeeper on every
// update, not just first install). Flip AUTO_CHECK to true from v1.1.0 onward.
// The manual "Check for Updates" menu item always works.

const AUTO_CHECK = false;

let autoUpdater = null;
function getUpdater() {
  if (autoUpdater === null) {
    try {
      ({ autoUpdater } = require('electron-updater'));
      autoUpdater.autoDownload = false;
    } catch (_) {
      autoUpdater = false; // dependency absent (e.g. dev without install)
    }
  }
  return autoUpdater || null;
}

function initUpdater(getWindow) {
  if (!AUTO_CHECK) return;
  const u = getUpdater();
  if (!u) return;
  u.checkForUpdates().catch(() => { /* offline / no releases yet: ignore */ });
}

function checkForUpdates(getWindow, interactive) {
  const { dialog } = require('electron');
  const u = getUpdater();
  if (!u) {
    if (interactive) {
      dialog.showMessageBox(getWindow(), {
        type: 'info', title: 'Updates',
        message: 'Update checking is unavailable in this build.',
        buttons: ['OK'],
      });
    }
    return;
  }

  u.removeAllListeners();
  u.on('update-available', (info) => {
    dialog.showMessageBox(getWindow(), {
      type: 'info', title: 'Update available',
      message: `AnyOSStack ${info.version} is available.`,
      detail: 'Download it now?',
      buttons: ['Download', 'Later'], cancelId: 1,
    }).then(({ response }) => { if (response === 0) u.downloadUpdate(); });
  });
  u.on('update-not-available', () => {
    if (interactive) {
      dialog.showMessageBox(getWindow(), {
        type: 'info', title: 'Updates',
        message: 'You are on the latest version.', buttons: ['OK'],
      });
    }
  });
  u.on('update-downloaded', () => {
    dialog.showMessageBox(getWindow(), {
      type: 'info', title: 'Update ready',
      message: 'Update downloaded. Restart to install?',
      buttons: ['Restart', 'Later'], cancelId: 1,
    }).then(({ response }) => { if (response === 0) u.quitAndInstall(); });
  });
  u.on('error', (err) => {
    if (interactive) {
      dialog.showMessageBox(getWindow(), {
        type: 'error', title: 'Update error',
        message: 'Could not check for updates.',
        detail: String(err && err.message ? err.message : err), buttons: ['OK'],
      });
    }
  });

  u.checkForUpdates().catch(() => { /* handled by error listener */ });
}

module.exports = { initUpdater, checkForUpdates };
