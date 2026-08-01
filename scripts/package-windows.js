#!/usr/bin/env node
'use strict';

/**
 * Build the branded Windows installer and drop it on the Desktop.
 *
 * Wraps the local build path (scripts/build-win-installer.js), which packs
 * release/win-unpacked into the custom NSIS Setup.exe. That path is used
 * instead of `electron-builder --win` because electron-builder's winCodeSign
 * extraction needs symlink privilege (admin or Developer Mode) and fails on
 * machines without it; the local path needs none.
 *
 * Only Windows can be built here. macOS and Linux packages are produced by CI
 * on their own runners - use scripts/download-release.js to fetch those.
 *
 * Usage:
 *   node scripts/package-windows.js [--skip-build] [--repack] [--out <dir>]
 *
 *   --skip-build  Copy the installer already in release/ instead of rebuilding.
 *   --repack      Force `electron-builder --dir` first. Needed when files under
 *                 src/ changed: the integrity check only asks whether app.asar
 *                 matches the exe, not whether app.asar matches your working
 *                 tree, so a stale asar passes silently.
 *   --out <dir>   Where to put the installer (default: the Desktop).
 *
 * Port of the original scripts/package-windows.ps1.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}
const has = (name) => process.argv.includes(name);

function desktopDir() {
  // No cross-platform API for this; the registry-free default holds on all
  // three platforms for a standard profile.
  return path.join(os.homedir(), 'Desktop');
}

function main() {
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const installer = path.join(ROOT, 'release', `AnyOSStack-Setup-${version}.exe`);
  const outDir = arg('--out') || desktopDir();

  console.log(`AnyOSStack ${version} - Windows installer`);

  if (!has('--skip-build')) {
    if (has('--repack')) {
      console.log('repacking app.asar from src/ ...');
      try {
        execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx',
          ['electron-builder', '--dir'], { cwd: ROOT, stdio: 'ignore' });
      } catch {
        // electron-builder exits non-zero when its winCodeSign step fails, but
        // the app is packed by then; the asar's presence is the real signal.
      }
      if (!fs.existsSync(path.join(ROOT, 'release', 'win-unpacked', 'resources', 'app.asar'))) {
        throw new Error('repack produced no app.asar');
      }
    }
    console.log('building installer ...');
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-win-installer.js')],
      { cwd: ROOT, stdio: 'inherit' });
  }

  if (!fs.existsSync(installer)) throw new Error(`installer not found: ${installer}`);

  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, path.basename(installer));
  fs.copyFileSync(installer, dest);

  const hash = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
  fs.writeFileSync(`${dest}.sha256`, `${hash}  ${path.basename(dest)}\n`, 'ascii');

  const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
  console.log('');
  console.log(`  ${dest}`);
  console.log(`  ${mb} MB`);
  console.log(`  SHA256 ${hash.toUpperCase()}`);
  console.log('');
  console.log(`Note: at ${mb} MB this exceeds GitHub's 100 MiB repository limit.`);
  console.log('Attach it to a Release (2 GiB per file) - never commit it.');
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
