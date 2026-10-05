param(
  [Parameter(Mandatory = $true)]
  [string]$UserId,
  [string]$Config = "$env:ProgramData\\420Integrated\\node420-compute\\worker.args",
  [string]$Launcher = "$PSScriptRoot\\run-node420-compute.ps1",
  [string]$TaskName = "420Integrated-node420-compute"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Launcher -PathType Leaf)) { throw "launcher not found: $Launcher" }
if (-not (Test-Path -LiteralPath $Config -PathType Leaf)) { throw "config not found: $Config" }

$pwsh = (Get-Command powershell.exe).Source
$argument = "-NoProfile -ExecutionPolicy Bypass -File `"$Launcher`" -Config `"$Config`""
$action = New-ScheduledTaskAction -Execute $pwsh -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId $UserId -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
