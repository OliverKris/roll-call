from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from rollcall_common.auth import CurrentUser, get_current_user
from sqlalchemy.ext.asyncio import AsyncSession

from app import catalog_client, repository
from app.catalog_client import CatalogUnavailableError, get_catalog_client
from app.db import get_session
from app.repository import (
    EventNotFoundError,
    EventNotJoinableError,
    HostCannotLeaveError,
    TooMuchContentionError,
)
from app.schemas.event import EventCreate, EventOut, NearbyEvent, RsvpOut

router = APIRouter(prefix="/events", tags=["events"])

UserDep = Annotated[CurrentUser, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]
CatalogDep = Annotated[httpx.AsyncClient, Depends(get_catalog_client)]

NOT_FOUND = HTTPException(status_code=404, detail="Event not found")
BUSY = HTTPException(status_code=409, detail="Event is busy right now; please retry")


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
async def create_event(data: EventCreate, user: UserDep, session: SessionDep, catalog: CatalogDep):
    try:
        missing = await catalog_client.find_missing_game_ids(catalog, [data.game_id])
    except CatalogUnavailableError:
        raise HTTPException(
            status_code=503, detail="Game catalog is unavailable; try again shortly"
        ) from None
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"message": "Game does not exist", "missing_game_ids": missing},
        )
    return await repository.create_event(session, user.sub, data)


@router.get("/nearby", response_model=list[NearbyEvent])
async def nearby_events(
    session: SessionDep,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lng: Annotated[float, Query(ge=-180, le=180)],
    radius_km: Annotated[float, Query(gt=0, le=100)] = 10.0,
):
    rows = await repository.find_nearby(session, lat=lat, lng=lng, radius_km=radius_km)
    return [
        NearbyEvent(
            **EventOut.model_validate(event).model_dump(),
            distance_km=round(distance_m / 1000, 2),
        )
        for event, distance_m in rows
    ]


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: int, session: SessionDep):
    event = await repository.get_event(session, event_id)
    if event is None:
        raise NOT_FOUND
    return event


@router.post("/{event_id}/rsvp", response_model=RsvpOut)
async def join_event(event_id: int, user: UserDep, session: SessionDep):
    try:
        return await repository.join_event(session, event_id, user.sub)
    except EventNotFoundError:
        raise NOT_FOUND from None
    except EventNotJoinableError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    except TooMuchContentionError:
        raise BUSY from None


@router.delete("/{event_id}/rsvp", status_code=status.HTTP_204_NO_CONTENT)
async def leave_event(event_id: int, user: UserDep, session: SessionDep):
    try:
        await repository.leave_event(session, event_id, user.sub)
    except EventNotFoundError:
        raise NOT_FOUND from None
    except HostCannotLeaveError:
        raise HTTPException(
            status_code=409, detail="The host can't leave their own event"
        ) from None
    except TooMuchContentionError:
        raise BUSY from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)
