<#
.SYNOPSIS
  Allows other machines on the same Wi-Fi/LAN to reach the portal.
.DESCRIPTION
  Creates an inbound TCP allow rule for the portal port, limited to the local
  subnet and to Private/Domain network profiles. Windows marks new Wi-Fi networks
  as "Public" by default, which the rule does not cover - use -MakeNetworkPrivate
  to switch the connected network(s) to Private.
.EXAMPLE
  .\open-firewall.ps1 -MakeNetworkPrivate
  .\open-firewall.ps1 -Remove
#>
[CmdletBinding()]
param(
    [int]$Port = 0,
    [string]$RemoteAddress = 'LocalSubnet',
    [switch]$MakeNetworkPrivate,
    [switch]$Remove
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Admin

if ($Remove) {
    Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Write-Host "Removed firewall rule '$RuleName'."
    return
}

if ($Port -le 0) { $Port = Get-PortalPort }

Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Port -Profile Private, Domain `
    -RemoteAddress $RemoteAddress | Out-Null
Write-Host "Firewall rule '$RuleName' created: TCP $Port from $RemoteAddress (Private/Domain profiles)." -ForegroundColor Green

$public = @(Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' })
if ($public.Count -gt 0) {
    if ($MakeNetworkPrivate) {
        foreach ($p in $public) {
            Set-NetConnectionProfile -InterfaceIndex $p.InterfaceIndex -NetworkCategory Private
            Write-Host "Network '$($p.Name)' switched from Public to Private."
        }
    } else {
        Write-Warning ("Connected network(s) are 'Public' ($($public.Name -join ', ')), so the rule will NOT apply. " +
            'Re-run with -MakeNetworkPrivate if this is a trusted network (home/office).')
    }
}

Write-Host "`nOther devices on this network can open:"
Get-LanAddress | ForEach-Object { Write-Host "  http://${_}:$Port" -ForegroundColor Cyan }
