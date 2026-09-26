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

function Get-PortalPort {
    if (Test-Path $script:ConfigPath) {
        $cfg = Get-Content $script:ConfigPath -Raw | ConvertFrom-Json
        if ($cfg.port) { return [int]$cfg.port }
    }
    return 8080
}

function Set-PortalPort([int]$Port) {
    @{ port = $Port } | ConvertTo-Json | Set-Content -Path $script:ConfigPath -Encoding UTF8
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
