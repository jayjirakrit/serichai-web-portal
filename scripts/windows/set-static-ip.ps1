<#
.SYNOPSIS
  Sets a static IPv4 address on the active network adapter (Wi-Fi or Ethernet).
.DESCRIPTION
  Auto-detects the adapter with a default gateway, shows the current settings and
  prompts for the new values (defaults: keep current IP/gateway/DNS). Pass parameters
  to skip prompts. -Revert switches the adapter back to DHCP.
  Choose an address on the router's subnet but OUTSIDE its DHCP pool, or create a
  DHCP reservation on the router instead (more robust, no IP conflicts).
.EXAMPLE
  .\set-static-ip.ps1
  .\set-static-ip.ps1 -IpAddress 192.168.1.50 -Gateway 192.168.1.1 -PrefixLength 24 -Dns 8.8.8.8,1.1.1.1
  .\set-static-ip.ps1 -Revert
#>
[CmdletBinding()]
param(
    [string]$InterfaceAlias,
    [string]$IpAddress,
    [ValidateRange(0, 32)][int]$PrefixLength = 0,
    [string]$Gateway,
    [string[]]$Dns,
    [switch]$Revert
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Admin

function Read-Default([string]$Prompt, [string]$Default) {
    $v = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($v)) { $Default } else { $v.Trim() }
}
function Test-Ipv4([string]$s) {
    $ip = $null
    ($s -match '^\d{1,3}(\.\d{1,3}){3}$') -and [System.Net.IPAddress]::TryParse($s, [ref]$ip)
}

# --- pick adapter ---
if ($InterfaceAlias) {
    $cfg = Get-NetIPConfiguration -InterfaceAlias $InterfaceAlias
} else {
    $found = @(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' })
    if ($found.Count -eq 0) { throw 'No connected adapter with a default gateway found. Connect to a network or pass -InterfaceAlias.' }
    if ($found.Count -gt 1) {
        Write-Host 'Multiple active adapters:'
        $found | ForEach-Object { Write-Host "  $($_.InterfaceAlias)  $($_.IPv4Address.IPAddress)" }
        $InterfaceAlias = Read-Default 'Adapter to configure' $found[0].InterfaceAlias
        $cfg = $found | Where-Object InterfaceAlias -eq $InterfaceAlias
        if (-not $cfg) { throw "Adapter '$InterfaceAlias' not found." }
    } else { $cfg = $found[0] }
}
$alias = $cfg.InterfaceAlias
$ifIdx = $cfg.InterfaceIndex

if ($Revert) {
    Set-NetIPInterface -InterfaceIndex $ifIdx -Dhcp Enabled
    Get-NetRoute -InterfaceIndex $ifIdx -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
        Remove-NetRoute -Confirm:$false -ErrorAction SilentlyContinue
    Get-NetIPAddress -InterfaceIndex $ifIdx -AddressFamily IPv4 -PrefixOrigin Manual -ErrorAction SilentlyContinue |
        Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue
    Set-DnsClientServerAddress -InterfaceIndex $ifIdx -ResetServerAddresses
    Write-Host "'$alias' is back on DHCP." -ForegroundColor Green
    return
}

$curIp  = $cfg.IPv4Address.IPAddress
$curPfx = $cfg.IPv4Address.PrefixLength
$curGw  = $cfg.IPv4DefaultGateway.NextHop
$curDns = @($cfg.DnsServer | Where-Object AddressFamily -eq 2 | ForEach-Object ServerAddresses)
$curDhcp = (Get-NetIPInterface -InterfaceIndex $ifIdx -AddressFamily IPv4).Dhcp
Write-Host "Adapter: $alias" -ForegroundColor Cyan
Write-Host "Current: $curIp/$curPfx  gateway $curGw  dns $($curDns -join ', ')  (DHCP: $curDhcp)"

$interactive = -not $IpAddress
if (-not $IpAddress)     { $IpAddress    = Read-Default 'Static IP address' $curIp }
if ($PrefixLength -eq 0) { $PrefixLength = [int](Read-Default 'Prefix length (24 = 255.255.255.0)' $curPfx) }
if (-not $Gateway)       { $Gateway      = Read-Default 'Default gateway' $curGw }
if (-not $Dns) {
    $defaultDns = (@($curDns) + '8.8.8.8' | Select-Object -Unique -First 2) -join ','
    $Dns = (Read-Default 'DNS servers (comma-separated)' $defaultDns) -split '\s*,\s*'
}

foreach ($a in (@($IpAddress, $Gateway) + $Dns)) {
    if (-not (Test-Ipv4 $a)) { throw "Invalid IPv4 address: '$a'" }
}
if ($PrefixLength -lt 1 -or $PrefixLength -gt 32) { throw "Invalid prefix length: $PrefixLength" }

if ($IpAddress -eq $curIp -and $curDhcp -eq 'Enabled') {
    Write-Warning "This is the address DHCP currently gave you. A static IP inside the router's DHCP pool can collide with another device; prefer an address outside the pool or a DHCP reservation."
}

if ($interactive) {
    $ok = Read-Host "Apply $IpAddress/$PrefixLength gw $Gateway dns $($Dns -join ',') to '$alias'? Connectivity may drop briefly. (y/N)"
    if ($ok -notmatch '^[yY]') { Write-Host 'Cancelled.'; return }
}

# Clear existing config, then apply.
Set-NetIPInterface -InterfaceIndex $ifIdx -Dhcp Disabled
Get-NetRoute -InterfaceIndex $ifIdx -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
    Remove-NetRoute -Confirm:$false -ErrorAction SilentlyContinue
Get-NetIPAddress -InterfaceIndex $ifIdx -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue
New-NetIPAddress -InterfaceIndex $ifIdx -IPAddress $IpAddress -PrefixLength $PrefixLength -DefaultGateway $Gateway | Out-Null
Set-DnsClientServerAddress -InterfaceIndex $ifIdx -ServerAddresses $Dns

Start-Sleep -Seconds 2
if (Test-Connection $Gateway -Count 2 -Quiet) {
    Write-Host "Static IP set: $IpAddress/$PrefixLength (gateway reachable)." -ForegroundColor Green
} else {
    Write-Warning "Applied, but gateway $Gateway did not answer ping. Check the values, or run with -Revert."
}
Write-Host "Portal URL for other devices: http://${IpAddress}:$(Get-PortalPort)"
