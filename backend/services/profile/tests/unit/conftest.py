from datetime import UTC, datetime

import httpx
import pytest
from fastapi.testclient import TestClient
from rollcall_common.testing import make_userinfo_header

from app import models
from app.catalog_client import get_catalog_client
from app.db import get_session
from app.main import app

KNOWN_GAME_IDS = {1, 2, 3}


@pytest.fixture
def catalog_state():
    """Toggle `down` to simulate a Catalog outage."""
    return {"down": False}


@pytest.fixture
def client(catalog_state):
    def handler(request: httpx.Request) -> httpx.Response:
        if catalog_state["down"]:
            raise httpx.ConnectError("catalog down", request=request)
        game_id = int(request.url.path.rsplit("/", 1)[-1])
        return httpx.Response(200 if game_id in KNOWN_GAME_IDS else 404)

    async def override_catalog():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="http://catalog"
        ) as c:
            yield c

    async def override_session():
        yield object()  # repository functions are stubbed, so the session is never used

    app.dependency_overrides[get_catalog_client] = override_catalog
    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    return {"X-Userinfo": make_userinfo_header(sub="user-123", name="Alice Tester")}


@pytest.fixture
def make_profile():
    def _make(game_ids=(), **overrides) -> models.Profile:
        now = datetime(2026, 10, 16, tzinfo=UTC)
        data = {
            "user_id": "user-123",
            "display_name": "Alice Tester",
            "home_area": "Brooklyn",
            "bio": None,
            "created_at": now,
            "updated_at": now,
        }
        data.update(overrides)
        profile = models.Profile(**data)
        profile.games = [models.ProfileGame(game_id=g) for g in game_ids]
        return profile

    return _make