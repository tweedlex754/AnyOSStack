# Contributing to AnyOSStack

Thanks for your interest in improving AnyOSStack! This project is a cross-platform
Electron desktop app that wraps a single-page app catalog and generates install
scripts for Windows, macOS, and Linux.

## Ground rules

- Be respectful — this project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- All code, comments, commit messages, and documentation are written in **English**.
- Keep pull requests focused. One logical change per PR is much easier to review.

## Development setup

```bash
git clone https://github.com/tweedlex754/AnyOSStack.git
cd anyosstack
npm install
npm start          # launches the app with DevTools in dev mode
```

Requirements: Node.js 18+ and npm. Python 3 is optional (only the font/renderer
helper scripts use it).

## Project layout

```
src/main/           Electron main process
  main.js           window + session hardening + IPC registration
  preload.js        the narrow contextBridge API exposed to the renderer
  ipc/runScript.js  "Run Now" executor (spawn, streaming, elevation)
  ipc/fileOps.js    preset save/load dialogs
  updater.js        electron-updater wiring (GitHub Releases)
src/renderer/       the app UI
  index.html        the catalog app (source of truth for the UI)
  run-panel.*       desktop-only Run Now + preset layer
  assets/fonts/     bundled fonts (offline)
scripts/            icon + installer-string + font generators
build/              packaging assets (icon-master.svg is the source icon)
electron-builder.yml  Windows/macOS/Linux packaging config
```

## Adding an app to the catalog

Apps live in the `DATA` object inside `src/renderer/index.html`. Each entry has an
`id`, `name`, `icon` (an inline SVG string), a category, and a `packages` object
with the ids for each manager it supports, for example:

```js
{
  id: "example",
  name: "Example App",
  cat: "utility", catKey: "cat_utilities",
  packages: {
    windows: "Publisher.ExampleApp",   // winget id
    macos: "example-app", macosCask: true,
    apt: "example", dnf: "example", pacman: "example",
    flatpak: null, npm: null
  }
}
```

Only add ids you have verified against the real package manager. A wrong id makes
the generated script install the wrong software.

## Adding a language

The UI is localized via the `I18N` table and the `LANGS` list in
`src/renderer/index.html`. Add your language id to `LANGS`, then provide the
translated keys in `I18N`. To also localize the installer, add the language to the
table in `scripts/build-installer-lang.js` and to `nsis.installerLanguages` in
`electron-builder.yml`.

## Before you open a PR

- `npm start` launches and the feature works.
- For UI changes, include before/after screenshots.
- Update `CHANGELOG.md` under `## [Unreleased]`.
- Keep the diff minimal — do not reformat unrelated code.

## Commit messages

Use clear, imperative English subject lines (e.g. "Add Scoop package source").
Reference issues with `Fixes #123` where relevant.
