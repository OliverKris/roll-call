import pytest

from app import models


@pytest.fixture
def make_game():
    """Build an ORM Game without touching a database."""

    def _make(**overrides) -> models.Game:
        data = {
            "id": 1,
            "name": "Catan",
            "min_players": 3,
            "max_players": 4,
            "play_time_minutes": 90,
        }
        data.update(overrides)
        return models.Game(**data)

    return _make
