'use strict';

// Generate every platform icon from the single brand SVG (build/icon-master.svg):
//   - build/icons/icon-<size>.png   (16..1024, used by Linux + as ICO/ICNS input)
//   - build/icon.ico                (Windows app + taskbar)
//   - build/installerIcon.ico, installerHeaderIcon.ico, uninstallerIcon.ico (NSIS)
//   - build/icon.icns               (macOS Dock/Finder)  [best-effort]
//   - build/installerSidebar.bmp (164x314), build/installerHeader.bmp (150x57)
//   - build/dmg-background.png (660x400)
//   - build/icon.png (512) for the README
//
// Uses sharp for rasterization/BMP, png-to-ico for .ico, png2icons for .icns.
// A small safe-area pad keeps the mark off the icon edge at small sizes.
//
// Run:  node scripts/build-icons.js   (after `npm install`)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const ICONS = path.join(BUILD, 'icons');
const MASTER = path.join(BUILD, 'icon-master.svg');

const INK = { r: 24, g: 20, b: 16 };       // #181410, the brand background
const IVORY = { r: 247, g: 243, b: 234 };  // #f7f3ea

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function main() {
  const sharp = require('sharp');
  fs.mkdirSync(ICONS, { recursive: true });

  const svg = fs.readFileSync(MASTER);

  // 1) PNG set. Render the SVG onto a padded square so it never touches edges.
  const pngPaths = {};
  for (const size of SIZES) {
    const pad = Math.round(size * 0.08);
    const inner = size - pad * 2;
    const markPng = await sharp(svg, { density: 384 })
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const out = path.join(ICONS, `icon-${size}.png`);
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: markPng, top: pad, left: pad }])
      .png()
      .toFile(out);
    pngPaths[size] = out;
  }
  fs.copyFileSync(pngPaths[512], path.join(BUILD, 'icon.png'));
  console.log('PNG icon set written to build/icons/');

  // 2) Windows .ico (multi-resolution).
  const pngToIcoModule = require('png-to-ico');
  const pngToIco = pngToIcoModule.default || pngToIcoModule;
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoBuf = await pngToIco(icoSizes.map((s) => pngPaths[s]));
  fs.writeFileSync(path.join(BUILD, 'icon.ico'), icoBuf);
  fs.writeFileSync(path.join(BUILD, 'installerIcon.ico'), icoBuf);
  fs.writeFileSync(path.join(BUILD, 'uninstallerIcon.ico'), icoBuf);
  const headerIco = await pngToIco([pngPaths[32], pngPaths[48]]);
  fs.writeFileSync(path.join(BUILD, 'installerHeaderIcon.ico'), headerIco);
  console.log('Windows .ico files written');

  // 3) macOS .icns (best-effort; skipped with a warning if png2icons is absent).
  try {
    const png2icons = require('png2icons');
    const src = fs.readFileSync(pngPaths[1024]);
    const icns = png2icons.createICNS(src, png2icons.BILINEAR, 0);
    if (icns) { fs.writeFileSync(path.join(BUILD, 'icon.icns'), icns); console.log('macOS icon.icns written'); }
  } catch (e) {
    console.warn('Skipping .icns (png2icons unavailable):', e.message);
  }

  // 4) NSIS bitmaps. Ivory field, the mark, and a wordmark-ish ember bar.
  await makeInstallerBitmap(sharp, svg, 164, 314, path.join(BUILD, 'installerSidebar.bmp'), 'sidebar');
  await makeInstallerBitmap(sharp, svg, 150, 57, path.join(BUILD, 'installerHeader.bmp'), 'header');
  console.log('NSIS sidebar/header .bmp written');

  // 5) macOS DMG background.
  await makeDmgBackground(sharp, svg, path.join(BUILD, 'dmg-background.png'));
  console.log('DMG background written');

  // 6) GitHub social-preview card (1280x640) for the repo's OG/link preview.
  const DOCS = path.join(ROOT, 'docs');
  fs.mkdirSync(DOCS, { recursive: true });
  await makeSocialPreview(sharp, path.join(DOCS, 'social-preview.png'));
  console.log('social-preview.png written');
}

// 1280x640 branded link-preview card. Dark brand ground, big mark, wordmark,
// tagline, and the three target OSes. Text stays inside the ~1000x500 safe area.
async function makeSocialPreview(sharp, out) {
  const w = 1280, h = 640;
  const SERIF = "Georgia, 'Playfair Display', 'Times New Roman', serif";
  const SANS = "Segoe UI, 'Hanken Grotesk', Arial, sans-serif";
  const cx = w / 2;
  const art =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#181410"/>` +
    // subtle top hairline in ember
    `<rect x="0" y="0" width="${w}" height="8" fill="#ea580c"/>` +
    markGroup(cx - 72, 96, 144) +
    `<text x="${cx}" y="330" text-anchor="middle" font-family="${SERIF}" font-size="92" ` +
    `font-weight="800" fill="#f7f3ea">AnyOSStack</text>` +
    `<text x="${cx}" y="392" text-anchor="middle" font-family="${SERIF}" font-size="34" ` +
    `font-style="italic" fill="#ea580c">One stack for every OS</text>` +
    `<text x="${cx}" y="452" text-anchor="middle" font-family="${SANS}" font-size="25" ` +
    `fill="#b3a992">Pick your apps &#8594; one idempotent install script</text>` +
    // platform chips
    `<g font-family="${SANS}" font-size="24" font-weight="700" fill="#f7f3ea" text-anchor="middle">` +
    `<rect x="${cx - 300}" y="500" width="180" height="54" rx="10" fill="#241d16" stroke="#3a2f24"/>` +
    `<text x="${cx - 210}" y="535">Windows</text>` +
    `<rect x="${cx - 92}" y="500" width="184" height="54" rx="10" fill="#241d16" stroke="#3a2f24"/>` +
    `<text x="${cx}" y="535">macOS</text>` +
    `<rect x="${cx + 120}" y="500" width="180" height="54" rx="10" fill="#241d16" stroke="#3a2f24"/>` +
    `<text x="${cx + 210}" y="535">Linux</text>` +
    `</g>` +
    `</svg>`;
  await sharp(Buffer.from(art), { density: 200 }).resize(w, h, { fit: 'fill' }).png().toFile(out);
}

// The three-layer AnyOSStack mark as inline SVG, scaled into a lockup.
function markGroup(x, y, size) {
  const s = (size / 64).toFixed(4);
  return (
    `<g transform="translate(${x},${y}) scale(${s})">` +
    '<rect width="64" height="64" rx="6" fill="#181410"/>' +
    '<rect x="10" y="34" width="44" height="11" rx="2" fill="#c2410c"/>' +
    '<rect x="14" y="24" width="44" height="11" rx="2" fill="#ea580c"/>' +
    '<rect x="6" y="14" width="44" height="11" rx="2" fill="#f7f3ea"/>' +
    '</g>'
  );
}

// Compose a branded bitmap as a single SVG lockup (mark + "AnyOSStack" wordmark)
// so the artwork fills the banner instead of a small mark floating in empty space
// (which read as a stretched/"wide" logo on the installer's license page).
async function makeInstallerBitmap(sharp, svg, w, h, out, kind) {
  const SERIF = "Georgia, 'Playfair Display', 'Times New Roman', serif";
  let art;
  if (kind === 'header') {
    // Horizontal lockup: mark on the left, wordmark to its right, both centered.
    // Sized so "AnyOSStack" at this weight fits inside 150px with margin.
    const m = 34, mx = 12, my = Math.round((h - m) / 2);
    const tx = mx + m + 9;
    art =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect width="${w}" height="${h}" fill="#f7f3ea"/>` +
      markGroup(mx, my, m) +
      `<text x="${tx}" y="${Math.round(h / 2) + 5}" font-family="${SERIF}" ` +
      `font-size="14.5" font-weight="700" fill="#181410" textLength="${w - tx - 8}" ` +
      `lengthAdjust="spacingAndGlyphs">AnyOSStack</text>` +
      `</svg>`;
  } else {
    // Vertical lockup for the welcome/finish sidebar: big mark, wordmark under it,
    // tagline, and an ember rule along the bottom.
    const m = 96, mx = Math.round((w - m) / 2);
    art =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
      `<rect width="${w}" height="${h}" fill="#f7f3ea"/>` +
      markGroup(mx, 46, m) +
      `<text x="${w / 2}" y="182" text-anchor="middle" font-family="${SERIF}" ` +
      `font-size="22" font-weight="800" fill="#181410">AnyOSStack</text>` +
      `<text x="${w / 2}" y="206" text-anchor="middle" font-family="${SERIF}" ` +
      `font-size="11" fill="#8a7f6d">one stack for every OS</text>` +
      `<rect x="0" y="${h - 6}" width="${w}" height="6" fill="#ea580c"/>` +
      `</svg>`;
  }
  // NSIS requires a real 24-bit BMP. sharp has no native BMP encoder, so we
  // rasterize the SVG to raw RGB and hand-encode - reliable across sharp builds.
  const raw = await sharp(Buffer.from(art), { density: 200 })
    .resize(w, h, { fit: 'fill' })
    .flatten({ background: IVORY })
    .removeAlpha()
    .raw()
    .toBuffer();
  fs.writeFileSync(out, encodeBmp24(raw, w, h));
}

async function makeDmgBackground(sharp, svg, out) {
  const w = 660, h = 400;
  const mark = await sharp(svg, { density: 384 })
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: { ...IVORY, alpha: 1 } } })
    .composite([{ input: mark, top: 40, left: 40 }])
    .png()
    .toFile(out);
}

// Minimal 24-bit BMP encoder (BGR, bottom-up, row-padded) - only used if sharp
// cannot emit BMP natively. Input `raw` is top-down RGB.
function encodeBmp24(raw, w, h) {
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const pixelArraySize = rowSize * h;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelArraySize, 34);
  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y; // BMP is bottom-up
    let off = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const si = (srcY * w + x) * 3;
      buf[off++] = raw[si + 2]; // B
      buf[off++] = raw[si + 1]; // G
      buf[off++] = raw[si];     // R
    }
  }
  return buf;
}

main().catch((err) => { console.error(err); process.exit(1); });
