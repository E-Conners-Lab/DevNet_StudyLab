"""
Smoke tests for the mock platform APIs.

These exist because of a real regression: the Docker Compose `mock-*` services
ran `uvicorn mock_apis.<platform>.app:app` while the modules only exported
`router`, so all three containers exited on startup with
`Error loading ASGI app. Attribute "app" not found`. Nothing caught it because
there was no Python test suite at all.

Each platform is reachable two ways and both must keep working:
  1. standalone, as its own service on its own port (`app`)
  2. mounted into the lab engine under /mock/<platform> (`router`)

Assertions go through the OpenAPI schema and real requests rather than walking
`app.routes`: FastAPI represents an included router as a private
`_IncludedRouter` with no `path`, so route-list introspection silently yields
nothing and every assertion built on it passes vacuously.
"""

import importlib

import pytest
from fastapi.testclient import TestClient

PLATFORMS = ("meraki", "catalyst", "webex")


def platform_app(platform: str):
    """The ASGI app the `mock-<platform>` container's command names."""
    module = importlib.import_module(f"mock_apis.{platform}.app")
    app = getattr(module, "app", None)
    assert app is not None, (
        f"mock_apis.{platform}.app has no `app` attribute - the "
        f"mock-{platform} container cannot start without it"
    )
    return app


def schema_paths(app) -> set[str]:
    return set(app.openapi()["paths"])


@pytest.mark.parametrize("platform", PLATFORMS)
def test_standalone_app_serves_health(platform: str) -> None:
    """The container health probe targets /health on each standalone service."""
    response = TestClient(platform_app(platform)).get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


@pytest.mark.parametrize("platform", PLATFORMS)
def test_standalone_app_exposes_platform_routes(platform: str) -> None:
    """A standalone mock serves more than just its health endpoint."""
    paths = schema_paths(platform_app(platform)) - {"/health"}

    assert paths, f"{platform} standalone app exposes no platform routes"


@pytest.mark.parametrize("platform", PLATFORMS)
def test_router_is_mounted_in_the_lab_engine(platform: str) -> None:
    """The same routes are also served under /mock/<platform>."""
    from main import app as lab_engine_app

    prefix = f"/mock/{platform}"
    mounted = {p for p in schema_paths(lab_engine_app) if p.startswith(prefix)}

    assert mounted, f"no routes mounted under {prefix} in the lab engine"


@pytest.mark.parametrize("platform", PLATFORMS)
def test_standalone_and_mounted_expose_the_same_paths(platform: str) -> None:
    """
    Guard against the two entrypoints drifting - a route added below the
    `app = make_standalone_app(...)` line would reach /mock/* but not the
    standalone service.
    """
    from main import app as lab_engine_app

    prefix = f"/mock/{platform}"

    standalone = schema_paths(platform_app(platform)) - {"/health"}
    mounted = {
        p[len(prefix) :]
        for p in schema_paths(lab_engine_app)
        if p.startswith(prefix)
    }

    # Both sides must be non-empty, or this comparison proves nothing.
    assert standalone, f"{platform}: standalone exposes no routes"
    assert mounted, f"{platform}: nothing mounted under {prefix}"
    assert standalone == mounted, (
        f"{platform}: standalone and mounted paths differ - "
        f"only standalone: {sorted(standalone - mounted)}, "
        f"only mounted: {sorted(mounted - standalone)}"
    )


def test_lab_engine_health() -> None:
    """The endpoint the lab-engine container health probe targets."""
    from main import app as lab_engine_app

    response = TestClient(lab_engine_app).get("/health")

    assert response.status_code == 200


def test_meraki_standalone_answers_a_real_request() -> None:
    """End-to-end through the standalone app, with the documented API key."""
    client = TestClient(platform_app("meraki"))

    unauthorized = client.get("/api/v1/organizations")
    assert unauthorized.status_code == 401

    authorized = client.get(
        "/api/v1/organizations",
        headers={"X-Cisco-Meraki-API-Key": "devnet-studylab-meraki-key"},
    )
    assert authorized.status_code == 200
    assert isinstance(authorized.json(), list)
    assert authorized.json()


def test_sandbox_endpoint_runs_code() -> None:
    """The endpoint LAB_ENGINE_URL must point at."""
    from main import app as lab_engine_app

    response = TestClient(lab_engine_app).post(
        "/api/v1/sandbox/run",
        json={"code": "print(6 * 7)", "language": "python", "slug": "smoke"},
    )

    assert response.status_code == 200
    assert response.json()["output"].strip() == "42"
