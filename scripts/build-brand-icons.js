#!/usr/bin/env node
'use strict';

// Fill in the catalog's missing and placeholder app logos from simple-icons.
//
// Two problems in the shipped data:
//   * six records carry no icon at all and fall through to a two-letter monogram;
//   * ~160 records share ONE drawing with only the <title> swapped - the generic
//     fallback the icon generator used whenever it found no brand match, so a
//     third of the grid rendered the same glyph.
//
// This script finds both groups, matches each app against simple-icons by slug
// and by normalized title/id, and writes src/renderer/brand-icons-extra.js,
// which merges the real marks into BRAND at runtime. Apps simple-icons has no
// entry for keep whatever they have today; nothing is invented.
//
// Run:  node scripts/build-brand-icons.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'src', 'renderer', 'index.html');
const OUT = path.join(ROOT, 'src', 'renderer', 'brand-icons-extra.js');

function extractLiteral(html, name) {
  // `const NAME = { ... };` (spacing varies) - walk braces so nested objects and
  // strings survive.
  const decl = new RegExp(`const\\s+${name}\\s*=\\s*\\{`);
  const m = decl.exec(html);
  if (!m) throw new Error(`${name} not found in index.html`);
  const start = m.index;
  let i = html.indexOf('{', start);
  let depth = 0, inStr = null, esc = false;
  for (; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
  }
  const literal = html.slice(html.indexOf('{', start), i + 1);
  // Our own repo file, and the literal is plain data.
  return new Function(`return (${literal});`)();
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const geometry = (svg) => String(svg).replace(/<title>[\s\S]*?<\/title>/gi, '');

function main() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const DATA = extractLiteral(html, 'DATA');
  const BRAND = extractLiteral(html, 'BRAND');
  const apps = DATA.apps || [];

  // Which drawing is the placeholder? The one the most unrelated apps share.
  const groups = new Map();
  for (const a of apps) {
    const svg = BRAND[a.id] || a.icon;
    if (!svg) continue;
    const key = geometry(svg);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a.id);
  }
  let placeholder = null;
  for (const [key, ids] of groups) {
    if (!placeholder || ids.length > groups.get(placeholder).length) placeholder = key;
  }
  const placeholderCount = placeholder ? groups.get(placeholder).length : 0;
  // A handful of variants legitimately share a mark; a group this large is the
  // generator's fallback, not a real logo.
  const isPlaceholder = placeholderCount >= 20;

  // Candidates: no icon at all, the generic placeholder, or a drawing this app
  // shares with another record (Opera GX wearing Opera's mark, for instance).
  // A shared icon is only replaced when simple-icons has a distinct entry, so
  // genuine variants that should look alike are left as they are.
  const needs = apps.filter((a) => {
    const svg = BRAND[a.id] || a.icon;
    if (!svg) return true;
    const key = geometry(svg);
    if (isPlaceholder && key === placeholder) return true;
    return (groups.get(key) || []).length > 1;
  });

  // simple-icons v16 exports { siGithub: {title, slug, hex, path}, ... }
  const si = require('simple-icons');
  const bySlug = new Map();
  const byTitle = new Map();
  for (const icon of Object.values(si)) {
    if (!icon || !icon.path || !icon.title) continue;
    if (icon.slug) bySlug.set(norm(icon.slug), icon);
    const t = norm(icon.title);
    if (!byTitle.has(t)) byTitle.set(t, icon);
  }

  // Names carry qualifiers the brand itself does not ("Google Chrome" -> chrome,
  // "Cinebench R23" -> cinebench). Try progressively looser keys.
  function candidates(app) {
    const out = [];
    const push = (v) => { const n = norm(v); if (n && !out.includes(n)) out.push(n); };
    push(app.id);
    push(app.name);
    push(String(app.id).replace(/[0-9]+$/, ''));
    push(String(app.name).replace(/\s+(r?\d+(\.\d+)*|cli|desktop|browser|editor|player|studio|community|pro|free)$/i, ''));
    const words = String(app.name).split(/\s+/);
    if (words.length > 1) { push(words[0]); push(words[words.length - 1]); }
    return out;
  }

  const found = [];
  const missed = [];
  for (const app of needs) {
    let icon = null;
    for (const key of candidates(app)) {
      icon = bySlug.get(key) || byTitle.get(key);
      if (icon) break;
    }
    if (icon) found.push([app, icon]); else missed.push(app);
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = [];
  lines.push('/* GENERATED by scripts/build-brand-icons.js - do not edit by hand.');
  lines.push(' *');
  lines.push(' * Real brand marks from simple-icons for the records that shipped with no');
  lines.push(' * icon, or with the catalog\'s generic placeholder. Loaded after the page\'s');
  lines.push(' * own script, so it merges into the BRAND table the renderer already uses.');
  lines.push(` * ${found.length} of ${needs.length} placeholder/missing logos replaced.`);
  lines.push(' */');
  lines.push('(function () {');
  lines.push('  if (typeof BRAND === \'undefined\') return;');
  lines.push('  var extra = {');
  for (const [app, icon] of found) {
    const svg = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">` +
      `<title>${esc(icon.title)}</title>` +
      `<path fill="#${icon.hex}" d="${icon.path}"/></svg>`;
    lines.push(`    ${JSON.stringify(app.id)}: ${JSON.stringify(svg)},`);
  }
  lines.push('  };');
  lines.push('  for (var k in extra) BRAND[k] = extra[k];');
  lines.push('})();');
  fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');

  console.log(`apps: ${apps.length}`);
  console.log(`placeholder drawing shared by: ${placeholderCount}`);
  console.log(`needed a real logo: ${needs.length}`);
  console.log(`matched in simple-icons: ${found.length}`);
  console.log(`still unmatched: ${missed.length}`);
  console.log(missed.map((a) => `${a.id} (${a.name})`).join(', '));
  console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
}

main();
