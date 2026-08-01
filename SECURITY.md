# Security Policy

AnyOSStack can execute install scripts on your machine (the optional **Run Now**
feature) and can request administrator/root elevation for individual installs, so
we take security seriously.

## How the app handles execution safely

- The renderer runs with `contextIsolation: true` and `nodeIntegration: false`;
  it has no direct access to Node, the filesystem, or child processes. It can
  only call the narrow, whitelisted bridge in `src/main/preload.js`.
- "Run Now" executes **only the script you reviewed** in the confirmation dialog,
  verbatim. It requires an explicit "I have reviewed this script" confirmation
  before running, and it never runs a script the app synthesized behind your back.
- Elevation is opt-in and requested only for the specific installs that need it,
  never for the app as a whole.
- The app fetches nothing at runtime (fonts and all assets are bundled) and
  denies all web permission requests.

## Supported versions

Security fixes target the latest released version. Please update before
reporting an issue you found on an older build.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub Security Advisories:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, affected version(s), and reproduction steps.

We aim to acknowledge reports within a few days and to work with you on a fix and
coordinated disclosure. If you cannot use Security Advisories, email corelink90@outlook.com instead. Thank you for helping keep users safe.
