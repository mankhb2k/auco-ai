# Seed Railway Postgres from laptop (uses DATABASE_PUBLIC_URL — not *.railway.internal)
# Usage: from backend/  →  powershell -File scripts/seed-railway.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$json = railway variables --service Postgres --json
$vars = $json | ConvertFrom-Json
if (-not $vars.DATABASE_PUBLIC_URL) {
  Write-Error "DATABASE_PUBLIC_URL not found on Postgres service"
}

$env:DATABASE_URL = $vars.DATABASE_PUBLIC_URL
Write-Host "[seed-railway] Using DATABASE_PUBLIC_URL (TCP proxy)"
npm run prisma:seed
