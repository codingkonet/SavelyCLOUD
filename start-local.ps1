param(
  [ValidateRange(1, 65535)]
  [int]$Port = 8787,
  [string]$StoragePath = "storage",
  [string]$DataPath = ".local-cloud-data",
  [string]$MaxStorage = "20GB",
  [string]$MaxFileSize = "2GB",
  [switch]$NetworkAccess
)

$ErrorActionPreference = "Stop"
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
  Write-Error "Node.js 20 or newer is required. Download it from https://nodejs.org/"
}

$majorVersion = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($majorVersion -lt 20) {
  Write-Error "Node.js 20 or newer is required. Installed version: $(& node --version)"
}

$resolvedStorage = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $StoragePath))
$resolvedData = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $DataPath))
New-Item -ItemType Directory -Force -Path $resolvedStorage, $resolvedData | Out-Null

$env:HOST = if ($NetworkAccess) { "0.0.0.0" } else { "127.0.0.1" }
$env:PORT = [string]$Port
$env:STORAGE_PATH = $resolvedStorage
$env:DATA_PATH = $resolvedData
$env:MAX_STORAGE = $MaxStorage
$env:MAX_FILE_SIZE = $MaxFileSize

Write-Host ""
Write-Host "  SavelyCLOUD is starting" -ForegroundColor Green
Write-Host "  Open http://127.0.0.1:$Port"
Write-Host "  Storage: $resolvedStorage"
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

Set-Location $PSScriptRoot
& node server.js
