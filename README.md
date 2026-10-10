# Serichai Web Portal

An internal tool for **Serichai** and **Ch.Paisarn**. Accounting staff upload Excel workbooks, the portal calculates the result, and the output can be reviewed on screen and downloaded as Excel reports. It runs on a private network with no TLS or authentication.

## Features

| Page | Route | What it does | Backend endpoint |
|------|-------|--------------|------------------|
| Home | `/` | Landing page with a card for each tool | - |
| Login | `/login` | Placeholder only, there is no authentication yet | - |
| Employee Benefits | `/employee-benefits` | Calculates employee benefits from the benefit workbook. An optional previous-benefits file carries earlier benefits forward. Shows a summary and exceptions and offers the result files for download. | `POST /accounts/employee-benefits` |
| Bonus Calculation | `/bonus-calculation` | Calculates bonuses from the current-year workbook and an optional previous-year summary for a given year. Shows a summary and flagged employees and offers the bonus report for download. | `POST /accounts/bonus-calculation` |
| Payroll Reconciliation | `/payroll-reconciliation` | Reconciles a payroll workbook for a period. | `POST /accounts/payroll-reconcile` |
| Elderly Tax Deduction | `/elderly-tax-deduction` | Calculates the elderly tax deduction from a roster workbook, with an optional reference date and a downloadable input template. | `POST /accounts/tax-deduction` |

The Excel data uses Thai-language column headers and Buddhist Era (BE) years (BE = Gregorian year + 543).

## Tech stack

- **Frontend** (`frontend/`): Angular 22, TypeScript, Tailwind CSS v4 and DaisyUI
- **Backend** (`backend/`): FastAPI on Python 3.13
- **Deployment**: nginx gateway in Docker, or a native Windows install

## Run locally

Two separate processes (Node >= 24.15 and Python 3.13 required):

```
# backend (from backend/)
pip install -r requirements.txt
uvicorn main:app --reload        # http://127.0.0.1:8000

# frontend (from frontend/)
npm ci
npm start                        # http://localhost:4200, /accounts is proxied to the backend
```

Other frontend commands (`npm run build`, `npm run lint`, `npm test`) are listed in [CLAUDE.md](CLAUDE.md#commands). The repository also has a devcontainer (`.devcontainer/`) with both toolchains pre-installed.

## Deploy

**Docker** (whole portal behind one port):

```
cp .env.example .env     # first time only; defaults work as they are
docker compose up        # http://localhost:8080 (or $PORT)
```

**Windows, without Docker:** run `scripts/windows/setup.ps1`. It installs the dependencies, builds the frontend, and registers the portal to start at boot. See [scripts/windows/README.md](scripts/windows/README.md) for the firewall, static IP and uninstall scripts.

## Repository layout

```
frontend/         Angular single-page app
backend/          FastAPI service (routers/ -> services/); Excel templates in backend/data/
specs/            Spec-Kit feature specs (001-008) with plans, design notes and tasks
scripts/windows/  Native Windows install, start and firewall scripts
docs/             Diagrams
docker-compose.yml, .env.example   Container deployment
```

## Development process

Features are specified, planned and broken into tasks with Spec-Kit under `specs/` (001 employee benefits, 002 carry-forward, 003 payroll reconcile, 004 bonus, 005 Docker, 006 elderly tax deduction, 007 Angular migration, 008 frontend cutover). Conventions for code, architecture, state management and commit messages are in [CLAUDE.md](CLAUDE.md).

## Upgrading from the old layout

The Angular app used to live in a temporary `frontend-ng/` folder. After pulling the change that renamed it to `frontend/`:

1. Delete any leftover `frontend-ng/` folder on your machine (git leaves ignored files like `node_modules` behind).
2. Run `npm ci` in `frontend/`.
3. On an installed Windows host, re-run `scripts/windows/setup.ps1` (safe to repeat, without `-SkipBuild`) so the portal serves the rebuilt bundle.
