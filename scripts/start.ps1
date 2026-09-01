# Build (if needed) and run the FinAlly Docker container.
# Requires: PowerShell, Docker Desktop. Tested on Windows.
# Usage: scripts\start.ps1 [-Build]
param(
    [switch]$Build
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$ImageName = "finally"
$ContainerName = "finally"
$Port = 8001

Set-Location $RootDir

$EnvFile = Join-Path $RootDir ".env"
if (-not (Test-Path $EnvFile)) {
    Write-Error "No .env file found at $EnvFile`nCopy .env.example to .env and fill in your API key first:`n  copy .env.example .env"
    exit 1
}

$DbDir = Join-Path $RootDir "db"
if (-not (Test-Path $DbDir)) {
    New-Item -ItemType Directory -Path $DbDir | Out-Null
}

$imageExists = docker image inspect $ImageName 2>$null
if ($Build -or -not $imageExists) {
    Write-Host "Building Docker image '$ImageName'..."
    docker build -t $ImageName $RootDir
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$running = docker ps --filter "name=^/$ContainerName`$" --filter "status=running" --format "{{.Names}}"
if ($running -eq $ContainerName) {
    Write-Host "FinAlly is already running at http://localhost:$Port"
    exit 0
}

$existing = docker ps -a --filter "name=^/$ContainerName`$" --format "{{.Names}}"
if ($existing -eq $ContainerName) {
    docker rm $ContainerName | Out-Null
}

docker run -d `
    --name $ContainerName `
    -v "${DbDir}:/app/db" `
    -p "${Port}:8000" `
    --env-file $EnvFile `
    $ImageName

Write-Host "FinAlly is starting at http://localhost:$Port"
Start-Process "http://localhost:$Port"
