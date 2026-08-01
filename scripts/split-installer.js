#!/usr/bin/env node
'use strict';

/**
 * Split the Windows installer into chunks small enough to live in a git
 * repository, and write a manifest the bootstrap scripts use to put it back
 * together.
 *
 * Why chunks exist at all: GitHub hard-blocks any file over 100 MiB pushed to a
 * repository and warns over 50 MiB, and the installer is ~140 MiB. 20 MiB
 * chunks clear both, and also the 25 MiB cap on GitHub's browser uploader -
 * the tightest of the three, and the one that actually bit.
 *
 * Why they are the FALLBACK and not the plan: a Release asset may be 2 GiB, so
 * the installer fits there whole. Chunks in the repo cost far more - git keeps
 * every byte of every version forever, so each release would add ~140 MiB to
 * the clone size permanently. scripts/bootstrap/get.ps1 and get.sh therefore
 * try the Release first and only fall back to these parts.
 *
 * Usage:
 *   node scripts/split-installer.js [--in <exe>] [--out <dir>] [--chunk-mb 45]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function main() {
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  const input = arg('--in') || path.join(ROOT, 'release', `AnyOSStack-Setup-${version}.exe`);
  const outDir = arg('--out') || path.join(ROOT, 'installer-parts');
  const chunkMb = Number(arg('--chunk-mb', '45'));
  const chunkSize = Math.round(chunkMb * 1024 * 1024);

  if (!fs.existsSync(input)) throw new Error(`installer not found: ${input}`);
  if (!(chunkSize > 0)) throw new Error(`--chunk-mb must be a positive number`);
  if (chunkSize > 100 * 1024 * 1024) {
    throw new Error(`--chunk-mb ${chunkMb} would exceed GitHub's 100 MiB per-file block`);
  }

  const data = fs.readFileSync(input);
  const name = path.basename(input);

  fs.mkdirSync(outDir, { recursive: true });
  // Clear stale parts so a shorter build cannot leave orphans behind that the
  // manifest no longer lists but a naive downloader might still find.
  for (const f of fs.readdirSync(outDir)) {
    if (/\.part\d+$/.test(f) || f === 'manifest.json') fs.unlinkSync(path.join(outDir, f));
  }

  const parts = [];
  const count = Math.ceil(data.length / chunkSize);
  for (let i = 0; i < count; i++) {
    const slice = data.subarray(i * chunkSize, Math.min((i + 1) * chunkSize, data.length));
    const partName = `${name}.part${String(i + 1).padStart(2, '0')}`;
    fs.writeFileSync(path.join(outDir, partName), slice);
    parts.push({ name: partName, size: slice.length, sha256: sha256(slice) });
    console.log(`  ${partName}  ${(slice.length / (1024 * 1024)).toFixed(1)} MB`);
  }

  const manifest = {
    schema: 1,
    product: 'AnyOSStack',
    version,
    artifact: name,
    // Where a whole copy lives, so the bootstrap can skip the chunks entirely.
    releaseAssetUrl: `https://github.com/tweedlex754/AnyOSStack/releases/latest/download/${name}`,
    totalSize: data.length,
    sha256: sha256(data),
    partCount: parts.length,
    parts,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  console.log('');
  console.log(`${parts.length} parts + manifest.json in ${outDir}`);
  console.log(`total ${(data.length / (1024 * 1024)).toFixed(1)} MB, sha256 ${manifest.sha256}`);
  const biggest = Math.max(...parts.map((p) => p.size));
  console.log(`largest part ${(biggest / (1024 * 1024)).toFixed(1)} MiB `
    + `(GitHub warns over 50 MiB, blocks over 100 MiB)`);
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
