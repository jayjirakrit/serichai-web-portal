<#
.SYNOPSIS
  Removes the startup task and firewall rule. Leaves Python/Node, the repo and the downloaded nginx\ folder untouched.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
Assert-Admin

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed scheduled task '$TaskName'."
}

Stop-PortalProcesses
Write-Host 'Stopped nginx/uvicorn processes (if any).'

if (Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue) {
    Remove-NetFirewallRule -DisplayName $RuleName
    Write-Host "Removed firewall rule '$RuleName'."
}
Write-Host 'Done.'
