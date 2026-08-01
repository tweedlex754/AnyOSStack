'use strict';

// Builds the native-desktop shell: a custom title bar with the logo and window
// controls, and it strips browser behaviors (right-click menu) so the app does
// not feel like a web page. Runs only inside Electron (window.anyos present);
// in a plain browser it no-ops and the page renders exactly as before.

(function () {
  if (!window.anyos) return;

  var doc = document;
  var root = doc.documentElement;
  var isMac = window.anyos.platform === 'darwin';

  root.classList.add('aos-app', isMac ? 'aos-mac' : 'aos-winlin');

  function build() {
    var bar = doc.createElement('div');
    bar.className = 'aos-titlebar';
    // Logo (the 3-bar brand mark, fixed brand colors) + wordmark, then controls.
    bar.innerHTML =
      '<div class="aos-brand">' +
      '  <svg viewBox="0 0 64 64" aria-hidden="true">' +
      '    <rect x="10" y="34" width="44" height="11" rx="3" fill="#c2410c"/>' +
      '    <rect x="14" y="24" width="44" height="11" rx="3" fill="#ea580c"/>' +
      '    <rect x="6" y="14" width="44" height="11" rx="3" fill="#f7f3ea"/>' +
      '  </svg><b>AnyOSStack</b>' +
      '</div>' +
      '<div class="aos-spacer"></div>' +
      '<div class="aos-winctl">' +
      '  <button type="button" class="aos-min" aria-label="Minimize" title="Minimize">' +
      '    <svg viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6"/></svg></button>' +
      '  <button type="button" class="aos-max" aria-label="Maximize" title="Maximize">' +
      '    <svg class="aos-maxsq" viewBox="0 0 12 12"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1"/></svg>' +
      '    <svg class="aos-restore" viewBox="0 0 12 12"><rect x="2.2" y="3.6" width="6.2" height="6.2" rx="1"/><path d="M4.4 3.6V2.2h5.4v5.4H8.4"/></svg></button>' +
      '  <button type="button" class="aos-close" aria-label="Close" title="Close">' +
      '    <svg viewBox="0 0 12 12"><line x1="3" y1="3" x2="9" y2="9"/><line x1="9" y1="3" x2="3" y2="9"/></svg></button>' +
      '</div>';
    doc.body.insertBefore(bar, doc.body.firstChild);

    if (!isMac) {
      bar.querySelector('.aos-min').addEventListener('click', function () { window.anyos.win.minimize(); });
      bar.querySelector('.aos-max').addEventListener('click', function () { window.anyos.win.toggleMaximize(); });
      bar.querySelector('.aos-close').addEventListener('click', function () { window.anyos.win.close(); });
      window.anyos.win.onMaximizeChange(function (isMax) {
        root.classList.toggle('aos-maximized', !!isMax);
      });
      window.anyos.win.isMaximized().then(function (isMax) {
        root.classList.toggle('aos-maximized', !!isMax);
      });
    }
  }

  // Suppress the browser context menu everywhere except where a copy/paste menu
  // is genuinely useful (text inputs and the script/output code blocks).
  function suppressContextMenu() {
    doc.addEventListener('contextmenu', function (e) {
      var t = e.target;
      var ok = t && t.closest && t.closest('input, textarea, [contenteditable], .code, .rp-code');
      if (!ok) e.preventDefault();
    });
    // Block browser zoom shortcuts and find - they read as "web page", not app.
    doc.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0', 'f', 'F', 'p', 'P'].indexOf(e.key) !== -1) {
        // allow copy/paste/select-all; only block zoom/find/print
        if (['f', 'F', 'p', 'P', '+', '-', '=', '0'].indexOf(e.key) !== -1) e.preventDefault();
      }
    });
  }

  if (doc.body) { build(); suppressContextMenu(); }
  else doc.addEventListener('DOMContentLoaded', function () { build(); suppressContextMenu(); });
})();
