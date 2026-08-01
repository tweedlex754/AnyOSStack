# AnyOSStack — GitHub upload package

This archive holds two things, kept apart because GitHub puts them in two
different places:

| Folder | Goes to | Why |
| --- | --- | --- |
| `repo/` | The repository (`git push`) | Source, docs, CI workflows, and the chunked installer |
| `release-assets/` | A **Release**, as an attached file | The whole 140 MiB installer, which a repo will not take |

## Size limits, measured against this build

| Destination | Limit | Our 140 MiB installer |
| --- | --- | --- |
| File pushed to a repository | warning at 50 MiB, **hard block at 100 MiB** | ✗ rejected |
| File uploaded through the browser UI | 25 MiB | ✗ rejected |
| **Release asset** | **2 GiB per file**, up to 1000 assets, no total cap | ✓ fits with room to spare |
| Git LFS object | per-plan quota, burns paid storage and bandwidth | ✓ but pointless here |

**Compressing does not help.** NSIS already compresses the payload
(`SetCompressor /SOLID zlib`), so re-compressing the finished `.exe` recovers
almost nothing — measured: 146,724,471 -> 145,983,586 bytes, a **0.5 %** saving.
That is still 139.2 MiB, still far over the 100 MiB repo limit.

## What is committed, and the one exception

`repo/.gitignore` excludes `release/`, so the finished `.exe` can never be
pushed by accident.

The exception is `repo/installer-parts/`: the same installer split into seven 20 MiB chunks plus a `manifest.json`, and those **are** committed.

20 MiB is chosen for the *browser* uploader, not for git. Over git any chunk
under 100 MiB is fine and 45 MiB worked; but GitHub's web "Add file → Upload
files" caps a single file at **25 MiB** and silently refuses anything larger.
20 MiB clears that with headroom and is far under both git thresholds, so the
same chunks work whichever way you upload.

They exist so the one-line install works before you publish a Release. Both
bootstrap scripts try the Release asset first and only fall back to the chunks.

Know the cost: git keeps every byte of every version forever, so refreshing the
chunks on every release adds ~140 MiB to the clone size **permanently**. Once
Releases are flowing, stop refreshing them — or delete `installer-parts/` and
let the bootstrap rely on the Release alone. Nothing else depends on it.

## Steps

### 1. Push the repository

`repo/` is a complete git repository: commits are on `main` and `origin` is
already set to `https://github.com/tweedlex754/AnyOSStack.git`.

```bash
cd repo
git push -u origin main
```

If the repository does not exist on GitHub yet, create it first at
<https://github.com/new> as `anyosstack`, **Public**, and do **not** initialize
it with a README, license, or .gitignore — this folder already has all three,
and auto-init would collide on the first push.

### 2. Cut a release

```bash
git tag v1.0.0
git push origin v1.0.0
```

Pushing the tag triggers `.github/workflows/release.yml`, which builds the
Windows, macOS and Linux installers on their native runners and attaches them to
the Release for that tag. Check the **Actions** tab and confirm the run is green
before announcing.

### 3. Manual release (optional)

If you would rather not wait for CI, upload the file in `release-assets/`
yourself: **Releases → Draft a new release → Attach binaries**. Attach
`SHA256SUMS.txt` to the same release so people can verify what they downloaded.

### 4. Check the one-line install

Once `main` is pushed, this should work from any machine:

```powershell
irm https://raw.githubusercontent.com/tweedlex754/AnyOSStack/main/scripts/bootstrap/get.ps1 | iex
```

```bash
curl -fsSL https://raw.githubusercontent.com/tweedlex754/AnyOSStack/main/scripts/bootstrap/get.sh | sh
```

Both leave the installer on the Desktop. The chunks are appended to one file as
they arrive and each is deleted once written, so you never hold a pile of
`.part` files to merge yourself — the run prints `assembled 20 / 139.9 MB` and
so on as it goes.

Integrity is checked twice: every chunk against its own SHA-256 from the
manifest, and the rejoined file again as a whole. Both matter — a missing chunk
leaves every *downloaded* chunk passing its own check, and only the whole-file
hash catches it. When it fails, nothing is written to the Desktop.

### 5. Repository settings

`repo/docs/PUBLISHING.md` covers the rest in detail: the social preview image,
the repository description, topics, and the community-profile checklist.

## What is in this snapshot

- Every build helper under `repo/scripts/` is plain Node — no Python, no
  PowerShell in the toolchain.
- Screenshots in `repo/docs/screenshots/` were recaptured from the packaged app
  at 1280×800; both themes show the current UI.
- The installer in `release-assets/`, the chunks in `repo/installer-parts/`, and
  the checksum in `SHA256SUMS.txt` all describe the same build:
  `sha256 9f051cfadf562261a7d7b835d2e5c802dbc9316c04828e1a87d9734ab10312c8`.

