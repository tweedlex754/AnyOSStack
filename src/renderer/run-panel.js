'use strict';

// Desktop-only layer, loaded AFTER the app's inline script so every global it
// declared (state, DATA, currentScript, cardEls, paintCard, renderStack, toast)
// is already defined and reachable. It adds two things and edits none of the
// original logic:
//   1. "Run Now" - execute the generated script in-app with a mandatory review
//      step, live output, and an opt-in elevated retry.
//   2. Preset export/import - save/restore an app selection as a JSON file.
// If window.anyos is absent (i.e. opened in a plain browser for verification),
// the whole module no-ops, so index.html still renders identically to the
// original for a side-by-side diff.

(function () {
  if (!window.anyos) return; // not running inside Electron; stay inert

  var doc = document;
  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function safeToast(msg) {
    try { if (typeof toast === 'function') { toast(msg); return; } } catch (e) {}
    console.log(msg);
  }

  // ---- work out what the currently-shown script targets vs the host OS ----
  function targetInfo() {
    var p = null;
    try { if (typeof state !== 'undefined' && state) p = state.platform; } catch (e) {}
    var kind = p === 'windows' ? 'ps1' : 'sh';
    var wantHost = p === 'windows' ? 'win32' : (p === 'macos' ? 'darwin' : 'linux');
    return { kind: kind, platform: p, match: window.anyos.platform === wantHost };
  }
  function currentScriptText() {
    var cb = doc.getElementById('codeBlock');
    return cb ? cb.textContent : '';
  }

  // ============================ Run Now ============================
  var confirmOverlay, termOverlay, termOut, termStatus, termCancelBtn, termCloseBtn;
  var unsubOutput = null, unsubExit = null, running = false, lastExitCode = null;

  function buildConfirm() {
    confirmOverlay = el('div', 'rp-overlay');
    confirmOverlay.setAttribute('role', 'dialog');
    confirmOverlay.setAttribute('aria-modal', 'true');
    confirmOverlay.innerHTML =
      '<div class="rp-sheet">' +
      '  <div class="rp-head"><div><h3>Run this script now?</h3>' +
      '    <p class="rp-sub">It runs on this computer with your normal privileges.</p></div>' +
      '    <button type="button" class="rp-x" data-close aria-label="Close"></button></div>' +
      '  <div class="rp-body">' +
      '    <div class="rp-warn">Review the full script below. It installs software using your ' +
      'system package manager. Only run scripts you understand and trust.</div>' +
      '    <pre class="rp-code" data-script></pre>' +
      '    <label class="rp-review"><input type="checkbox" data-review>' +
      '      I have reviewed this script and want to run it.</label>' +
      '  </div>' +
      '  <div class="rp-foot">' +
      '    <button type="button" class="btn" data-close>Cancel</button>' +
      '    <button type="button" class="btn btn-primary" data-run disabled>Run</button>' +
      '  </div>' +
      '</div>';
    doc.body.appendChild(confirmOverlay);

    var review = confirmOverlay.querySelector('[data-review]');
    var runBtn = confirmOverlay.querySelector('[data-run]');
    review.addEventListener('change', function () { runBtn.disabled = !review.checked; });
    confirmOverlay.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', closeConfirm);
    });
    confirmOverlay.addEventListener('click', function (e) {
      if (e.target === confirmOverlay) closeConfirm();
    });
    runBtn.addEventListener('click', function () {
      var script = confirmOverlay.querySelector('[data-script]').textContent;
      closeConfirm();
      startRun(script, targetInfo().kind, false);
    });
  }

  function openConfirm() {
    if (!confirmOverlay) buildConfirm();
    var info = targetInfo();
    if (!info.match) {
      safeToast('Run Now targets the current OS. This script is for ' + (info.platform || 'another OS') + '.');
      return;
    }
    var script = currentScriptText();
    if (!script.trim()) { safeToast('Nothing to run.'); return; }
    confirmOverlay.querySelector('[data-script]').textContent = script;
    var review = confirmOverlay.querySelector('[data-review]');
    review.checked = false;
    confirmOverlay.querySelector('[data-run]').disabled = true;
    confirmOverlay.classList.add('on');
  }
  function closeConfirm() { if (confirmOverlay) confirmOverlay.classList.remove('on'); }

  function buildTerm() {
    termOverlay = el('div', 'rp-overlay');
    termOverlay.setAttribute('role', 'dialog');
    termOverlay.setAttribute('aria-modal', 'true');
    termOverlay.innerHTML =
      '<div class="rp-sheet">' +
      '  <div class="rp-head"><div><h3>Running</h3>' +
      '    <p class="rp-sub">Live output from your package manager.</p></div></div>' +
      '  <div class="rp-body"><pre class="rp-code rp-term" data-term aria-live="polite"></pre></div>' +
      '  <div class="rp-foot">' +
      '    <span class="rp-status rp-spacer" data-status>Working...</span>' +
      '    <button type="button" class="btn" data-cancel>Cancel</button>' +
      '    <button type="button" class="btn btn-primary" data-tclose disabled>Close</button>' +
      '  </div>' +
      '</div>';
    doc.body.appendChild(termOverlay);
    termOut = termOverlay.querySelector('[data-term]');
    termStatus = termOverlay.querySelector('[data-status]');
    termCancelBtn = termOverlay.querySelector('[data-cancel]');
    termCloseBtn = termOverlay.querySelector('[data-tclose]');
    termCancelBtn.addEventListener('click', function () { window.anyos.cancelRun(); });
    termCloseBtn.addEventListener('click', function () {
      if (!running) termOverlay.classList.remove('on');
    });
  }

  function appendOut(chunk) {
    var span = doc.createElement('span');
    if (chunk.stream === 'stderr') span.className = 'rp-err';
    span.textContent = chunk.text;
    termOut.appendChild(span);
    termOut.scrollTop = termOut.scrollHeight;
  }

  function startRun(script, kind, elevated) {
    if (!termOverlay) buildTerm();
    termOut.textContent = '';
    termStatus.textContent = elevated ? 'Requesting privileges...' : 'Working...';
    termStatus.className = 'rp-status rp-spacer';
    termCloseBtn.disabled = true;
    termCancelBtn.disabled = elevated; // elevated runs are not cancellable mid-flight
    termOverlay.classList.add('on');
    running = true;
    lastExitCode = null;

    if (unsubOutput) unsubOutput();
    if (unsubExit) unsubExit();
    unsubOutput = window.anyos.onRunOutput(appendOut);
    unsubExit = window.anyos.onRunExit(function (payload) {
      running = false;
      lastExitCode = payload.code;
      termCloseBtn.disabled = false;
      termCancelBtn.disabled = true;
      if (payload.code === 0) {
        termStatus.textContent = 'Done.';
        termStatus.className = 'rp-status rp-spacer ok';
      } else {
        termStatus.textContent = 'Finished with errors (exit ' + payload.code + ').';
        termStatus.className = 'rp-status rp-spacer err';
        if (!payload.elevated) offerElevatedRetry(script, kind);
      }
    });

    var call = elevated ? window.anyos.runScriptElevated(script, kind) : window.anyos.runScript(script, kind);
    call.then(function (res) {
      if (!res || !res.started) {
        running = false;
        termStatus.textContent = 'Could not start: ' + ((res && res.reason) || 'unknown');
        termStatus.className = 'rp-status rp-spacer err';
        termCloseBtn.disabled = false;
      }
    });
  }

  function offerElevatedRetry(script, kind) {
    if (termOverlay.querySelector('[data-retry]')) return;
    var btn = el('button', 'btn-ghost');
    btn.setAttribute('data-retry', '1');
    btn.textContent = 'Retry with administrator rights';
    btn.addEventListener('click', function () {
      btn.remove();
      startRun(script, kind, true);
    });
    termOverlay.querySelector('.rp-foot').insertBefore(btn, termCancelBtn);
  }

  // Inject the "Run Now" button into the generate modal's footer, and keep its
  // enabled state in sync with whether the current target matches the host OS.
  function injectRunButton() {
    var foot = doc.querySelector('#modal .sheet-foot');
    if (!foot || foot.querySelector('[data-runnow]')) return;
    var btn = el('button', 'btn-ghost');
    btn.type = 'button';
    btn.setAttribute('data-runnow', '1');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Run Now';
    btn.addEventListener('click', openConfirm);
    foot.insertBefore(btn, foot.firstChild);
    refreshRunButton();
  }
  function refreshRunButton() {
    var btn = doc.querySelector('#modal .sheet-foot [data-runnow]');
    if (!btn) return;
    var info = targetInfo();
    btn.disabled = !info.match;
    btn.title = info.match ? 'Run this script on this computer'
      : 'Run Now only works when the script targets your current OS';
  }

  // The modal is shown by toggling inline display:flex; watch for that to (a)
  // ensure the button exists and (b) refresh its state for the new target.
  var modal = doc.getElementById('modal');
  if (modal) {
    injectRunButton();
    new MutationObserver(function () {
      if (modal.style.display === 'flex') { injectRunButton(); refreshRunButton(); }
    }).observe(modal, { attributes: true, attributeFilter: ['style'] });
  }

  // ============================ Presets ============================
  function collectPreset() {
    var s = (typeof state !== 'undefined' && state) ? state : {};
    var ids = [];
    try { ids = Array.from(s.selected || []); } catch (e) {}
    return {
      app: 'AnyOSStack',
      preset: 1,
      exportedAt: new Date().toISOString(),
      platform: s.platform || null,
      distro: s.distro || null,
      lang: s.lang || null,
      selected: ids,
    };
  }

  function applyPreset(obj) {
    if (!obj || obj.app !== 'AnyOSStack' || !Array.isArray(obj.selected)) {
      safeToast('Not a valid AnyOSStack preset.');
      return;
    }
    var known = new Set();
    try { DATA.apps.forEach(function (a) { known.add(a.id); }); } catch (e) {}
    var restored = obj.selected.filter(function (id) { return known.has(id); });
    try {
      state.selected.clear();
      restored.forEach(function (id) { state.selected.add(id); });
      if (typeof cardEls !== 'undefined' && typeof paintCard === 'function') {
        cardEls.forEach(function (node, id) { paintCard(node, id); });
      }
      if (typeof renderStack === 'function') renderStack();
    } catch (e) { console.error(e); }
    var skipped = obj.selected.length - restored.length;
    safeToast('Loaded ' + restored.length + ' app(s)' + (skipped ? ' (' + skipped + ' unknown skipped)' : '') + '.');
  }

  function exportPreset() {
    var data = collectPreset();
    if (!data.selected.length) { safeToast('Select some apps first.'); return; }
    window.anyos.savePreset(JSON.stringify(data, null, 2), 'anyosstack-preset.json')
      .then(function (res) { if (res && res.saved) safeToast('Preset saved.'); });
  }
  function importPreset() {
    window.anyos.loadPreset().then(function (res) {
      if (!res || !res.loaded) return;
      try { applyPreset(JSON.parse(res.json)); }
      catch (e) { safeToast('Could not read that preset file.'); }
    });
  }

  // Everything that acts on the current selection lives in the docked action bar
  // at the bottom: Clear on the left, away from the primary action, then
  // Export / Import / Generate script on the right. Export and Import used to sit
  // in the search toolbar at the top, far from the selection they operate on.
  function arrangeDock() {
    var foot = doc.querySelector('.stack-foot');
    var head = doc.querySelector('.stack-head');
    if (!foot || foot.querySelector('[data-export]')) return;

    var clear = doc.getElementById('stackClear');

    var exp = el('button', 'btn rp-preset-btn');
    exp.type = 'button'; exp.setAttribute('data-export', '1');
    exp.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg> Export';
    exp.title = 'Save the current selection as a preset file';
    exp.addEventListener('click', exportPreset);
    var imp = el('button', 'btn rp-preset-btn');
    imp.type = 'button'; imp.setAttribute('data-import', '1');
    imp.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21V9m0 0l-4 4m4-4l4 4M5 3h14"/></svg> Import';
    imp.title = 'Load a selection from a preset file';
    imp.addEventListener('click', importPreset);

    // Order across the right-hand group: Export, Import, Clear, Generate script.
    var gen = doc.getElementById('stackGen');
    if (gen && gen.parentNode === foot) {
      foot.insertBefore(exp, gen);
      foot.insertBefore(imp, gen);
      if (clear) foot.insertBefore(clear, gen);
    } else {
      foot.appendChild(exp); foot.appendChild(imp);
      if (clear) foot.appendChild(clear);
    }
  }
  arrangeDock();

  // SHIP TO and CATEGORIES were two separately fixed panels with hard-coded top
  // offsets, so the moment SHIP TO grew - picking Linux reveals the distro row -
  // its extra height ran underneath CATEGORIES and the distro chips were cut in
  // half. Wrapping both in one fixed column lets SHIP TO push CATEGORIES down,
  // and CATEGORIES takes the remaining height and scrolls.
  function buildRail() {
    var shipto = doc.querySelector('.shipto');
    var cats = doc.getElementById('cats');
    if (!shipto || !cats || doc.querySelector('.aos-rail')) return;
    var rail = doc.createElement('div');
    rail.className = 'aos-rail';
    shipto.parentNode.insertBefore(rail, shipto);
    rail.appendChild(shipto);
    rail.appendChild(cats);
  }
  buildRail();

  // Global Escape closes whichever desktop overlay is open (after the app's own).
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (confirmOverlay && confirmOverlay.classList.contains('on')) closeConfirm();
    else if (termOverlay && termOverlay.classList.contains('on') && !running) termOverlay.classList.remove('on');
  });
})();
