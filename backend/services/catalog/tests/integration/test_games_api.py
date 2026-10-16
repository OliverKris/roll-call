import pytest

pytestmark = pytest.mark.integration

NEW_GAME = {"name": "Wingspan", "min_players": 1, "max_players": 5, "play_time_minutes": 70}


async def test_post_then_get_through_the_api(api):
    created = await api.post("/games", json=NEW_GAME)
    assert created.status_code == 201

    fetched = await api.get(f"/games/{created.json()['id']}")
    assert fetched.status_code == 200
    assert fetched.json() == created.json()


async def test_duplicate_post_returns_409_from_real_constraint(api):
    r = await api.post("/games", json={**NEW_GAME, "name": "Catan"})
    assert r.status_code == 409
