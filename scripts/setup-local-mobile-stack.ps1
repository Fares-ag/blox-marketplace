# Local dev stack for blox-app + Nest API + blox-kyc-module.
# Run from blox-marketplace repo root after Docker Desktop is running.
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$KycRoot = Join-Path (Split-Path $Root -Parent) 'blox-kyc-module'
$ApiEnv = Join-Path $Root 'packages\api\.env'

function Wait-Docker {
  $deadline = (Get-Date).AddMinutes(3)
  do {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 3
  } while ((Get-Date) -lt $deadline)
  throw 'Docker is not running. Start Docker Desktop and retry.'
}

function Set-EnvValue($path, $key, $value) {
  $lines = Get-Content $path
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^\s*$([regex]::Escape($key))=") {
      $found = $true
      "$key=$value"
    } else { $line }
  }
  if (-not $found) { $out += "$key=$value" }
  Set-Content -Path $path -Value $out -Encoding utf8
}

Write-Host 'Checking Docker...'
Wait-Docker

Write-Host 'Starting Postgres + Redis (marketplace)...'
Set-Location $Root
docker compose up -d postgres redis | Out-Null

Write-Host 'Starting Postgres (KYC)...'
Set-Location $KycRoot
docker compose up -d postgres | Out-Null

Write-Host 'KYC migrate + seed + integrator...'
npm run migrate
npm run seed 2>&1 | Out-Null
$integrator = npm run seed:integrator 2>&1 | Out-String
Write-Host $integrator

if ($integrator -match 'KYC_TENANT_ID=([0-9a-f-]+)') {
  $tenantId = $Matches[1]
  Write-Host "Writing KYC_TENANT_ID=$tenantId to packages/api/.env"
  Set-EnvValue $ApiEnv 'KYC_TENANT_ID' $tenantId
} else {
  Write-Warning 'Could not parse KYC_TENANT_ID — set it manually in packages/api/.env'
}

Write-Host 'Marketplace db:push + db:seed...'
Set-Location $Root
npm run db:push
npm run db:seed

Write-Host 'Building Nest API...'
npm run build -w @drivemarket/api

Write-Host ''
Write-Host 'Stack ready. Start in separate terminals:'
Write-Host "  cd $KycRoot ; npm run dev:api          # :4000"
Write-Host "  cd $Root\packages\api ; npm run start  # :3010"
Write-Host ''
Write-Host 'Flutter (Android emulator): assets/env.json uses 10.0.2.2'
Write-Host 'Flutter (desktop/iOS sim): use localhost URLs in assets/env.json'
