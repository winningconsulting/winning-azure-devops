$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Building task..."
Push-Location SendTeamsTestNotification
npm ci
npm run build
npm prune --production
Pop-Location

if (-not (Get-Command tfx -ErrorAction SilentlyContinue)) {
    Write-Host "Install TFX CLI: npm install -g tfx-cli"
    exit 1
}

Set-Location $repoRoot
tfx extension create --manifest-globs extension/vss-extension.json
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
Write-Host "VSIX created (see *.vsix in repo root)."
