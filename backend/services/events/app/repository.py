from collections.abc import Sequence
from datetime import UTC, datetime

from geoalchemy2 import Geography, WKTElement
from sqlalchemy import cast, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.exc import StaleDataError

from app import models
from app.models import EventStatus, RsvpStatus
from app.schemas.event import EventCreate

MAX_ATTEMPTS = 3


class EventNotFoundError(Exception):
    pass


class EventNotJoinableError(Exception):
    pass


class HostCannotLeaveError(Exception):
    pass


class TooMuchContentionError(Exception):
    """Lost the optimistic-lock race MAX_ATTEMPTS times in a row."""


def _touch(event: models.Event) -> None:
    """Mark the event changed so its UPDATE carries the version check, even
    when seat counts don't move (e.g. a waitlist join or a promotion)."""
    event.updated_at = func.now()


async def create_event(session: AsyncSession, host_user_id: str, data: EventCreate) -> models.Event:
    event = models.Event(
        host_user_id=host_user_id,
        **data.model_dump(),
        location=WKTElement(f"POINT({data.longitude} {data.latitude})", srid=4326),
        seats_taken=1,  # the host takes the first seat
        status=EventStatus.SCHEDULED,
    )
    session.add(event)
    await session.flush()
    session.add(models.Rsvp(event_id=event.id, user_id=host_user_id, status=RsvpStatus.GOING))
    await session.commit()
    await session.refresh(event)
    return event


async def get_event(session: AsyncSession, event_id: int) -> models.Event | None:
    return await session.get(models.Event, event_id)


async def find_nearby(
    session: AsyncSession, lat: float, lng: float, radius_km: float
) -> Sequence[tuple[models.Event, float]]:
    point = cast(func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), Geography)
    distance_m = func.ST_Distance(models.Event.location, point)
    stmt = (
        select(models.Event, distance_m.label("distance_m"))
        .where(
            func.ST_DWithin(models.Event.location, point, radius_km * 1000),
            models.Event.status == EventStatus.SCHEDULED,
            models.Event.starts_at >= func.now(),
        )
        .order_by(models.Event.starts_at)
        .limit(50)
    )
    result = await session.execute(stmt)
    return [(event, dist) for event, dist in result.all()]


async def join_event(session: AsyncSession, event_id: int, user_id: str) -> models.Rsvp:
    for _ in range(MAX_ATTEMPTS):
        event = await session.get(models.Event, event_id, populate_existing=True)
        if event is None:
            raise EventNotFoundError(event_id)
        if event.status != EventStatus.SCHEDULED:
            raise EventNotJoinableError("Event is cancelled")
        if event.starts_at <= datetime.now(UTC):
            raise EventNotJoinableError("Event has already started")

        existing = await session.get(models.Rsvp, (event_id, user_id), populate_existing=True)
        if existing is not None:
            return existing  # joining twice is a no-op

        if event.seats_taken < event.capacity:
            event.seats_taken += 1
            rsvp_status = RsvpStatus.GOING
        else:
            rsvp_status = RsvpStatus.WAITLISTED
        _touch(event)

        rsvp = models.Rsvp(event_id=event_id, user_id=user_id, status=rsvp_status)
        session.add(rsvp)
        try:
            await session.commit()
        except (StaleDataError, IntegrityError):
            # Someone changed the event (or this user double-submitted) between
            # our read and our write. Start over from fresh data.
            await session.rollback()
            continue
        await session.refresh(rsvp)
        return rsvp

    raise TooMuchContentionError(event_id)


async def leave_event(session: AsyncSession, event_id: int, user_id: str) -> None:
    for _ in range(MAX_ATTEMPTS):
        event = await session.get(models.Event, event_id, populate_existing=True)
        if event is None:
            raise EventNotFoundError(event_id)
        if user_id == event.host_user_id:
            raise HostCannotLeaveError(event_id)

        rsvp = await session.get(models.Rsvp, (event_id, user_id), populate_existing=True)
        if rsvp is None:
            return  # leaving twice is a no-op

        was_going = rsvp.status == RsvpStatus.GOING
        await session.delete(rsvp)

        if was_going:
            next_in_line = await session.scalar(
                select(models.Rsvp)
                .where(
                    models.Rsvp.event_id == event_id,
                    models.Rsvp.status == RsvpStatus.WAITLISTED,
                )
                .order_by(models.Rsvp.joined_at, models.Rsvp.user_id)
                .limit(1)
            )
            if next_in_line is not None:
                next_in_line.status = RsvpStatus.GOING  # seat passes on; count unchanged
            else:
                event.seats_taken -= 1
        _touch(event)

        try:
            await session.commit()
            return
        except StaleDataError:
            await session.rollback()

    raise TooMuchContentionError(event_id)
