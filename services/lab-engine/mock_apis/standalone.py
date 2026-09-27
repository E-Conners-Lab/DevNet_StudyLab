"""
Standalone ASGI app factory for the mock Cisco platform APIs.

Each mock platform is written as an `APIRouter` so `main.py` can mount them all
into the single lab-engine service (under `/mock/<platform>`). The same routers
are also served as independent services on their own ports, which is what the
Docker Compose `mock-*` services and the study material use to simulate talking
to three separate Cisco platforms.

`make_standalone_app` wraps a router in the `FastAPI` instance those services
need, so a router is never duplicated to gain a standalone entrypoint.
"""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Origins allowed to call a mock platform directly from the browser.
ALLOWED_ORIGINS = ("http://localhost:3000",)


def make_standalone_app(
    router: APIRouter,
    title: str,
    description: str,
) -> FastAPI:
    """
    Wrap a mock-platform router in its own FastAPI application.

    The returned app exposes the router's paths at the root (no `/mock/...`
    prefix), so a standalone mock answers the same URLs as the real platform,
    plus a `/health` endpoint for container health checks.
    """
    app = FastAPI(title=title, description=description, version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(ALLOWED_ORIGINS),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["health"])
    async def health_check():
        """Liveness probe for the standalone mock service."""
        return {"status": "healthy", "service": title}

    app.include_router(router)
    return app
