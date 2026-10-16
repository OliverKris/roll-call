from rollcall_common.auth import CurrentUser
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.schemas.profile import ProfileUpdate


def default_display_name(user: CurrentUser) -> str:
    if user.name:
        return user.name[:80]
    if user.preferred_username:
        return user.preferred_username[:80]
    if user.email:
        return user.email.split("@")[0][:80]
    return "Player"


async def get_profile(session: AsyncSession, user_id: str) -> models.Profile | None:
    return await session.get(models.Profile, user_id)


async def get_or_create_profile(session: AsyncSession, user: CurrentUser) -> models.Profile:
    """Create the profile the first time a user shows up. Keycloak owns sign-up."""
    profile = await get_profile(session, user.sub)
    if profile is not None:
        return profile

    profile = models.Profile(user_id=user.sub, display_name=default_display_name(user))
    session.add(profile)
    try:
        await session.commit()
    except IntegrityError:
        # Two first requests raced; the other one created it.
        await session.rollback()
        existing = await get_profile(session, user.sub)
        if existing is None:
            raise
        return existing
    await session.refresh(profile)
    return profile


async def update_profile(
    session: AsyncSession, profile: models.Profile, data: ProfileUpdate
) -> models.Profile:
    for field, value in data.model_dump().items():
        setattr(profile, field, value)
    await session.commit()
    await session.refresh(profile)
    return profile


async def replace_games(
    session: AsyncSession, profile: models.Profile, game_ids: list[int]
) -> models.Profile:
    # Apply a diff instead of replacing the whole list. Swapping in new rows with
    # the same primary keys makes SQLAlchemy insert before deleting, which fails.
    wanted = set(game_ids)
    current = {link.game_id: link for link in profile.games}

    for game_id, link in current.items():
        if game_id not in wanted:
            profile.games.remove(link)
    for game_id in game_ids:
        if game_id not in current:
            profile.games.append(models.ProfileGame(game_id=game_id))

    profile.updated_at = func.now()
    await session.commit()
    await session.refresh(profile)
    return profile
