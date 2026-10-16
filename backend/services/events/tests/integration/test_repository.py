import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func
from sqlalchemy.orm.exc import StaleDataError

from app import models, repository
from app.repository import HostCannotLeaveError
from app.schemas.event import EventCreate

pytestmark = pytest.mark.integration

BROOKLYN = (40.6782, -73.9442)
MIDTOWN = (40.7580, -73.9855)  # about 9.5 km from BROOKLYN


def event_data(**overrides) -> EventCreate:
    data = {
        "title": "Catan night",
        "game_id": 1,
        "starts_at": datetime.now(UTC) + timedelta(days=7),
        "location_name": "Brooklyn Board Game Cafe",
        "latitude": BROOKLYN[0],
        "longitude": BROOKLYN[1],
        "capacity": 3,
    }
    data.update(overrides)
    return EventCreate(**data)


async def reload(session, event_id):
    return await session.get(models.Event, event_id, populate_existing=True)


# ---------- create and search ----------


async def test_create_seats_the_host(session):
    event = await repository.create_event(session, "host", event_data())

    assert (event.seats_taken, event.seats_left, event.version) == (1, 2, 1)
    host_rsvp = await session.get(models.Rsvp, (event.id, "host"))
    assert host_rsvp.status == "going"


async def test_nearby_respects_radius(session):
    await repository.create_event(session, "host", event_data())

    near = await repository.find_nearby(session, *MIDTOWN, radius_km=15)
    far = await repository.find_nearby(session, *MIDTOWN, radius_km=2)

    assert len(near) == 1
    assert 8 < near[0][1] / 1000 < 11  # distance in km
    assert far == []


async def test_nearby_excludes_past_events(session):
    event = await repository.create_event(session, "host", event_data())
    event.starts_at = datetime.now(UTC) - timedelta(days=1)
    await session.commit()

    assert await repository.find_nearby(session, *BROOKLYN, radius_km=5) == []


# ---------- seats and waitlist ----------


async def test_join_fills_seats_then_waitlists(session):
    event = await repository.create_event(session, "host", event_data(capacity=2))

    bob = await repository.join_event(session, event.id, "bob")
    carol = await repository.join_event(session, event.id, "carol")

    assert (bob.status, carol.status) == ("going", "waitlisted")
    assert (await reload(session, event.id)).seats_taken == 2


async def test_join_twice_is_a_no_op(session):
    event = await repository.create_event(session, "host", event_data())

    await repository.join_event(session, event.id, "bob")
    await repository.join_event(session, event.id, "bob")

    assert (await reload(session, event.id)).seats_taken == 2


async def test_leaving_promotes_first_in_line(session):
    event = await repository.create_event(session, "host", event_data(capacity=2))
    await repository.join_event(session, event.id, "bob")
    await repository.join_event(session, event.id, "carol")  # waitlisted first
    await repository.join_event(session, event.id, "dave")  # waitlisted second

    await repository.leave_event(session, event.id, "bob")

    carol = await session.get(models.Rsvp, (event.id, "carol"), populate_existing=True)
    dave = await session.get(models.Rsvp, (event.id, "dave"), populate_existing=True)
    assert (carol.status, dave.status) == ("going", "waitlisted")
    assert (await reload(session, event.id)).seats_taken == 2


async def test_leaving_without_waitlist_frees_a_seat(session):
    event = await repository.create_event(session, "host", event_data())
    await repository.join_event(session, event.id, "bob")

    await repository.leave_event(session, event.id, "bob")

    assert (await reload(session, event.id)).seats_taken == 1


async def test_host_cannot_leave(session):
    event = await repository.create_event(session, "host", event_data())
    with pytest.raises(HostCannotLeaveError):
        await repository.leave_event(session, event.id, "host")


# ---------- optimistic locking ----------


async def test_stale_write_is_rejected(committing_sessions):
    async with committing_sessions() as setup:
        event_id = (await repository.create_event(setup, "host", event_data())).id

    async with committing_sessions() as a, committing_sessions() as b:
        event_a = await a.get(models.Event, event_id)
        event_b = await b.get(models.Event, event_id)  # both read version 1

        event_a.seats_taken += 1
        event_a.updated_at = func.now()
        await a.commit()  # version 1 → 2

        event_b.seats_taken += 1
        event_b.updated_at = func.now()
        with pytest.raises(StaleDataError):
            await b.commit()  # still thinks it's version 1


async def test_two_people_racing_for_the_last_seat(committing_sessions):
    async with committing_sessions() as setup:
        event_id = (await repository.create_event(setup, "host", event_data(capacity=2))).id

    async def attempt(user_id: str) -> str:
        async with committing_sessions() as s:
            return (await repository.join_event(s, event_id, user_id)).status

    statuses = sorted(await asyncio.gather(attempt("bob"), attempt("carol")))

    assert statuses == ["going", "waitlisted"]
    async with committing_sessions() as check:
        assert (await reload(check, event_id)).seats_taken == 2
