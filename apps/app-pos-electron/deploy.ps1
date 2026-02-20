# =====================================================
# QONTROL POS - Deploy & Auto-Update Script
# Builds the app and publishes to S3 for auto-update
# =====================================================
# Usage: .\deploy.ps1 -Version "1.1.0"
# =====================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$Version
)

# Load AWS credentials from root .env
$envFile = Join-Path $PSScriptRoot "..\..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*=\s*(.+)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
            Write-Host "  Set $key" -ForegroundColor DarkGray
        }
    }
}

# Bump version if provided (uses regex replace to preserve JSON formatting)
$pkgPath = Join-Path $PSScriptRoot "package.json"
if ($Version) {
    Write-Host "`n[1/4] Bumping version to $Version..." -ForegroundColor Cyan
    $raw = [System.IO.File]::ReadAllText($pkgPath)
    $raw = $raw -replace '"version"\s*:\s*"[^"]*"', "`"version`": `"$Version`""
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($pkgPath, $raw, $utf8NoBom)
    Write-Host "  Version updated to $Version" -ForegroundColor Green
} else {
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    $Version = $pkg.version
    Write-Host "`n[1/4] Using current version: $Version" -ForegroundColor Cyan
}

# Build
Write-Host "`n[2/4] Building Electron app..." -ForegroundColor Cyan
npm run deploy:electron
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}

# Upload to S3
Write-Host "`n[3/4] Uploading to S3..." -ForegroundColor Cyan
$uploadScript = Join-Path $PSScriptRoot "scripts\s3-upload.js"
node $uploadScript $Version
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nUpload failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/4] Files uploaded to S3." -ForegroundColor Green

# Summary
Write-Host "`n[4/4] Deploy Summary:" -ForegroundColor Cyan
Write-Host "  Version:  $Version" -ForegroundColor White
Write-Host "  Bucket:   comex-auditorias-2026-production" -ForegroundColor White
Write-Host "  Path:     electron-updates/" -ForegroundColor White
Write-Host "  Region:   mx-central-1" -ForegroundColor White
Write-Host "`n  All devices will auto-update on next app launch." -ForegroundColor Green
Write-Host ""
