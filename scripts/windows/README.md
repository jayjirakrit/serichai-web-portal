# Windows install (native, no Docker)

Runs the whole portal as **one process on one port** (default `8080`): FastAPI (uvicorn) serves both the API (`/accounts/*`) and the built Angular app. A Scheduled Task starts it at every boot as `SYSTEM`, so no one needs to log in.

All scripts need an **elevated** PowerShell (Run as administrator). If script execution is blocked, prefix with `powershell -ExecutionPolicy Bypass -File`.

| Order | Script | What it does |
|---|---|---|
| 1 | `setup.ps1` | Installs Python 3.13 + Node LTS (winget), backend venv + `pip install`, `npm ci` + build, registers the `SerichaiWebPortal` startup task, starts it and waits for `/health`. Re-run to deploy updates. Flags: `-Port 8080`, `-SkipInstall`, `-SkipBuild`. |
| 2 | `open-firewall.ps1` | Inbound TCP allow rule for the port, **local subnet only**, Private/Domain profiles. Add `-MakeNetworkPrivate` if your Wi-Fi is classified "Public" (Windows default for new networks). `-Remove` deletes the rule. Prints the URLs other devices should use. |
| 3 (optional) | `set-static-ip.ps1` | Detects the active adapter, shows current IP/gateway/DNS, prompts for new values (Enter keeps current). Non-interactive: `-IpAddress 192.168.1.50 -Gateway 192.168.1.1 -PrefixLength 24 -Dns 8.8.8.8,1.1.1.1`. `-Revert` returns to DHCP. |
| - | `uninstall.ps1` | Removes the startup task and firewall rule (keeps Python/Node/repo). |
| - | `start-portal.ps1` | What the task runs. Can be run by hand for debugging. |

```powershell
# from the repo root, in an elevated PowerShell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\windows\open-firewall.ps1 -MakeNetworkPrivate
powershell -ExecutionPolicy Bypass -File .\scripts\windows\set-static-ip.ps1
```

Then open `http://<this-machine-ip>:8080` from any device on the same network.

## Static IP notes
- Pick an address on the router's subnet but **outside its DHCP pool** (or reserve the address for this PC's MAC in the router's DHCP settings — more robust, and no script needed).
- Static IPs are per-network. If the machine moves to a different Wi-Fi, run `set-static-ip.ps1 -Revert`.
- A wrong value can cut connectivity; the script pings the gateway afterwards and warns if it fails.

## Operations
- Status: `Get-ScheduledTask SerichaiWebPortal | Get-ScheduledTaskInfo`
- Restart: `Stop-ScheduledTask SerichaiWebPortal; Start-ScheduledTask SerichaiWebPortal`
- Logs: `scripts\windows\logs\portal.log` (access log) and `portal.err.log` (uvicorn/app errors), rotated at 5 MB on start.
- Change port: `setup.ps1 -Port 9000 -SkipInstall -SkipBuild`, then re-run `open-firewall.ps1`.
- Excel templates are read from `backend\data\` on each request; update them in place, no rebuild needed.
- Security: the portal has no TLS or authentication. Only expose it on a trusted private network.
