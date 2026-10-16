from app import repository

# ---------- auth ----------


def test_me_requires_identity_header(client, monkeypatch):
    called = False

    async def fake(session, user):
        nonlocal called
        called = True

    monkeypatch.setattr(repository, "get_or_create_profile", fake)

    r = client.get("/profiles/me")

    assert r.status_code == 401
    assert called is False


def test_me_rejects_malformed_identity_header(client):
    r = client.get("/profiles/me", headers={"X-Userinfo": "garbage"})
    assert r.status_code == 401


# ---------- happy path ----------


def test_get_me_uses_sub_from_header(client, auth_headers, monkeypatch, make_profile):
    seen = {}

    async def fake(session, user):
        seen["sub"] = user.sub
        return make_profile(game_ids=[3, 1])

    monkeypatch.setattr(repository, "get_or_create_profile", fake)

    r = client.get("/profiles/me", headers=auth_headers)

    assert r.status_code == 200
    assert seen["sub"] == "user-123"
    assert r.json()["game_ids"] == [1, 3]  # sorted by the model


def test_put_me_strips_whitespace_and_blanks_become_null(
    client, auth_headers, monkeypatch, make_profile
):
    received = {}

    async def fake_get_or_create(session, user):
        return make_profile()

    async def fake_update(session, profile, data):
        received["data"] = data
        for k, v in data.model_dump().items():
            setattr(profile, k, v)
        return profile

    monkeypatch.setattr(repository, "get_or_create_profile", fake_get_or_create)
    monkeypatch.setattr(repository, "update_profile", fake_update)

    r = client.put(
        "/profiles/me",
        headers=auth_headers,
        json={"display_name": "  Alice  ", "home_area": "   ", "bio": "Loves Azul"},
    )

    assert r.status_code == 200
    assert received["data"].display_name == "Alice"
    assert received["data"].home_area is None
    assert r.json()["bio"] == "Loves Azul"


def test_set_games_dedupes_and_saves(client, auth_headers, monkeypatch, make_profile):
    received = {}

    async def fake_get_or_create(session, user):
        return make_profile()

    async def fake_replace(session, profile, game_ids):
        received["ids"] = game_ids
        return make_profile(game_ids=game_ids)

    monkeypatch.setattr(repository, "get_or_create_profile", fake_get_or_create)
    monkeypatch.setattr(repository, "replace_games", fake_replace)

    r = client.put("/profiles/me/games", headers=auth_headers, json={"game_ids": [2, 1, 2]})

    assert r.status_code == 200
    assert received["ids"] == [2, 1]
    assert r.json()["game_ids"] == [1, 2]


# ---------- error handling ----------


def test_set_games_rejects_unknown_games(client, auth_headers, monkeypatch):
    called = False

    async def fake_replace(session, profile, game_ids):
        nonlocal called
        called = True

    monkeypatch.setattr(repository, "replace_games", fake_replace)

    r = client.put("/profiles/me/games", headers=auth_headers, json={"game_ids": [1, 99]})

    assert r.status_code == 422
    assert r.json()["detail"]["missing_game_ids"] == [99]
    assert called is False


def test_set_games_returns_503_when_catalog_is_down(
    client, auth_headers, catalog_state, monkeypatch
):
    catalog_state["down"] = True
    called = False

    async def fake_replace(session, profile, game_ids):
        nonlocal called
        called = True

    monkeypatch.setattr(repository, "replace_games", fake_replace)

    r = client.put("/profiles/me/games", headers=auth_headers, json={"game_ids": [1]})

    assert r.status_code == 503
    assert called is False


def test_set_games_rejects_non_positive_ids(client, auth_headers):
    r = client.put("/profiles/me/games", headers=auth_headers, json={"game_ids": [0]})
    assert r.status_code == 422


def test_put_me_rejects_bio_over_500_chars(client, auth_headers):
    r = client.put(
        "/profiles/me", headers=auth_headers, json={"display_name": "A", "bio": "x" * 501}
    )
    assert r.status_code == 422


# ---------- response formatting ----------


def test_public_profile_hides_private_fields(client, auth_headers, monkeypatch, make_profile):
    async def fake_get(session, user_id):
        return make_profile(user_id=user_id, bio="private bio")

    monkeypatch.setattr(repository, "get_profile", fake_get)

    body = client.get("/profiles/someone-else", headers=auth_headers).json()

    assert set(body) == {"user_id", "display_name", "home_area", "game_ids"}


def test_public_profile_404(client, auth_headers, monkeypatch):
    async def fake_get(session, user_id):
        return None

    monkeypatch.setattr(repository, "get_profile", fake_get)

    r = client.get("/profiles/nobody", headers=auth_headers)

    assert r.status_code == 404
