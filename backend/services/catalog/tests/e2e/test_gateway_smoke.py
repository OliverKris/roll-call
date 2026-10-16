import os

import httpx
import pytest

BASE_URL = os.getenv("E2E_BASE_URL")

pytestmark = [
    pytest.mark.e2e,
    pytest.mark.skipif(not BASE_URL, reason="set E2E_BASE_URL to run against the stack"),
]


def test_games_are_served_through_the_gateway():
    r = httpx.get(f"{BASE_URL}/api/v1/games", timeout=5)

    assert r.status_code == 200
    assert r.headers["server"].startswith("APISIX")
    assert any(g["name"] == "Catan" for g in r.json())


def test_unknown_route_is_rejected_by_the_gateway():
    r = httpx.get(f"{BASE_URL}/api/v1/does-not-exist", timeout=5)

    assert r.status_code == 404
