import pytest
from pydantic import ValidationError

from app import models
from app.schemas.game import Game, GameCreate

VALID = {"name": "Azul", "min_players": 2, "max_players": 4, "play_time_minutes": 45}


# ---------- happy path ----------


def test_game_create_accepts_valid_payload():
    game = GameCreate(**VALID)
    assert game.model_dump() == VALID


def test_single_player_game_is_valid():
    game = GameCreate(**{**VALID, "min_players": 1, "max_players": 1})
    assert game.min_players == game.max_players == 1


# ---------- data transformation ----------


def test_numeric_strings_are_coerced_to_ints():
    game = GameCreate(name="Azul", min_players="2", max_players="4", play_time_minutes="45")
    assert (game.min_players, game.max_players, game.play_time_minutes) == (2, 4, 45)
    assert isinstance(game.min_players, int)


def test_game_is_built_from_orm_object(make_game):
    orm = make_game(id=7, name="Wingspan", min_players=1, max_players=5, play_time_minutes=70)

    game = Game.model_validate(orm)

    assert game.model_dump() == {
        "id": 7,
        "name": "Wingspan",
        "min_players": 1,
        "max_players": 5,
        "play_time_minutes": 70,
    }


def test_create_payload_maps_cleanly_onto_orm_model():
    orm = models.Game(**GameCreate(**VALID).model_dump())
    assert orm.name == "Azul"
    assert orm.id is None  # the database assigns the id


def test_json_dump_has_exact_keys_and_types(make_game):
    dumped = Game.model_validate(make_game()).model_dump(mode="json")

    assert set(dumped) == {"id", "name", "min_players", "max_players", "play_time_minutes"}
    assert all(isinstance(dumped[k], int) for k in dumped if k != "name")


# ---------- error handling ----------


@pytest.mark.parametrize(
    "field, bad_value",
    [
        ("name", ""),
        ("name", "x" * 201),
        ("min_players", 0),
        ("max_players", 0),
        ("play_time_minutes", 0),
        ("play_time_minutes", -10),
        ("min_players", "two"),
    ],
)
def test_invalid_field_values_are_rejected(field, bad_value):
    with pytest.raises(ValidationError) as exc:
        GameCreate(**{**VALID, field: bad_value})
    assert exc.value.errors()[0]["loc"] == (field,)


def test_max_players_below_min_players_is_rejected():
    with pytest.raises(ValidationError) as exc:
        GameCreate(**{**VALID, "min_players": 5, "max_players": 2})
    assert "max_players must be >= min_players" in str(exc.value)


@pytest.mark.parametrize("missing", list(VALID))
def test_missing_required_field_is_rejected(missing):
    payload = {k: v for k, v in VALID.items() if k != missing}
    with pytest.raises(ValidationError) as exc:
        GameCreate(**payload)
    assert exc.value.errors()[0]["type"] == "missing"
