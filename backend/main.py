import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from routers import accounts_router

app = FastAPI()
app.include_router(accounts_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optional: serve the built Angular bundle from this process (used by the
# native Windows install, scripts/windows/). Unset in dev and in Docker, where
# ng serve / nginx do this instead.
_frontend_dist = os.environ.get("FRONTEND_DIST")
if _frontend_dist and Path(_frontend_dist).is_dir():
    _dist_root = Path(_frontend_dist).resolve()
    _api_prefixes = ("accounts", "docs", "redoc", "openapi.json", "health")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str) -> FileResponse:
        if full_path.split("/", 1)[0] in _api_prefixes:
            raise HTTPException(status_code=404)
        candidate = (_dist_root / full_path).resolve()
        if candidate.is_file() and candidate.is_relative_to(_dist_root):
            return FileResponse(candidate)
        # SPA fallback: let the Angular router handle client-side routes.
        return FileResponse(_dist_root / "index.html")
