# Publishing AnyOSStack on GitHub

This project folder is a complete, push-ready open-source repository. The steps
below take it from your machine to a public GitHub project that looks complete on
day one. (These are manual because publishing requires your GitHub credentials.)

All links are already set to the `tweedlex754/AnyOSStack` repository, and the
security/conduct contact is `corelink90@outlook.com`. If you ever move the repo,
find-and-replace `tweedlex754` across the project.

## 1. Create the repository

1. Go to <https://github.com/new>.
2. Name it `anyosstack`, set it **Public**.
3. **Do not** initialize with a README, .gitignore, or license — this folder
   already has them, and auto-init would cause a conflict on first push.

## 2. Push the code

This folder is **already a git repository with commits** on the `main` branch,
and the README banner + light/dark screenshots are already included. You only
need to add your remote and push:

```bash
git remote add origin https://github.com/tweedlex754/AnyOSStack.git
git push -u origin main
```

(If you are starting from a fresh copy without the `.git` folder, run `git init
-b main`, `git add -A`, `git commit -m "Initial commit"` first.)

## 3. Set the social preview image

This repo ships a ready-made link-preview card at `docs/social-preview.png`
(1280×640). Upload it so shared links render a branded card:

1. Repo **Settings → General → Social preview → Edit → Upload an image**.
2. Choose `docs/social-preview.png`.

## 4. Screenshots (already included; optional extras)

`docs/screenshots/app-list-light.png` and `app-list-dark.png` are real captures
already committed and shown in the README. To refresh them or add optional extra
shots, capture at 1280×800+ and commit with these filenames:

| Filename | What to capture |
| --- | --- |
| `app-list-light.png` | App catalog, **light** theme (included). |
| `app-list-dark.png` | App catalog, **dark** theme (included). |
| `run-now-panel.png` | The Run Now confirmation dialog or live output panel. |
| `installer-welcome.png` | The Windows NSIS installer welcome page. |
| `installer-dmg-macos.png` | The macOS DMG window, if you build on a Mac. |

## 4b. Where the installers go — and why never into the repo

The Windows installer is ~140 MiB. GitHub's limits decide where it can live:

| Destination | Limit | Our 140 MiB installer |
| --- | --- | --- |
| File pushed to a repository | warning at 50 MiB, **hard block at 100 MiB** | ✗ rejected |
| File uploaded through the browser UI | 25 MiB | ✗ rejected |
| **Release asset** | **2 GiB per file**, up to 1000 assets, no total cap | ✓ fits with room to spare |
| Git LFS object | per-plan quota, and it burns paid storage/bandwidth | ✓ but pointless here |

So the finished `.exe` is **never committed**. `.gitignore` excludes `release/`,
which makes that a mechanical guarantee rather than a habit — a stray
`git add -A` cannot push a build artifact.

**Zipping does not help.** NSIS already compresses the payload (`SetCompressor
/SOLID zlib`), so re-compressing the finished `.exe` recovers almost nothing —
measured on this build: 146,724,471 → 145,983,586 bytes, a **0.5 %** saving,
still 139.2 MiB and still far over the 100 MiB repo limit.

Releases are the path CI already takes: `.github/workflows/release.yml` runs
`electron-builder --publish always`, which uploads each platform's installer to
the Release created for the tag.

### The chunked copy in `installer-parts/`

There is one exception, and it is deliberate. `npm run split-installer` writes
the installer to `installer-parts/` as 45 MiB chunks plus a `manifest.json`, and
**those chunks are committed**. 45 MiB clears both the 50 MiB warning and the
100 MiB block, so they push cleanly.

They exist so `scripts/bootstrap/get.ps1` and `get.sh` still work before the
first Release is published — the one-line install in the README has something to
fall back to. Both scripts try the Release asset first and only reach for the
chunks when it is missing.

Know the cost: git keeps every byte of every version forever, so refreshing the
chunks on each release adds ~140 MiB to the clone size **permanently**. Once
Releases are flowing, the honest move is to stop refreshing them — or drop
`installer-parts/` entirely and let the bootstrap rely on the Release alone.
Nothing else depends on it.

## 5. Cut the first release

```bash
git tag v1.0.0
git push origin v1.0.0
```

Pushing the tag triggers `.github/workflows/release.yml`, which builds the
Windows / macOS / Linux installers on their native runners and attaches them to a
new GitHub Release automatically. Watch the **Actions** tab and confirm the run
is green before announcing.

## 6. Fill in repository metadata

In the repo's main page (right sidebar → the gear next to "About"):

- **Description**: `One stack for every OS - cross-platform app installer & script generator`
- **Topics**: `electron`, `windows`, `macos`, `linux`, `winget`, `homebrew`,
  `package-manager`, `installer`, `desktop-app`, `automation`, `powershell`
- Enable **Issues** and (optionally) **Discussions** (the issue template links to
  Discussions and Security Advisories).

## 7. Verify the community profile

Open **Insights → Community Standards**. Confirm every item is checked:

- Description, README, Code of conduct, Contributing, License, Security policy,
  Issue templates, Pull request template.

All of these files already exist in this repo, so the profile should show 100%.

## 8. Optional polish

- Pin the repo on your profile.
- Add a short release note when you publish `v1.0.0` (GitHub pre-fills from the
  tag; you can paste the `1.0.0` section of `CHANGELOG.md`).
- Consider free OSS code signing (e.g. SignPath) later to remove the SmartScreen /
  Gatekeeper prompts and enable auto-updates.
