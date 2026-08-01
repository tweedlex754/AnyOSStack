# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Chocolatey and Scoop as alternate Windows package sources.
- System-tray update checker.
- Enable `electron-updater` automatic updates once builds are code-signed.
- Headless/CLI mode.
- Localized Run Now dialogs.

## [1.0.0] - 2026-07-23

First public release. Turns the standalone AnyOSStack web tool into a real
cross-platform desktop application.

### Added
- Electron desktop app packaged for **Windows** (NSIS installer + portable),
  **macOS** (DMG), and **Linux** (AppImage, `.deb`, `.rpm`).
- **Native desktop shell** so the app feels like a real program, not a web page:
  a frameless window with a custom branded title bar (logo + wordmark + window
  controls on Windows/Linux, native traffic lights on macOS), the marketing hero
  removed so it opens straight into the tool, and browser behaviors (right-click
  menu, text selection of chrome, zoom/find shortcuts) suppressed. The app/exe
  icon is the AnyOSStack logo on every platform.
- Branded, multi-language NSIS installer (12 languages, auto-selected from the
  user's Windows UI language) with a custom sidebar/header and the GPL-3.0 license
  page.
- App icon generated from the brand mark for every platform (`.ico`, `.icns`,
  multi-size PNGs).
- **Run Now**: execute the generated install script in-app with a mandatory
  review step, live stdout/stderr streaming, cancel, and an opt-in "retry with
  administrator rights" path (UAC on Windows, `osascript` on macOS, `pkexec` on
  Linux via `sudo-prompt`).
- **Preset export/import**: save an app selection to a `.json` file and restore
  it later or share it.
- Offline operation: the three UI fonts are bundled locally; the app makes no
  runtime network requests, and its Content-Security-Policy no longer allows any
  external origin.
- Auto-update infrastructure wired against GitHub Releases (disabled by default
  until builds are signed; manual "Check for Updates" is available).

### Preserved
- The full app catalog (500+ apps), 12-language UI, light/dark themes, RTL
  support, and the winget/Homebrew/apt/dnf/pacman/flatpak/npm script generators
  are carried over unchanged from the original web app.

[Unreleased]: https://github.com/tweedlex754/AnyOSStack/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tweedlex754/AnyOSStack/releases/tag/v1.0.0
