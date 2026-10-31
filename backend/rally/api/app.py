"""FastAPI application factory."""

from __future__ import annotations

import logging
import os
from pathlib import Path, PurePosixPath

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from ..bootstrap import build_dependencies
from .routes import router

log = logging.getLogger("rally")


def _frontend_dist() -> Path | None:
    """Locate the built web app, if present.

    Docker image: ``/app/web-dist``. Local checkout after ``npm run build``:
    ``rally-web/dist``. Returns None when no build exists (API-only mode).
    """
    root = Path(__file__).resolve().parents[3]
    for candidate in (root / "web-dist", root / "rally-web" / "dist"):
        index = candidate / "index.html"
        if index.is_file():
            return candidate
    return None


def create_app() -> FastAPI:
    deps = build_dependencies()
    app = FastAPI(title="Rally API", version="0.1.0")
    app.state.deps = deps

    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    extra = os.environ.get("CORS_EXTRA_ORIGINS", "").strip()
    if extra:
        origins.extend(o.strip() for o in extra.split(",") if o.strip())
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(router)
    dist = _frontend_dist()
    app.state.frontend_dist = str(dist) if dist is not None else None
    if dist is None:
        log.warning("no frontend build found: API-only mode")

        @app.get("/{path:path}", include_in_schema=False)
        def api_only(path: str):  # noqa: ARG001 - path shape required by route
            return JSONResponse(
                status_code=404,
                content={"code": "not_found", "message": "Unknown path."},
            )

        return app

    dist_resolved = dist.resolve()

    def file_response(path: Path, *, immutable: bool = False) -> FileResponse:
        headers = {"Cache-Control": "no-store"}
        if immutable:
            headers = {"Cache-Control": "public, max-age=31536000, immutable"}
        return FileResponse(path, headers=headers)

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path == "api" or path.startswith("api/"):
            return JSONResponse(
                status_code=404,
                content={"code": "not_found", "message": "Unknown API path."},
            )
        if path:
            try:
                candidate = (dist / path).resolve()
            except OSError:
                candidate = None
            if (
                candidate is not None
                and candidate.is_file()
                and dist_resolved in candidate.parents
            ):
                # Content-hashed build output is safe to cache hard.
                return file_response(candidate, immutable=path.startswith("assets/"))
            if PurePosixPath(path).suffix:
                # A missing file (e.g. a stale hashed asset) must 404, not
                # serve index.html as the wrong MIME type.
                return JSONResponse(
                    status_code=404,
                    content={"code": "not_found", "message": "Unknown static file."},
                )
        # Extensionless navigation path: serve the shell, never cached, so a
        # redeploy can't strand browsers on a stale asset manifest.
        return file_response(dist / "index.html")

    return app
