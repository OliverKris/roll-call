import pytest
from rollcall_common.auth import CurrentUser

from app import repository
from app.schemas.profile import ProfileUpdate

pytestmark = pytest.mark.integration

ALICE = CurrentUser(sub="kc-alice", name="Alice Tester", email="alice@example.com")


async def test_first_request_creates_profile_from_claims(session):
    profile = await repository.get_or_create_profile(session, ALICE)

    assert profile.user_id == "kc-alice"
    assert profile.display_name == "Alice Tester"
    assert profile.game_ids == []


async def test_second_request_returns_same_profile(session):
    first = await repository.get_or_create_profile(session, ALICE)
    second = await repository.get_or_create_profile(session, ALICE)

    assert first.created_at == second.created_at


async def test_display_name_falls_back_to_email(session):
    user = CurrentUser(sub="kc-bob", email="bob@example.com")
    profile = await repository.get_or_create_profile(session, user)
    assert profile.display_name == "bob"


async def test_update_persists(session):
    profile = await repository.get_or_create_profile(session, ALICE)
    await repository.update_profile(
        session, profile, ProfileUpdate(display_name="Al", home_area="Brooklyn")
    )

    reloaded = await repository.get_profile(session, "kc-alice")
    assert (reloaded.display_name, reloaded.home_area) == ("Al", "Brooklyn")


async def test_replace_games_applies_a_diff(session):
    profile = await repository.get_or_create_profile(session, ALICE)

    await repository.replace_games(session, profile, [1, 2])
    await repository.replace_games(session, profile, [2, 3])
    assert profile.game_ids == [2, 3]


async def test_replacing_with_the_same_ids_is_safe(session):
    profile = await repository.get_or_create_profile(session, ALICE)

    await repository.replace_games(session, profile, [1, 2])
    # Without the diff logic, this second call would hit a primary-key clash
    await repository.replace_games(session, profile, [1, 2])
    assert profile.game_ids == [1, 2]
