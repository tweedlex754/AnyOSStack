#!/usr/bin/env node
'use strict';

/**
 * Download AnyOSStack installers for every platform from a GitHub Release.
 *
 * Windows is the only platform that can be built on a Windows machine; the
 * macOS and Linux packages are produced by .github/workflows/release.yml on
 * their own runners and attached to the Release for a version tag. This script
 * pulls those finished assets down, so you get all platforms without owning a
 * Mac.
 *
 * Uses the public REST API and needs no token for public repositories. If a
 * SHA256SUMS.txt is attached to the release, every download is verified against
 * it and a mismatch is reported rather than ignored.
 *
 * Usage:
 *   node scripts/download-release.js [--platform windows|macos|linux|all]
 *                                    [--tag v1.0.0] [--out <dir>]
 *                                    [--repo owner/name]
 *
 * Port of the original scripts/download-release.ps1.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const UA = 'anyosstack-downloader';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

// Extensions per platform. Windows ships both the installer and a portable exe.
const PATTERNS = {
  windows: [/\.exe$/i],
  macos: [/\.dmg$/i, /\.zip$/i],
  linux: [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i],
};

async function main() {
  const platform = arg('--platform', 'all');
  if (!['windows', 'macos', 'linux', 'all'].includes(platform)) {
    throw new Error(`--platform must be windows, macos, linux or all (got '${platform}')`);
  }
  const tag = arg('--tag');
  const repo = arg('--repo', 'tweedlex754/AnyOSStack');
  const api = tag
    ? `https://api.github.com/repos/${repo}/releases/tags/${tag}`
    : `https://api.github.com/repos/${repo}/releases/latest`;

  console.log(`querying ${repo} ...`);
  const res = await fetch(api, { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' } });

  if (res.status === 404) {
    console.log('');
    console.log('No release found.');
    console.log(`Nothing has been published for ${repo} yet, or the tag does not exist.`);
    console.log('Publish one first:  git tag v1.0.0 && git push origin v1.0.0');
    console.log('That triggers .github/workflows/release.yml, which builds and attaches');
    console.log('the Windows, macOS and Linux packages.');
    process.exit(2);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${api}`);

  const rel = await res.json();
  const wanted = platform === 'all'
    ? Object.values(PATTERNS).flat()
    : PATTERNS[platform];

  const assets = (rel.assets || []).filter((a) => wanted.some((re) => re.test(a.name)));
  const sums = (rel.assets || []).find((a) => /SHA256SUMS/i.test(a.name));

  if (!assets.length) {
    console.log(`release ${rel.tag_name} has no assets matching '${platform}'.`);
    console.log(`assets present: ${(rel.assets || []).map((a) => a.name).join(', ') || '(none)'}`);
    process.exit(3);
  }

  const outDir = arg('--out') || path.join(os.homedir(), 'Desktop', `AnyOSStack-${rel.tag_name}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`release ${rel.tag_name} -> ${outDir}`);

  const expected = new Map();
  if (sums) {
    const txt = await (await fetch(sums.browser_download_url, { headers: { 'User-Agent': UA } })).text();
    for (const line of txt.split('\n')) {
      const m = /^\s*([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line);
      if (m) expected.set(m[2], m[1].toLowerCase());
    }
  }

  let failed = 0;
  for (const a of assets) {
    const dest = path.join(outDir, a.name);
    const mb = (a.size / (1024 * 1024)).toFixed(1);
    process.stdout.write(`  ${a.name.padEnd(46)} ${mb.padStart(7)} MB`);
    const dl = await fetch(a.browser_download_url, { headers: { 'User-Agent': UA } });
    if (!dl.ok) throw new Error(`${dl.status} downloading ${a.name}`);
    fs.writeFileSync(dest, Buffer.from(await dl.arrayBuffer()));

    if (expected.has(a.name)) {
      const got = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
      if (got === expected.get(a.name)) console.log('  verified');
      else { console.log('  CHECKSUM MISMATCH'); failed++; }
    } else {
      console.log('  (no checksum published)');
    }
  }

  console.log('');
  if (failed) {
    console.log(`${failed} file(s) failed verification - do not run them.`);
    process.exit(4);
  }
  console.log(`done: ${outDir}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
