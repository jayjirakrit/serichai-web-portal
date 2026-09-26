# Shared helpers, dot-sourced by the other scripts in this folder.

$script:RepoRoot   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:ConfigPath = Join-Path $PSScriptRoot 'portal.config.json'
$script:TaskName   = 'SerichaiWebPortal'
$script:RuleName   = 'Serichai Web Portal'

function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $isAdmin = ([Security.Principal.WindowsPrincipal]$id).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        throw 'This script must run from an elevated PowerShell (Right-click -> Run as administrator).'
    }
}

$script:NginxVersion = '1.28.0'
$script:NginxDir     = Join-Path $PSScriptRoot 'nginx'
$script:NginxExe     = Join-Path $script:NginxDir 'nginx.exe'
$script:NginxConf    = Join-Path $script:NginxDir 'conf\portal.conf'
$script:DistDir      = Join-Path $script:RepoRoot 'frontend-ng\dist\serichai-web-portal\browser'

function Get-PortalConfig {
    $cfg = @{ port = 8080; backendPort = 8000 }
    if (Test-Path $script:ConfigPath) {
        $file = Get-Content $script:ConfigPath -Raw | ConvertFrom-Json
        if ($file.port)        { $cfg.port = [int]$file.port }
        if ($file.backendPort) { $cfg.backendPort = [int]$file.backendPort }
    }
    return $cfg
}

# Public port: nginx listens here (the only port exposed to the network).
function Get-PortalPort { (Get-PortalConfig).port }

# Loopback-only port uvicorn listens on; nginx proxies API calls to it.
function Get-BackendPort { (Get-PortalConfig).backendPort }

function Set-PortalPort([int]$Port) {
    $cfg = Get-PortalConfig
    $cfg.port = $Port
    $cfg | ConvertTo-Json | Set-Content -Path $script:ConfigPath -Encoding UTF8
}

# Writes nginx's config from the template (no BOM - nginx rejects one).
function Update-NginxConfig([int]$Port, [int]$BackendPort) {
    $tpl = Get-Content (Join-Path $PSScriptRoot 'nginx.conf.template') -Raw
    $conf = $tpl.Replace('__PORT__', $Port).Replace('__BACKEND_PORT__', $BackendPort).
        Replace('__DIST__', $script:DistDir.Replace('\', '/'))
    New-Item -ItemType Directory -Force -Path (Split-Path $script:NginxConf) | Out-Null
    [IO.File]::WriteAllText($script:NginxConf, $conf, (New-Object Text.UTF8Encoding($false)))
}

# Kills nginx / uvicorn processes belonging to this install (safe if none running).
function Stop-PortalProcesses {
    if (Test-Path $script:NginxExe) {
        Get-Process nginx -ErrorAction SilentlyContinue |
            Where-Object { $_.Path -eq $script:NginxExe } |
            Stop-Process -Force -ErrorAction SilentlyContinue
    }
    $venvDir = Join-Path $script:RepoRoot 'backend\.venv'
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.CommandLine -like "*$venvDir*" -and $_.CommandLine -like '*uvicorn*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Get-LanAddress {
    Get-NetIPConfiguration |
        Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
        ForEach-Object { $_.IPv4Address.IPAddress }
}
