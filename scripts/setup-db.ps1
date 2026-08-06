# Run after reboot once Docker Desktop shows "Engine running"
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Starting Postgres container..."
docker compose up -d postgres

Write-Host "Waiting for Postgres to be ready..."
$deadline = (Get-Date).AddMinutes(2)
do {
  $ready = docker compose exec -T postgres pg_isready -U drivemarket -d drivemarket 2>$null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

Write-Host "Applying Prisma schema..."
npm run db:push -w @drivemarket/api

Write-Host "Seeding database..."
npm run db:seed -w @drivemarket/api

Write-Host "Done. Start apps with: npm run dev:api && npm run dev:marketplace"
