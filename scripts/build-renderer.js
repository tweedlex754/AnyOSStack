#!/usr/bin/env node
'use strict';

/**
 * Produce src/renderer/index.html from the canonical single-file web app
 * (../anyosstack.v22.html) with the minimum surgical edits needed to run as an
 * Electron renderer, WITHOUT rewriting any of the app logic, the DATA blob, the
 * i18n table, or the script/style bodies. The whole file is copied verbatim and
 * only three things change:
 *
 *   1. The Content-Security-Policy meta drops the fonts.googleapis.com /
 *      fonts.gstatic.com allowances (fonts are now bundled locally).
 *   2. The two Google Fonts <link rel=preconnect> lines and the Google Fonts
 *      stylesheet <link> are replaced by a single local stylesheet link to the
 *      bundled ./assets/fonts/fonts.css, plus the desktop stylesheets.
 *   3. Scripts for the desktop-only additions (native shell, Run Now panel) are
 *      injected just before </body>, so they layer on top of the untouched app
 *      instead of editing it.
 *
 * Because there is exactly one <script>...</script> pair in the source and the
 * DATA blob contains no literal tag boundaries, this copy-and-patch is safe and
 * diffable against the backup.  Run:  node scripts/build-renderer.js
 *
 * NOTE: src/renderer/index.html is currently maintained directly - the
 * canonical source file this script reads is not present in the working tree.
 * Running it without that file is a no-op that reports what is missing rather
 * than damaging the renderer.
 *
 * Port of the original scripts/build-renderer.py.
 */

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const SRC = path.resolve(HERE, '..', '..', 'anyosstack.v22.html');
const DEST = path.resolve(HERE, '..', 'src', 'renderer', 'index.html');

const OLD_CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; '
  + 'style-src \'self\' \'unsafe-inline\' https://fonts.googleapis.com; '
  + 'font-src \'self\' https://fonts.gstatic.com; img-src \'self\' data:; '
  + 'script-src \'self\' \'unsafe-inline\'; connect-src \'self\'; '
  + 'frame-ancestors \'none\'; base-uri \'self\'; form-action \'self\'; object-src \'none\'" />';
const NEW_CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; '
  + 'style-src \'self\' \'unsafe-inline\'; font-src \'self\'; img-src \'self\' data:; '
  + 'script-src \'self\' \'unsafe-inline\'; connect-src \'self\'; '
  + 'frame-ancestors \'none\'; base-uri \'self\'; form-action \'self\'; object-src \'none\'" />';

const OLD_FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com" />\n'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n'
  + '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&'
  + 'family=Hanken+Grotesk:wght@400;500;600;700;800&family=Spline+Sans+Mono:wght@400;500;600&'
  + 'display=swap" rel="stylesheet" />';
const NEW_FONTS = '<!-- Bundled locally by scripts/fetch-fonts.js so the desktop app renders offline. -->\n'
  + '<link rel="stylesheet" href="./assets/fonts/fonts.css" />\n'
  + '<link rel="stylesheet" href="./native-shell.css" />\n'
  + '<link rel="stylesheet" href="./run-panel.css" />\n'
  + '<link rel="stylesheet" href="./futuristic-grid.css" />';

const INJECT = '<script src="./native-shell.js"></script>\n'
  + '<script src="./run-panel.js"></script>\n</body>';

function patch(html) {
  for (const [oldStr, newStr, label] of [
    [OLD_CSP, NEW_CSP, 'CSP'],
    [OLD_FONTS, NEW_FONTS, 'fonts links'],
    ['</body>', INJECT, 'renderer scripts'],
  ]) {
    if (!html.includes(oldStr)) {
      console.error(`ERROR: could not find ${label} anchor to patch.`);
      process.exit(1);
    }
    html = html.replace(oldStr, newStr);
  }
  return html;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    console.error('src/renderer/index.html is maintained directly right now; this generator');
    console.error('only applies if you have the standalone web app to regenerate from.');
    process.exit(1);
  }
  const html = fs.readFileSync(SRC, 'utf8');
  const out = patch(html);
  fs.writeFileSync(DEST, out, 'utf8');
  console.log(`Wrote ${DEST} (${out.length} bytes)`);
}

main();
