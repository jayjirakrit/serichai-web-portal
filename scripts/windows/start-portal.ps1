<#
.SYNOPSIS
  Launches the portal: nginx (public port, serves the built Angular app and
  proxies /accounts/* to uvicorn) plus uvicorn (FastAPI, loopback only). Run by the
  'SerichaiWebPortal' scheduled task at boot; can also be run by hand.
#>
[CmdletBinding()]
param([int]$Port = 0)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

if ($Port -le 0) { $Port = Get-PortalPort }
$BackendPort = Get-BackendPort

$backend = Join-Path $RepoRoot 'backend'
$python  = Join-Path $backend '.venv\Scripts\python.exe'
$dist    = Join-Path $RepoRoot 'frontend-ng\dist\serichai-web-portal\browser'
if (-not (Test-Path $python)) { throw "Missing $python - run setup.ps1 first." }
if (-not (Test-Path $dist))   { throw "Missing $dist - run setup.ps1 first." }
if (-not (Test-Path $NginxExe)) { throw "Missing $NginxExe - run setup.ps1 first." }

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
$env:PYTHONUNBUFFERED = '1'
# FRONTEND_DIST is intentionally unset: nginx serves the SPA, uvicorn only the API.
Remove-Item Env:\FRONTEND_DIST -ErrorAction SilentlyContinue

# Clear leftovers from a previous run, then (re)generate nginx's config.
Stop-PortalProcesses
Update-NginxConfig -Port $Port -BackendPort $BackendPort
New-Item -ItemType Directory -Force -Path (Join-Path $NginxDir 'logs'), (Join-Path $NginxDir 'temp') | Out-Null
& $NginxExe -p $NginxDir -c $NginxConf -t
if ($LASTEXITCODE -ne 0) { throw 'nginx config test failed.' }

$nginx = Start-Process -FilePath $NginxExe -WorkingDirectory $NginxDir -NoNewWindow -PassThru `
    -ArgumentList @('-p', $NginxDir, '-c', $NginxConf)
try {
    $p = Start-Process -FilePath $python -WorkingDirectory $backend -NoNewWindow -PassThru -Wait `
        -ArgumentList @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', $BackendPort) `
        -RedirectStandardOutput $out -RedirectStandardError $err
} finally {
    Stop-PortalProcesses
}
# Non-zero exit lets Task Scheduler's restart-on-failure kick in.
if ($p.ExitCode) { exit $p.ExitCode } else { exit 1 }
