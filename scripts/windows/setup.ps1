<#
.SYNOPSIS
  Installs everything the portal needs on Windows and registers it to start at boot.
.DESCRIPTION
  1. Installs Python 3.13 and Node.js LTS via winget (if missing)
  2. Creates backend\.venv and installs requirements.txt
  3. npm ci + builds the Angular app (frontend-ng)
  4. Registers Scheduled Task 'SerichaiWebPortal' (runs as SYSTEM at startup, no login needed)
  5. Starts it and waits for /health
  Run from an elevated PowerShell. Safe to re-run (also use it to deploy updates).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup.ps1
#>
[CmdletBinding()]
param(
    [int]$Port = 0,
    [switch]$SkipInstall,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Admin

if ($Port -le 0) { $Port = Get-PortalPort }
Set-PortalPort $Port

function Invoke-Checked([string]$What, [scriptblock]$Block) {
    Write-Host "  > $What" -ForegroundColor DarkGray
    & $Block
    if ($LASTEXITCODE -ne 0) { throw "$What failed (exit code $LASTEXITCODE)." }
}

function Install-WingetPackage([string]$Id) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget not found. Install 'App Installer' from the Microsoft Store, or install $Id manually, then re-run with -SkipInstall."
    }
    winget install --id $Id -e --silent --scope machine `
        --accept-package-agreements --accept-source-agreements
    # -1978335189 (0x8A15002B) = no applicable upgrade / already installed; treat as success.
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
        throw "winget install $Id failed (exit code $LASTEXITCODE)."
    }
    Update-SessionPath
}

function Find-Python {
    foreach ($candidate in @(@('py', '-3.13'), @('python'))) {
        $cmd = Get-Command $candidate[0] -ErrorAction SilentlyContinue
        if (-not $cmd) { continue }
        try {
            $extra = @($candidate | Select-Object -Skip 1)
            $v = & $cmd.Source @extra -c "import sys;print('%d.%d' % sys.version_info[:2])" 2>$null
            if ($LASTEXITCODE -eq 0 -and [version]$v -ge [version]'3.13') {
                return @{ Exe = $cmd.Source; Args = $extra }
            }
        } catch { }
    }
    return $null
}

function Test-NodeOk {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { return $false }
    $v = (& node -v).TrimStart('v')
    return ([version]$v -ge [version]'24.15.0')
}

Write-Host "`n== Serichai Web Portal setup ==" -ForegroundColor Cyan

# --- 1. Runtimes ---------------------------------------------------------
if (-not $SkipInstall) {
    Write-Host "`n[1/4] Checking runtimes" -ForegroundColor Cyan
    if (-not (Find-Python)) {
        Write-Host '  Installing Python 3.13...'
        Install-WingetPackage 'Python.Python.3.13'
    } else { Write-Host '  Python OK' }

    if (-not (Test-NodeOk)) {
        Write-Host '  Installing Node.js LTS...'
        Install-WingetPackage 'OpenJS.NodeJS.LTS'
    } else { Write-Host '  Node OK' }
}
$py = Find-Python
if (-not $py) { throw 'Python >= 3.13 not found on PATH. Install it or re-run without -SkipInstall.' }
if (-not (Test-NodeOk)) { throw 'Node.js >= 24.15 not found on PATH. Install it or re-run without -SkipInstall.' }

# --- 2. Backend ----------------------------------------------------------
Write-Host "`n[2/4] Backend dependencies" -ForegroundColor Cyan
$backend = Join-Path $RepoRoot 'backend'
$venvDir = Join-Path $backend '.venv'
$venvPy  = Join-Path $venvDir 'Scripts\python.exe'
$venvOk = $false
if (Test-Path $venvPy) {
    & $venvPy -c 'import sys' 2>$null
    $venvOk = ($LASTEXITCODE -eq 0)
}
if (-not $venvOk) {
    if (Test-Path $venvDir) { Remove-Item $venvDir -Recurse -Force }
    Invoke-Checked 'create virtualenv' { & $py.Exe @($py.Args) -m venv $venvDir }
}
Invoke-Checked 'pip install' { & $venvPy -m pip install --disable-pip-version-check -r (Join-Path $backend 'requirements.txt') }

# --- 3. Frontend ---------------------------------------------------------
$frontend = Join-Path $RepoRoot 'frontend-ng'
$dist = Join-Path $frontend 'dist\serichai-web-portal\browser'
if (-not $SkipBuild) {
    Write-Host "`n[3/4] Building Angular frontend" -ForegroundColor Cyan
    Push-Location $frontend
    try {
        Invoke-Checked 'npm ci'        { npm ci }
        Invoke-Checked 'npm run build' { npm run build }
    } finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    throw "Frontend build output not found at $dist. Re-run without -SkipBuild."
}

# --- 4. Scheduled task ---------------------------------------------------
Write-Host "`n[4/4] Registering startup task '$TaskName'" -ForegroundColor Cyan
$startScript = Join-Path $PSScriptRoot 'start-portal.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`"" `
    -WorkingDirectory $RepoRoot
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}
# Free the port: an old uvicorn child may outlive the task stop (also covers manual runs).
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -like "*$venvDir*" -and $_.CommandLine -like '*uvicorn*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings `
    -Description 'Serichai Web Portal (FastAPI + Angular) - starts at boot' -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "  Waiting for http://127.0.0.1:$Port/health ..." -NoNewline
$healthy = $false
for ($i = 0; $i -lt 40 -and -not $healthy; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 2
        $healthy = ($r.StatusCode -eq 200)
    } catch { Write-Host '.' -NoNewline }
}
Write-Host ''
if (-not $healthy) {
    throw "Portal did not become healthy. Check $(Join-Path $PSScriptRoot 'logs\portal.err.log')"
}

Write-Host "`nPortal is running: http://localhost:$Port" -ForegroundColor Green
Write-Host 'It will start automatically at every boot.'
Write-Host 'Next: .\open-firewall.ps1 (allow other machines)  |  .\set-static-ip.ps1 (optional)'
