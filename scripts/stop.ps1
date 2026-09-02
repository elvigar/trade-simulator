# Stop and remove the FinAlly Docker container. Does not touch db/ data.
# Requires: PowerShell, Docker Desktop. Tested on Windows.
# Usage: scripts\stop.ps1
$ErrorActionPreference = "Stop"

$ContainerName = "finally"

$existing = docker ps -a --filter "name=^/$ContainerName`$" --format "{{.Names}}"
if ($existing -eq $ContainerName) {
    docker stop $ContainerName 2>$null | Out-Null
    docker rm $ContainerName | Out-Null
    Write-Host "FinAlly stopped."
} else {
    Write-Host "FinAlly is not running."
}
