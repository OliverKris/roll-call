from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from rollcall_common.auth import CurrentUser, get_current_user
from sqlalchemy.ext.asyncio import AsyncSession

from app import catalog_client, repository
from app.catalog_client import CatalogUnavailableError, get_catalog_client
from app.db import get_session
from app.schemas.profile import MyProfile, ProfileGamesUpdate, ProfileUpdate, PublicProfile

router = APIRouter(prefix="/profiles", tags=["profiles"])

UserDep = Annotated[CurrentUser, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
CatalogDep = Annotated[httpx.AsyncClient, Depends(get_catalog_client)]


@router.get("/me", response_model=MyProfile)
async def get_my_profile(user: UserDep, session: SessionDep):
    return await repository.get_or_create_profile(session, user)


@router.put("/me", response_model=MyProfile)
async def update_my_profile(data: ProfileUpdate, user: UserDep, session: SessionDep):
    profile = await repository.get_or_create_profile(session, user)
    return await repository.update_profile(session, profile, data)


@router.put("/me/games", response_model=MyProfile)
async def set_my_games(
    data: ProfileGamesUpdate, user: UserDep, session: SessionDep, catalog: CatalogDep
):
    try:
        missing = await catalog_client.find_missing_game_ids(catalog, data.game_ids)
    except CatalogUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Game catalog is unavailable; try again shortly",
        ) from None
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"message": "Some games do not exist", "missing_game_ids": missing},
        )
    profile = await repository.get_or_create_profile(session, user)
    return await repository.replace_games(session, profile, data.game_ids)


@router.get("/{user_id}", response_model=PublicProfile)
async def get_profile(user_id: str, _user: UserDep, session: SessionDep):
    profile = await repository.get_profile(session, user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile