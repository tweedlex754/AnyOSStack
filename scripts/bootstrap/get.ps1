<#
  AnyOSStack bootstrap - Windows / PowerShell

      irm https://raw.githubusercontent.com/tweedlex754/AnyOSStack/main/scripts/bootstrap/get.ps1 | iex

  Downloads the installer and leaves it on your Desktop. No admin rights are
  needed to download; Windows will ask for elevation when you run the installer
  itself, not here.

  Two sources, in order:
    1. the GitHub Release asset - one file, the normal path
    2. the chunked copy in the repository - only if the Release is unreachable

  Every download is checked against the SHA-256 in the manifest, and the
  rejoined file is checked again as a whole, so a truncated part cannot become
  a silently corrupt installer.
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # the progress bar makes downloads far slower

$Base = if ($env:ANYOSSTACK_BASE) { $env:ANYOSSTACK_BASE }
        else { 'https://raw.githubusercontent.com/tweedlex754/AnyOSStack/main/installer-parts' }

function Write-Step($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "AnyOSStack installer bootstrap" -ForegroundColor White
Write-Host ""

Write-Step "reading manifest"
$manifest = Invoke-RestMethod -Uri "$Base/manifest.json" -Headers @{ 'User-Agent' = 'anyosstack-bootstrap' }
$name = $manifest.artifact
$desktop = [Environment]::GetFolderPath('Desktop')
$target = Join-Path $desktop $name
Write-Ok "$($manifest.product) $($manifest.version) - $([math]::Round($manifest.totalSize/1MB,1)) MB"

function Test-Sha($path, $expected) {
  (Get-FileHash $path -Algorithm SHA256).Hash.ToLower() -eq $expected.ToLower()
}

# --- already here? -------------------------------------------------------
if ((Test-Path $target) -and (Test-Sha $target $manifest.sha256)) {
  Write-Ok "already on your Desktop and verified: $target"
  exit 0
}

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("anyosstack-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$staged = Join-Path $tmp $name

try {
  # --- 1. the whole file from the Release --------------------------------
  $gotWhole = $false
  if ($manifest.releaseAssetUrl) {
    Write-Step "trying the release asset"
    try {
      Invoke-WebRequest -Uri $manifest.releaseAssetUrl -OutFile $staged -Headers @{ 'User-Agent' = 'anyosstack-bootstrap' }
      if (Test-Sha $staged $manifest.sha256) { $gotWhole = $true; Write-Ok "downloaded in one piece" }
      else { Write-Warn "release asset did not match the manifest checksum - falling back" }
    } catch {
      Write-Warn "no release asset yet - falling back to the chunked copy"
    }
  }

  # --- 2. rejoin the chunks ----------------------------------------------
  if (-not $gotWhole) {
    Write-Step "downloading $($manifest.partCount) parts"
    # The installer is assembled as the parts arrive, not after: each chunk is
    # verified, appended to the single output file, then deleted. You never end
    # up holding a pile of .part files to merge yourself.
    $out = [System.IO.File]::Create($staged)
    $doneBytes = 0
    $totalMb = [math]::Round($manifest.totalSize / 1MB, 1)
    try {
      $i = 0
      foreach ($part in $manifest.parts) {
        $i++
        $chunk = Join-Path $tmp $part.name
        Invoke-WebRequest -Uri "$Base/$($part.name)" -OutFile $chunk -Headers @{ 'User-Agent' = 'anyosstack-bootstrap' }
        if (-not (Test-Sha $chunk $part.sha256)) { throw "part $($part.name) failed its checksum" }
        $bytes = [System.IO.File]::ReadAllBytes($chunk)
        $out.Write($bytes, 0, $bytes.Length)
        $doneBytes += $bytes.Length
        Remove-Item $chunk -Force
        Write-Host ("    {0}/{1}  assembled {2,6} / {3} MB" -f `
          $i, $manifest.partCount, [math]::Round($doneBytes / 1MB, 1), $totalMb) -ForegroundColor DarkGray
      }
    } finally { $out.Dispose() }
  }

  Write-Step "verifying"
  if (-not (Test-Sha $staged $manifest.sha256)) { throw "the rejoined file does not match the published checksum" }
  Write-Ok "checksum matches"

  Move-Item -LiteralPath $staged -Destination $target -Force
  Write-Host ""
  Write-Ok "saved to $target"
  Write-Host ""
  Write-Host "  Run it when you are ready:" -ForegroundColor White
  Write-Host "    Start-Process `"$target`"" -ForegroundColor DarkGray
  Write-Host ""
  Write-Host "  These builds are not code-signed, so SmartScreen will warn once:" -ForegroundColor DarkGray
  Write-Host "  More info -> Run anyway." -ForegroundColor DarkGray
  Write-Host ""
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
