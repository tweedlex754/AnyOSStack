#!/usr/bin/env node
'use strict';

/**
 * Generate the bitmap layers used by the custom AnyOSStack NSIS wizard.
 *
 * NSIS uses native Win32 controls, so the stable visual *chrome* (grid, sidebar,
 * cards, frames and rules) is rendered into 24-bit BMPs while every interactive
 * field AND every piece of localizable copy is a real native control layered on
 * top by build/anyosstack-setup.nsi.
 *
 * Deliberately NOT drawn here: any translatable sentence. Baking copy into the
 * artwork is what made the language picker cosmetic - the buttons changed and
 * the pages stayed English. The only text that stays in the bitmap is language
 * neutral: the "AnyOSStack" wordmark, the step numerals, the SPDX identifier
 * line and the copyright notice.
 *
 * Layout constants below are mirrored by build/anyosstack-setup.nsi; keep the
 * two in sync when moving anything.
 *
 * Port of the original scripts/generate-installer-ui.py. Each page is assembled
 * as SVG and rasterised with sharp (already a devDependency), then written as a
 * 24-bit BMP by hand because sharp has no BMP encoder and NSIS needs BMP.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'installer-ui');

const WIDTH = 1064;
const HEIGHT = 610;
const SIDEBAR = 236;

const COLORS = {
  background: '#131313',
  surface: '#181818',
  surface_low: '#1c1b1b',
  surface_high: '#242323',
  surface_highest: '#30302f',
  card: '#1d1d1d',
  ink: '#e5e2e1',
  muted: '#a9928c',
  outline: '#5b4039',
  outline_soft: '#332825',
  primary: '#ff5722',
  primary_soft: '#4a2418',
  primary_light: '#ffb5a0',
  cyan: '#bdf4ff',
  success: '#57e389',
  black: '#0e0e0e',
};

// The AnyOSStack mark (build/icon-master.svg): three cascading layers on the
// brand ground. Ratios are expressed against the 64x64 master viewBox so the
// same geometry scales to any badge size.
const MARK_GROUND = '#181410';
const MARK_LAYERS = [
  // [x, y, w, h, fill] in master units
  [10, 34, 44, 11, '#c2410c'],
  [14, 24, 44, 11, '#ea580c'],
  [6, 14, 44, 11, '#f7f3ea'],
];

const FONT_BODY = 'Segoe UI';
const FONT_BOLD = 'Segoe UI';
const FONT_MONO = 'Cascadia Mono';

/**
 * `dy` is the baseline offset that reproduces PIL's text anchors.
 *
 * librsvg ignores dominant-baseline, so every <text> lands on the alphabetic
 * baseline at y. PIL instead anchors on the font ascender ("la", its default)
 * or on the middle of the text box ("lm"). The offsets below were measured, not
 * guessed: for each style the ink's rise above the baseline was rendered and
 * measured, then compared against the ink position in the BMPs the Python
 * script produced, so the port lands the glyphs on the same rows.
 * Only the anchor each style is actually drawn with is listed; asking for the
 * other one throws rather than silently drifting.
 */
const F = {
  brand: { family: FONT_BOLD, size: 25, weight: 700, dy: { la: 26 } },
  step: { family: FONT_MONO, size: 12, weight: 400, dy: { lm: 5 } },
  meta: { family: FONT_MONO, size: 12, weight: 400, dy: { la: 12 } },
  footer: { family: FONT_BODY, size: 14, weight: 400, dy: { lm: 6 } },
};

// --- SVG primitives -------------------------------------------------------
// PIL boxes are (x0, y0, x1, y1) with BOTH corners inclusive; SVG wants
// x/y/width/height, hence the +1 on each span. Outlines are inset by half a
// pixel so a 1px stroke lands inside the box the way PIL draws it.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rect(box, fill, outline, width = 1) {
  const [x0, y0, x1, y1] = box;
  const stroke = outline ? ` stroke="${outline}" stroke-width="${width}"` : '';
  const i = outline ? width / 2 : 0;
  return `<rect x="${x0 + i}" y="${y0 + i}" width="${x1 - x0 + 1 - 2 * i}" height="${y1 - y0 + 1 - 2 * i}" fill="${fill}"${stroke}/>`;
}

function rounded(box, radius, fill, outline, width = 1) {
  const [x0, y0, x1, y1] = box;
  const stroke = outline ? ` stroke="${outline}" stroke-width="${width}"` : '';
  const i = outline ? width / 2 : 0;
  return `<rect x="${x0 + i}" y="${y0 + i}" width="${x1 - x0 + 1 - 2 * i}" height="${y1 - y0 + 1 - 2 * i}" rx="${radius}" ry="${radius}" fill="${fill}"${stroke}/>`;
}

function line(x0, y0, x1, y1, stroke, width = 1) {
  // +0.5 keeps a 1px stroke on the pixel grid instead of straddling two rows.
  const h = width % 2 ? 0.5 : 0;
  return `<line x1="${x0 + h}" y1="${y0 + h}" x2="${x1 + h}" y2="${y1 + h}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="butt"/>`;
}

function ellipse(box, fill, outline, width) {
  const [x0, y0, x1, y1] = box;
  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  const attrs = fill ? `fill="${fill}"` : `fill="none"`;
  const stroke = outline ? ` stroke="${outline}" stroke-width="${width || 1}"` : '';
  return `<ellipse cx="${x0 + rx}" cy="${y0 + ry}" rx="${rx}" ry="${ry}" ${attrs}${stroke}/>`;
}

/**
 * PIL's default text anchor is "la": y is the TOP of the ascender. SVG's y is
 * the baseline, so the two disagree by one ascent. anchor 'lm' is PIL's
 * left-middle, which maps cleanly onto a central dominant-baseline.
 */
function text(x, y, str, f, fill, anchor) {
  const key = anchor === 'lm' ? 'lm' : 'la';
  const dy = f.dy[key];
  if (dy === undefined) {
    throw new Error(`no measured baseline offset for ${f.family} ${f.size}px with anchor '${key}'`);
  }
  return `<text x="${x}" y="${y + dy}" font-family="${f.family}" font-size="${f.size}" font-weight="${f.weight}" fill="${fill}" xml:space="preserve">${esc(str)}</text>`;
}

function svgDoc(parts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`
    + `<rect width="${WIDTH}" height="${HEIGHT}" fill="${COLORS.background}"/>`
    + parts.join('')
    + `</svg>`;
}

// --- pieces ---------------------------------------------------------------

function drawMark(cx, cy, size) {
  const scale = size / 64;
  const left = cx - size / 2;
  const top = cy - size / 2;
  const box = (x, y, w, h) => [left + x * scale, top + y * scale, left + (x + w) * scale - 1, top + (y + h) * scale - 1];
  const out = [rounded(box(0, 0, 64, 64), Math.max(3, Math.round(6 * scale)), MARK_GROUND, COLORS.outline)];
  for (const [x, y, w, h, fill] of MARK_LAYERS) {
    out.push(rounded(box(x, y, w, h), Math.max(1, Math.round(2 * scale)), fill));
  }
  return out;
}

function dotGrid(startX) {
  const dots = [];
  for (let x = startX; x < WIDTH; x += 32) {
    for (let y = 18; y < HEIGHT; y += 32) {
      dots.push(ellipse([x, y, x + 1, y + 1], '#472016'));
    }
  }
  return dots;
}

function shell(active) {
  const p = [];
  p.push(...dotGrid(SIDEBAR + 20));
  p.push(rect([0, 0, SIDEBAR, HEIGHT], COLORS.surface_low));
  p.push(line(SIDEBAR, 0, SIDEBAR, HEIGHT, COLORS.outline, 1));
  p.push(...drawMark(46, 48, 48));
  // Brand wordmark: a proper noun, identical in every language.
  p.push(text(78, 32, 'AnyOSStack', F.brand, COLORS.primary_light));

  // Step chrome only - the labels themselves are native controls.
  for (let index = 0; index < 5; index++) {
    const top = 122 + index * 54;
    let numeralColor = COLORS.muted;
    if (index === active) {
      p.push(rounded([14, top, SIDEBAR - 14, top + 44], 7, COLORS.surface_high));
      p.push(rect([SIDEBAR - 3, top, SIDEBAR, top + 44], COLORS.primary));
      numeralColor = COLORS.primary_light;
    }
    p.push(text(31, top + 22, `0${index + 1}`, F.step, numeralColor, 'lm'));
  }

  p.push(text(24, HEIGHT - 25, '© 2026 AnyOSStack contributors', F.footer, '#746762', 'lm'));
  return p;
}

function glassCard(box) {
  const [x0, y0, x1, y1] = box;
  const p = [];
  // Simple layered glow that remains compatible with 24-bit BMP.
  for (const [spread, color] of [[18, '#171311'], [10, '#1a1513'], [4, '#241814']]) {
    p.push(rounded([x0 - spread, y0 - spread, x1 + spread, y1 + spread], 18 + spread, color));
  }
  p.push(rounded(box, 14, COLORS.card, COLORS.outline_soft));
  return p;
}

// --- pages ----------------------------------------------------------------

function languagePage() {
  // Shown before any step is active, so no nav row is highlighted.
  const p = shell(-1);
  p.push(...glassCard([365, 120, 982, 476]));
  p.push(...drawMark(674, 186, 78));
  p.push(line(445, 292, 903, 292, COLORS.outline_soft, 1));
  // Frame behind the language bar so the closed drop-down reads as part of the
  // card rather than a floating Win32 control.
  p.push(rounded([442, 330, 906, 372], 7, COLORS.black, COLORS.outline));
  return svgDoc(p);
}

function uninstallPage(pathFrame = true) {
  // Uninstaller shell. It has no step rail, so it is one centered card.
  const p = [];
  p.push(...dotGrid(20));
  p.push(...glassCard([180, 110, 884, 470]));
  p.push(...drawMark(532, 180, 78));
  p.push(line(250, 290, 814, 290, COLORS.outline_soft, 1));
  if (pathFrame) p.push(rounded([250, 348, 814, 396], 7, COLORS.black, COLORS.outline));
  p.push(text(24, HEIGHT - 25, '© 2026 AnyOSStack contributors', F.footer, '#746762', 'lm'));
  return svgDoc(p);
}

function welcome() {
  const p = shell(0);
  p.push(...glassCard([365, 70, 982, 542]));
  p.push(...drawMark(674, 142, 82));
  p.push(line(445, 319, 903, 319, COLORS.outline_soft, 1));
  return svgDoc(p);
}

function licensePage() {
  const p = shell(1);
  p.push(rounded([284, 112, 1020, 492], 10, COLORS.black, COLORS.outline_soft));
  // SPDX identifier line: machine-readable, stays untranslated.
  p.push(text(306, 132, 'ANYOSSTACK  •  SPDX: GPL-3.0-OR-LATER  •  29 JUNE 2007', F.meta, COLORS.primary_light));
  p.push(line(306, 158, 998, 158, COLORS.outline_soft, 1));
  return svgDoc(p);
}

function destinationPage() {
  const p = shell(2);
  p.push(...glassCard([350, 126, 980, 505]));
  p.push(...drawMark(665, 192, 70));
  p.push(rounded([398, 382, 930, 432], 7, COLORS.black, COLORS.outline));
  return svgDoc(p);
}

function installingPage() {
  const p = shell(3);
  p.push(...glassCard([284, 72, 1020, 548]));
  p.push(rounded([312, 105, 360, 153], 10, COLORS.primary_soft, COLORS.outline));
  p.push(...drawMark(336, 129, 34));
  p.push(line(312, 180, 992, 180, COLORS.outline_soft, 1));
  p.push(rounded([312, 245, 992, 277], 16, COLORS.black, COLORS.outline_soft));
  p.push(rounded([312, 339, 992, 506], 7, COLORS.black, COLORS.outline_soft));
  return svgDoc(p);
}

function finishPage() {
  const p = shell(4);
  p.push(...glassCard([365, 75, 982, 535]));
  p.push(rounded([630, 119, 718, 207], 12, COLORS.surface_high, COLORS.outline));
  p.push(ellipse([648, 137, 700, 189], null, COLORS.primary, 5));
  p.push(line(661, 163, 674, 176, COLORS.primary, 5));
  p.push(line(674, 176, 690, 153, COLORS.primary, 5));
  p.push(rounded([445, 375, 902, 453], 7, COLORS.surface_low, COLORS.outline_soft));
  return svgDoc(p);
}

// --- 24-bit BMP writer ----------------------------------------------------
// sharp has no BMP encoder and NSIS will not read PNG, so the raw RGB buffer is
// packed by hand: BGR order, bottom-up rows, each row padded to 4 bytes.

function encodeBmp24(rgb, width, height, channels) {
  const rowBytes = width * 3;
  const pad = (4 - (rowBytes % 4)) % 4;
  const stride = rowBytes + pad;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const src = y * width * channels;
    const dst = (height - 1 - y) * stride; // BMP rows run bottom-up
    for (let x = 0; x < width; x++) {
      const s = src + x * channels;
      const d = dst + x * 3;
      pixels[d] = rgb[s + 2];
      pixels[d + 1] = rgb[s + 1];
      pixels[d + 2] = rgb[s];
    }
  }
  const header = Buffer.alloc(54);
  header.write('BM', 0, 'ascii');
  header.writeUInt32LE(54 + pixels.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixels.length, 34);
  header.writeInt32LE(2835, 38);
  header.writeInt32LE(2835, 42);
  return Buffer.concat([header, pixels]);
}

async function saveBmp(svg, name, output) {
  const { data, info } = await sharp(Buffer.from(svg))
    .flatten({ background: COLORS.background })
    .raw()
    .toBuffer({ resolveWithObject: true });
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, name), encodeBmp24(data, info.width, info.height, info.channels));
}

async function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--output');
  const output = path.resolve(i !== -1 && argv[i + 1] ? argv[i + 1] : OUT);

  const pages = [
    [languagePage(), 'language.bmp'],
    [uninstallPage(true), 'uninstall.bmp'],
    [uninstallPage(false), 'uninstall-done.bmp'],
    [welcome(), 'welcome.bmp'],
    [licensePage(), 'license.bmp'],
    [destinationPage(), 'destination.bmp'],
    [installingPage(), 'installing.bmp'],
    [finishPage(), 'finish.bmp'],
  ];
  for (const [svg, name] of pages) await saveBmp(svg, name, output);
  console.log(`Generated installer UI assets in ${output}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
