import pytest
from sqlalchemy.exc import IntegrityError

from app import models, repository
from app.schemas.game import GameCreate

pytestmark = pytest.mark.integration


async def test_migration_seeds_games_sorted_by_name(session):
    games = await repository.list_games(session)
    assert [g.name for g in games] == ["Azul", "Catan", "Ticket to Ride"]


async def test_player_count_filter_uses_inclusive_range(session):
    games = await repository.list_games(session, players=5)
    assert [g.name for g in games] == ["Ticket to Ride"]


async def test_name_search_is_case_insensitive(session):
    games = await repository.list_games(session, q="CAT")
    assert [g.name for g in games] == ["Catan"]


async def test_create_then_get_round_trip(session):
    created = await repository.create_game(
        session,
        GameCreate(name="Wingspan", min_players=1, max_players=5, play_time_minutes=70),
    )

    fetched = await repository.get_game(session, created.id)

    assert fetched is not None
    assert fetched.name == "Wingspan"


async def test_duplicate_name_violates_unique_constraint(session):
    with pytest.raises(IntegrityError):
        await repository.create_game(
            session,
            GameCreate(name="Catan", min_players=3, max_players=4, play_time_minutes=90),
        )


async def test_database_rejects_bad_player_range_even_without_pydantic(session):
    # Bypasses Pydantic: proves the CHECK constraint protects the data on its own
    session.add(models.Game(name="Broken", min_players=5, max_players=2, play_time_minutes=30))
    with pytest.raises(IntegrityError):
        await session.flush()
