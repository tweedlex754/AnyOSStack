#!/usr/bin/env node
'use strict';

// Builds the branded Windows Setup.exe locally WITHOUT electron-builder's NSIS
// pipeline. Useful on machines where electron-builder's winCodeSign extraction
// fails (it needs symlink privilege / Developer Mode on Windows). In normal CI
// `electron-builder --win` already produces the installer; this is the fallback.
//
// Steps: (1) ensure release/win-unpacked exists AND that its app.asar still
// matches the integrity hash burned into AnyOSStack.exe, (2) regenerate the
// installer language pack, (3) generate the wizard bitmaps, (4) re-apply the
// brand icon to the app exe with rcedit, (5) compile build/anyosstack-setup.nsi
// with makensis. rcedit and makensis are reused from electron-builder's cache.
//
// Why step 1 matters: Electron verifies app.asar against a hash stored in the
// executable's resources. Hand-editing or repacking app.asar inside
// release/win-unpacked produces an installer that installs perfectly and then
// dies on launch with "Integrity check failed for asar archive". The only
// supported way to change app contents is to re-run the packer.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const UNPACKED = path.join(ROOT, 'release', 'win-unpacked');
const EXE = path.join(UNPACKED, 'AnyOSStack.exe');
const ASAR = path.join(UNPACKED, 'resources', 'app.asar');
const ICO = path.join(ROOT, 'build', 'icon.ico');
const NSI = path.join(ROOT, 'build', 'anyosstack-setup.nsi');
const LANG_GENERATOR = path.join(ROOT, 'scripts', 'build-installer-lang.js');
const UI_GENERATOR = path.join(ROOT, 'scripts', 'generate-installer-ui.js');
const UI_ASSETS = path.join(ROOT, 'build', 'installer-ui');
const CACHE = path.join(os.homedir(), 'AppData', 'Local', 'electron-builder', 'Cache');
const APP_VERSION = require(path.join(ROOT, 'package.json')).version;

function findFirst(dir, name) {
  // Depth-limited search for a binary inside the electron-builder cache.
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.toLowerCase() === name) return p;
    }
  }
  return null;
}

// SHA-256 of the asar header - the exact value Electron compares against.
function asarHeaderHash(asarPath) {
  const fd = fs.openSync(asarPath, 'r');
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const headerStringLength = head.readUInt32LE(12);
    const headerBuf = Buffer.alloc(headerStringLength);
    fs.readSync(fd, headerBuf, 0, headerStringLength, 16);
    return crypto.createHash('sha256').update(headerBuf).digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

// The packer stores the hash as text in the exe's INTEGRITY resource, so a
// substring search over the image is enough - and needs no PE parser.
function exeCarriesHash(exePath, hash) {
  const buf = fs.readFileSync(exePath);
  return buf.includes(Buffer.from(hash, 'ascii')) || buf.includes(Buffer.from(hash, 'utf16le'));
}

function pack() {
  console.log('• packing the app with electron-builder (--dir)');
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '--dir'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function ensureFreshUnpacked() {
  if (!fs.existsSync(EXE) || !fs.existsSync(ASAR)) {
    console.log('• release/win-unpacked is missing');
    pack();
    return;
  }
  if (!exeCarriesHash(EXE, asarHeaderHash(ASAR))) {
    console.log('! app.asar no longer matches the integrity hash inside AnyOSStack.exe');
    console.log('  (repacking the archive by hand invalidates it) - rebuilding');
    pack();
    if (!exeCarriesHash(EXE, asarHeaderHash(ASAR))) {
      console.error('Integrity still mismatched after repacking. Aborting: the installer');
      console.error('would ship an app that cannot start.');
      process.exit(1);
    }
  }
  console.log('• asar integrity verified against AnyOSStack.exe');
}

function main() {
  ensureFreshUnpacked();

  console.log('• generating installer language pack');
  execFileSync(process.execPath, [LANG_GENERATOR], { stdio: 'inherit' });

  console.log('• generating Stitch-inspired installer UI');
  execFileSync(process.execPath, [UI_GENERATOR, '--output', UI_ASSETS], { stdio: 'inherit' });

  const rcedit = findFirst(path.join(CACHE, 'winCodeSign'), 'rcedit-x64.exe');
  if (rcedit) {
    console.log('• embedding logo icon into AnyOSStack.exe');
    execFileSync(rcedit, [EXE, '--set-icon', ICO], { stdio: 'inherit' });
  } else {
    console.warn('! rcedit not found in cache; exe keeps whatever icon electron-builder set');
  }

  const makensis = findFirst(path.join(CACHE, 'nsis'), 'makensis.exe');
  if (!makensis) {
    console.error('makensis.exe not found. Run `electron-builder --win` once so it downloads NSIS, then retry.');
    process.exit(1);
  }
  console.log('• compiling installer with makensis');
  execFileSync(
    makensis,
    [
      '/INPUTCHARSET',
      'UTF8',
      '-V2',
      `/DAPP_VERSION=${APP_VERSION}`,
      `/DUI_ASSETS=${UI_ASSETS}`,
      `/DSETUP_ICON=${ICO}`,
      NSI,
    ],
    { stdio: 'inherit' },
  );

  const out = path.join(ROOT, 'release', `AnyOSStack-Setup-${APP_VERSION}.exe`);
  console.log('\n✔ installer built:', out);
}

main();
