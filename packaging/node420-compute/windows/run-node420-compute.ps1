param(
  [string]$Config = "$env:ProgramData\\420Integrated\\node420-compute\\worker.args",
  [string]$Binary = "$PSScriptRoot\\node420-compute.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Binary -PathType Leaf)) {
  throw "node420-compute launcher: binary not found: $Binary"
}
if (-not (Test-Path -LiteralPath $Config -PathType Leaf)) {
  throw "node420-compute launcher: config not found: $Config"
}

$arguments = @()
foreach ($line in Get-Content -LiteralPath $Config) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  if ($line.StartsWith("#")) { continue }
  $arguments += $line
}

& $Binary @arguments
exit $LASTEXITCODE
