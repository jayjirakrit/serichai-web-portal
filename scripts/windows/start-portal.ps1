<#
.SYNOPSIS
  Launches the portal (uvicorn serving API + built Angular app). Run by the
  'SerichaiWebPortal' scheduled task at boot; can also be run by hand.
#>
[CmdletBinding()]
param([int]$Port = 0)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

if ($Port -le 0) { $Port = Get-PortalPort }

$backend = Join-Path $RepoRoot 'backend'
$python  = Join-Path $backend '.venv\Scripts\python.exe'
$dist    = Join-Path $RepoRoot 'frontend-ng\dist\serichai-web-portal\browser'
if (-not (Test-Path $python)) { throw "Missing $python - run setup.ps1 first." }
if (-not (Test-Path $dist))   { throw "Missing $dist - run setup.ps1 first." }

$logDir = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$out = Join-Path $logDir 'portal.log'
$err = Join-Path $logDir 'portal.err.log'
foreach ($f in @($out, $err)) {
    if ((Test-Path $f) -and (Get-Item $f).Length -gt 5MB) {
        Move-Item $f "$f.old" -Force
    }
}

$env:DATA_DIR         = Join-Path $backend 'data'
$env:FRONTEND_DIST    = $dist
$env:PYTHONUNBUFFERED = '1'

$p = Start-Process -FilePath $python -WorkingDirectory $backend -NoNewWindow -PassThru -Wait `
    -ArgumentList @('-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', $Port) `
    -RedirectStandardOutput $out -RedirectStandardError $err
# Non-zero exit lets Task Scheduler's restart-on-failure kick in.
if ($p.ExitCode) { exit $p.ExitCode } else { exit 1 }
