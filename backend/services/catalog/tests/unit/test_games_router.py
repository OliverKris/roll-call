from types import SimpleNamespace

from sqlalchemy.exc import IntegrityError

from app import models, repository
from app.schemas.game import GameCreate

NEW_GAME = {"name": "Wingspan", "min_players": 1, "max_players": 5, "play_time_minutes": 70}


# ---------- happy path ----------


def test_list_games_returns_200_and_games(client, monkeypatch, make_game):
    async def fake_list(session, q=None, players=None):
        return [make_game(id=1, name="Azul"), make_game(id=2, name="Catan")]

    monkeypatch.setattr(repository, "list_games", fake_list)

    r = client.get("/games")

    assert r.status_code == 200
    assert [g["name"] for g in r.json()] == ["Azul", "Catan"]


def test_list_games_passes_parsed_filters_to_repository(client, monkeypatch):
    captured = {}

    async def fake_list(session, q=None, players=None):
        captured.update(q=q, players=players)
        return []

    monkeypatch.setattr(repository, "list_games", fake_list)

    client.get("/games", params={"q": "cat", "players": "4"})

    assert captured == {"q": "cat", "players": 4}  # query string "4" became int 4


def test_list_games_returns_empty_list_not_404(client, monkeypatch):
    async def fake_list(session, q=None, players=None):
        return []

    monkeypatch.setattr(repository, "list_games", fake_list)

    r = client.get("/games")

    assert r.status_code == 200
    assert r.json() == []


def test_get_game_returns_200(client, monkeypatch, make_game):
    async def fake_get(session, game_id):
        return make_game(id=game_id)

    monkeypatch.setattr(repository, "get_game", fake_get)

    r = client.get("/games/1")

    assert r.status_code == 200
    assert r.json()["id"] == 1


def test_create_game_returns_201_with_id(client, monkeypatch):
    received = {}

    async def fake_create(session, data):
        received["data"] = data
        return models.Game(id=42, **data.model_dump())

    monkeypatch.setattr(repository, "create_game", fake_create)

    r = client.post("/games", json=NEW_GAME)

    assert r.status_code == 201
    assert r.json() == {"id": 42, **NEW_GAME}
    assert isinstance(received["data"], GameCreate)


# ---------- error handling ----------


def test_get_missing_game_returns_404(client, monkeypatch):
    async def fake_get(session, game_id):
        return None

    monkeypatch.setattr(repository, "get_game", fake_get)

    r = client.get("/games/999")

    assert r.status_code == 404
    assert r.json() == {"detail": "Game not found"}


def test_get_game_with_non_integer_id_returns_422(client):
    r = client.get("/games/abc")

    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["path", "game_id"]


def test_list_games_with_non_integer_players_returns_422(client):
    r = client.get("/games", params={"players": "lots"})

    assert r.status_code == 422
    assert r.json()["detail"][0]["loc"] == ["query", "players"]


def test_invalid_payload_never_reaches_repository(client, monkeypatch):
    called = False

    async def fake_create(session, data):
        nonlocal called
        called = True

    monkeypatch.setattr(repository, "create_game", fake_create)

    r = client.post("/games", json={**NEW_GAME, "min_players": 6, "max_players": 2})

    assert r.status_code == 422
    assert called is False


def test_duplicate_name_returns_409_and_rolls_back(client, monkeypatch, fake_session):
    async def fake_create(session, data):
        raise IntegrityError("INSERT INTO games ...", {}, Exception("duplicate key value"))

    monkeypatch.setattr(repository, "create_game", fake_create)

    r = client.post("/games", json=NEW_GAME)

    assert r.status_code == 409
    assert r.json() == {"detail": "A game with that name already exists"}
    assert fake_session.rolled_back is True


# ---------- response formatting ----------


def test_response_has_exact_fields(client, monkeypatch, make_game):
    async def fake_get(session, game_id):
        return make_game()

    monkeypatch.setattr(repository, "get_game", fake_get)

    body = client.get("/games/1").json()

    assert set(body) == {"id", "name", "min_players", "max_players", "play_time_minutes"}


def test_response_model_strips_unexpected_attributes(client, monkeypatch):
    async def fake_get(session, game_id):
        return SimpleNamespace(
            id=1,
            name="Catan",
            min_players=3,
            max_players=4,
            play_time_minutes=90,
            internal_notes="do not leak",
        )

    monkeypatch.setattr(repository, "get_game", fake_get)

    body = client.get("/games/1").json()

    assert "internal_notes" not in body


def test_responses_are_json(client, monkeypatch):
    async def fake_list(session, q=None, players=None):
        return []

    monkeypatch.setattr(repository, "list_games", fake_list)

    r = client.get("/games")

    assert r.headers["content-type"] == "application/json"


def test_validation_errors_follow_fastapi_error_shape(client):
    r = client.post("/games", json={"min_players": 2})

    detail = r.json()["detail"]
    assert isinstance(detail, list)
    assert {"loc", "msg", "type"} <= set(detail[0])
    assert ["body", "name"] in [e["loc"] for e in detail]
