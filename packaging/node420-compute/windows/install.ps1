param(
  [string]$InstallDir = "$env:ProgramFiles\420Integrated\node420-compute",
  [string]$ConfigDir = "$env:ProgramData\420Integrated\node420-compute"
)

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw "install.ps1 must run from an elevated PowerShell session" }

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
Copy-Item -LiteralPath "$PSScriptRoot\node420-compute.exe" -Destination "$InstallDir\node420-compute.exe" -Force
Copy-Item -LiteralPath "$PSScriptRoot\run-node420-compute.ps1" -Destination "$InstallDir\run-node420-compute.ps1" -Force
Copy-Item -LiteralPath "$PSScriptRoot\register-startup-task.ps1" -Destination "$InstallDir\register-startup-task.ps1" -Force
if (-not (Test-Path -LiteralPath "$ConfigDir\worker.args.example")) {
  Copy-Item -LiteralPath "$PSScriptRoot\worker.args.example" -Destination "$ConfigDir\worker.args.example"
}

Write-Host "Installed node420-compute packaging. Create $ConfigDir\worker.args with canonical identities and restrict its ACL, then explicitly run register-startup-task.ps1 with the intended limited UserId."
