<#
.SYNOPSIS
  Registers a Windows Scheduled Task to run ArthaX Zerodha Daily Auto-Sync at 8:30 AM IST every day.

.USAGE
  powershell -ExecutionPolicy Bypass -File scripts/schedule-zerodha-sync.ps1 -Install
  powershell -ExecutionPolicy Bypass -File scripts/schedule-zerodha-sync.ps1 -RunNow
  powershell -ExecutionPolicy Bypass -File scripts/schedule-zerodha-sync.ps1 -Uninstall
#>

param(
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$RunNow,
  [string]$Time = "08:30"
)

$TaskName = "ArthaX_Zerodha_Daily_Sync"
$RepoPath = Split-Path -Parent $PSScriptRoot

if ($Uninstall) {
  Write-Host "Removing Scheduled Task '$TaskName'..." -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "✅ Scheduled Task '$TaskName' removed successfully." -ForegroundColor Green
  exit 0
}

if ($RunNow) {
  Write-Host "Executing Zerodha Auto-Sync immediately..." -ForegroundColor Cyan
  Set-Location -Path $RepoPath
  npm run zerodha:sync
  exit 0
}

# Default or -Install
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  ArthaX - Zerodha Daily Scheduled Sync Setup   " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

$NodeCmd = "npm.cmd"
$ScriptArgs = "run zerodha:sync"

$Action = New-ScheduledTaskAction -Execute $NodeCmd -Argument $ScriptArgs -WorkingDirectory $RepoPath
$Trigger = New-ScheduledTaskTrigger -Daily -At $Time
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Automated Daily Zerodha Kite Login and Portfolio Sync for ArthaX" | Out-Null

Write-Host "✅ Successfully registered Windows Scheduled Task '$TaskName'!" -ForegroundColor Green
Write-Host "   - Time: Every day at $Time IST" -ForegroundColor White
Write-Host "   - Working Directory: $RepoPath" -ForegroundColor White
Write-Host "   - Action: npm run zerodha:sync" -ForegroundColor White
Write-Host ""
Write-Host "To test right now: powershell -File scripts/schedule-zerodha-sync.ps1 -RunNow" -ForegroundColor Yellow
