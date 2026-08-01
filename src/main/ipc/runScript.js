'use strict';

// "Run Now" executor. Writes the renderer-supplied script to a temp file and
// runs it with the host-appropriate interpreter, streaming stdout/stderr back to
// the renderer live (never buffered-then-dumped). This is the highest-risk code
// in the app, so the rules are strict:
//   - Only ONE run at a time.
//   - The script text is whatever the user reviewed and confirmed in the UI; we
//     execute it verbatim, we do not synthesize commands here.
//   - The temp file is always deleted when the process exits.
//   - Elevation is opt-in and delegated to `sudo-prompt`, which handles UAC on
//     Windows, the osascript admin dialog on macOS, and pkexec/gksudo on Linux.

const { ipcMain, app } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let child = null; // the single in-flight non-elevated process, if any
// sudo-prompt hands back no process handle, so an elevated run has to be
// tracked separately or the "one run at a time" rule below only covers half the
// cases - and two runs sharing one temp path can delete each other's script.
let elevatedRunning = false;
let tempFile = null;
let tempDir = null;

function send(getWindow, channel, payload) {
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function writeTempScript(scriptText, kind) {
  const ext = kind === 'ps1' ? 'ps1' : 'sh';
  // The script is written into a private directory, not straight into the temp
  // root. os.tmpdir() is /tmp on macOS and Linux - world-writable and shared -
  // and the old name (anyosstack-run-<Date.now()>.sh) was guessable, so another
  // local user could pre-create that path as a symlink and have us write
  // through it, or swap the file between the write and the exec. mkdtemp
  // creates the directory 0700 with a random suffix, and 'wx' makes an existing
  // path an error instead of a target. mode 0600 closes the window where the
  // file was briefly readable before chmod.
  tempDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'anyosstack-'));
  try { fs.chmodSync(tempDir, 0o700); } catch (_) { /* best effort on Windows */ }
  const file = path.join(tempDir, `run.${ext}`);
  fs.writeFileSync(file, scriptText, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  if (ext === 'sh') {
    try { fs.chmodSync(file, 0o700); } catch (_) { /* best effort */ }
  }
  return file;
}

function cleanupTemp() {
  if (tempFile) {
    try { fs.unlinkSync(tempFile); } catch (_) { /* already gone */ }
    tempFile = null;
  }
  if (tempDir) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) { /* already gone */ }
    tempDir = null;
  }
}

function interpreterFor(kind, file) {
  if (kind === 'ps1') {
    return { cmd: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file] };
  }
  return { cmd: '/bin/bash', args: [file] };
}

// Non-elevated run: full live streaming via child_process pipes.
function runStreaming(getWindow, scriptText, kind) {
  tempFile = writeTempScript(scriptText, kind);
  const { cmd, args } = interpreterFor(kind, tempFile);

  child = spawn(cmd, args, { windowsHide: true });

  child.stdout.on('data', (d) =>
    send(getWindow, 'run:output', { stream: 'stdout', text: d.toString() }));
  child.stderr.on('data', (d) =>
    send(getWindow, 'run:output', { stream: 'stderr', text: d.toString() }));

  child.on('error', (err) => {
    send(getWindow, 'run:output', { stream: 'stderr', text: `\n[launch error] ${err.message}\n` });
    send(getWindow, 'run:exit', { code: -1, elevated: false });
    cleanupTemp();
    child = null;
  });

  child.on('exit', (code) => {
    send(getWindow, 'run:exit', { code: code == null ? -1 : code, elevated: false });
    cleanupTemp();
    child = null;
  });

  return { started: true };
}

// sudo-prompt takes a COMMAND LINE, not an argv array, and hands it to a shell
// running as administrator/root - the highest-privilege string this app builds.
// The old code only wrapped arguments containing a space in quotes, so a temp
// path holding a quote or a shell metacharacter would have escaped its quoting.
// The path is ours (mkdtemp under the temp root) but the temp root comes from
// the environment, so refuse rather than hope: a mangled command must not reach
// a root shell.
// Windows paths legitimately contain backslashes; on POSIX a backslash in an
// argument is an escape and is treated as unsafe too.
const UNSAFE_IN_COMMAND = process.platform === 'win32'
  ? /["'`$&|;<>()\r\n]/
  : /["'`$&|;<>()\\\r\n]/;

function shellArg(a) {
  if (UNSAFE_IN_COMMAND.test(a)) {
    throw new Error(`refusing to elevate: unsafe character in "${a}"`);
  }
  return /\s/.test(a) ? `"${a}"` : a;
}

// Elevated run: sudo-prompt spawns a privileged shell whose combined output is
// returned once at the end (it does not expose a live pipe), so we forward it in
// one block. Used only for the "retry elevated" path.
function runElevated(getWindow, scriptText, kind) {
  let sudo;
  try {
    sudo = require('sudo-prompt');
  } catch (_) {
    send(getWindow, 'run:output', {
      stream: 'stderr',
      text: '\n[elevation unavailable] sudo-prompt is not installed.\n',
    });
    send(getWindow, 'run:exit', { code: -1, elevated: true });
    return { started: false, reason: 'no-sudo-prompt' };
  }

  tempFile = writeTempScript(scriptText, kind);
  const { cmd, args } = interpreterFor(kind, tempFile);
  const commandLine = [cmd, ...args].map(shellArg).join(' ');

  elevatedRunning = true;
  send(getWindow, 'run:output', {
    stream: 'stdout',
    text: '==> Requesting administrator privileges...\n',
  });

  sudo.exec(commandLine, { name: 'AnyOSStack' }, (error, stdout, stderr) => {
    if (stdout) send(getWindow, 'run:output', { stream: 'stdout', text: stdout.toString() });
    if (stderr) send(getWindow, 'run:output', { stream: 'stderr', text: stderr.toString() });
    if (error) {
      send(getWindow, 'run:output', { stream: 'stderr', text: `\n[elevation error] ${error.message}\n` });
    }
    send(getWindow, 'run:exit', { code: error ? -1 : 0, elevated: true });
    cleanupTemp();
    elevatedRunning = false;
  });

  return { started: true };
}

function registerRunScriptIpc(getWindow) {
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('run:start', (_e, { scriptText, kind, elevated }) => {
    // Covers elevated runs too: they own the same tempFile/tempDir, so letting a
    // second one start would delete the script out from under a running
    // privileged shell.
    if (child || elevatedRunning) return { started: false, reason: 'already-running' };
    if (typeof scriptText !== 'string' || !scriptText.trim()) {
      return { started: false, reason: 'empty-script' };
    }
    const safeKind = kind === 'ps1' ? 'ps1' : 'sh';
    try {
      return elevated
        ? runElevated(getWindow, scriptText, safeKind)
        : runStreaming(getWindow, scriptText, safeKind);
    } catch (err) {
      cleanupTemp();
      child = null;
      return { started: false, reason: err.message };
    }
  });

  ipcMain.handle('run:cancel', () => {
    if (child) {
      // On Windows, kill the whole tree so winget/child installers stop too.
      if (process.platform === 'win32') {
        try { spawn('taskkill', ['/pid', String(child.pid), '/f', '/t']); } catch (_) { child.kill(); }
      } else {
        child.kill('SIGTERM');
      }
      return { cancelled: true };
    }
    return { cancelled: false };
  });

  // Make sure a lingering child or temp file never survives app exit.
  app.on('before-quit', () => {
    if (child) { try { child.kill(); } catch (_) { /* noop */ } }
    cleanupTemp();
  });
}

module.exports = { registerRunScriptIpc };
