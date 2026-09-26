# Quickstart: Angular Frontend Migration

Prereq: Node >= 24.15 (research.md #1), Python venv per `CLAUDE.md`.

## Local development

```
cd backend && .venv/Scripts/activate && uvicorn main:app --reload   # :8000
cd frontend && npm ci && npm start                                   # ng serve :4200, /accounts proxied to :8000
```

## Quality gates (run in `frontend/`)

```
npm run lint    # ng lint
npm test        # ng test (Vitest), single run: npm test -- --watch=false
npm run build   # ng build (strict type-check + production bundle; lazy chunk per page)
```

## Manual parity check (SC-001..003)

1. With the old React app (`git stash`/previous checkout, `npm run dev`) and the new app, upload the files in `sample-data/` on each of the four pages; compare summaries, lists, and the downloaded `.xlsx` contents.
2. Wrong file per page -> back-end `detail` message shown; missing input -> inline message, no request in the Network tab.
3. Double-click submit -> only one request; submit disabled while pending.
4. Open each route directly and refresh; open an unknown path -> lands on Home.
5. Tax page: template link downloads `Tax_Reduction_Input.xlsx`.

## Containerised check (SC-004)

```
docker compose up --build     # http://localhost:8080
```

Deep-link `/tax-deduction`, refresh, upload a ~20 MB `.xlsx` on any page -> processed without a size/timeout error.

## Cutover check (SC-007)

`grep -ril "react\|vite\|tanstack" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=specs .` returns nothing (historic `specs/` and the migration plan are exempt).
