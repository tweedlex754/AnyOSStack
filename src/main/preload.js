'use strict';

// Preload: the ONLY bridge between the untrusted renderer and Node. It exposes a
// deliberately narrow, typed API on window.anyos. The renderer can ask to run a
// script or open a preset dialog, but it never receives a handle to
// child_process, fs, or ipcRenderer itself.

const { contextBridge, ipcRenderer } = require('electron');

// Channels the renderer is allowed to subscribe to, mapped to safe wrappers so a
// caller can never register listeners on arbitrary channels.
const OUTPUT_CHANNEL = 'run:output';
const EXIT_CHANNEL = 'run:exit';

contextBridge.exposeInMainWorld('anyos', {
  // 'win32' | 'darwin' | 'linux' - lets the renderer decide whether "Run Now"
  // is applicable to the script it just generated (host OS must match target).
  platform: process.platform,

  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Run the generated script with the host-appropriate interpreter.
  // kind: 'ps1' (Windows PowerShell) | 'sh' (bash, macOS/Linux).
  // Resolves to { started: true } or { started: false, reason }.
  runScript: (scriptText, kind) =>
    ipcRenderer.invoke('run:start', { scriptText, kind, elevated: false }),

  // Same, but request OS elevation (UAC / sudo / pkexec) up front.
  runScriptElevated: (scriptText, kind) =>
    ipcRenderer.invoke('run:start', { scriptText, kind, elevated: true }),

  cancelRun: () => ipcRenderer.invoke('run:cancel'),

  // Live output stream. Returns an unsubscribe function.
  onRunOutput: (cb) => {
    const listener = (_e, chunk) => cb(chunk);
    ipcRenderer.on(OUTPUT_CHANNEL, listener);
    return () => ipcRenderer.removeListener(OUTPUT_CHANNEL, listener);
  },
  onRunExit: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on(EXIT_CHANNEL, listener);
    return () => ipcRenderer.removeListener(EXIT_CHANNEL, listener);
  },

  // Preset save/load. savePreset resolves { saved, path } or { saved:false };
  // loadPreset resolves { loaded, json } or { loaded:false }.
  savePreset: (json, suggestedName) =>
    ipcRenderer.invoke('preset:save', { json, suggestedName }),
  loadPreset: () => ipcRenderer.invoke('preset:load'),

  // Custom title-bar window controls (frameless shell on Windows/Linux).
  win: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('win:toggle-maximize'),
    close: () => ipcRenderer.invoke('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
    onMaximizeChange: (cb) => {
      const listener = (_e, isMax) => cb(isMax);
      ipcRenderer.on('win:maximized-changed', listener);
      return () => ipcRenderer.removeListener('win:maximized-changed', listener);
    },
  },
});
