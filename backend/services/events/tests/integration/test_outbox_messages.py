"""Every seat change writes exactly the right outbox messages, in the same transaction."""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from rollcall_common.messages import RSVP_TOPIC
from sqlalchemy import select

from app import models, repository
from app.schemas.event import EventCreate

pytestmark = pytest.mark.integration


def event_data(**overrides) -> EventCreate:
    data = {
        "title": "Catan night",
        "game_id": 1,
        "starts_at": datetime.now(UTC) + timedelta(days=7),
        "location_name": "Brooklyn Board Game Cafe",
        "latitude": 40.6782,
        "longitude": -73.9442,
        "capacity": 2,
    }
    data.update(overrides)
    return EventCreate(**data)


async def messages(session) -> list[tuple[str, str, str]]:
    """(type, user_id, status) of every outbox message, oldest first."""
    rows = await session.execute(
        select(models.outbox.c.topic, models.outbox.c.key, models.outbox.c.envelope).order_by(
            models.outbox.c.created_at
        )
    )
    out = []
    for topic, key, env in rows.all():
        assert topic == RSVP_TOPIC
        assert key == str(env["data"]["event_id"])  # keyed by event, so one event stays in order
        out.append((env["type"], env["data"]["user_id"], env["data"]["status"]))
    return out


async def test_creating_an_event_sends_no_message(session):
    await repository.create_event(session, "alice", event_data(), host_name="Alice")
    assert await messages(session) == []


async def test_joining_sends_a_joined_message_with_names(session):
    event = await repository.create_event(session, "alice", event_data(), host_name="Alice")

    await repository.join_event(session, event.id, "bob", "Bob Tester")

    (row,) = (await session.execute(select(models.outbox.c.envelope))).scalars().all()
    assert row["type"] == "rsvp.joined"
    assert row["source"] == "events-service"
    assert row["data"] == {
        "event_id": event.id,
        "event_title": "Catan night",
        "host_user_id": "alice",
        "user_id": "bob",
        "user_name": "Bob Tester",
        "status": "going",
    }


async def test_joining_a_full_table_says_waitlisted(session):
    event = await repository.create_event(session, "alice", event_data(capacity=2))
    await repository.join_event(session, event.id, "bob", "Bob")
    await repository.join_event(session, event.id, "carol", "Carol")

    assert await messages(session) == [
        ("rsvp.joined", "bob", "going"),
        ("rsvp.joined", "carol", "waitlisted"),
    ]


async def test_joining_twice_sends_one_message(session):
    event = await repository.create_event(session, "alice", event_data())
    await repository.join_event(session, event.id, "bob", "Bob")
    await repository.join_event(session, event.id, "bob", "Bob")

    assert await messages(session) == [("rsvp.joined", "bob", "going")]


async def test_leaving_promotes_and_announces_both_in_order(session):
    event = await repository.create_event(session, "alice", event_data(capacity=2))
    await repository.join_event(session, event.id, "bob", "Bob")
    await repository.join_event(session, event.id, "carol", "Carol")

    await repository.leave_event(session, event.id, "bob", "Bob")

    assert (await messages(session))[2:] == [
        ("rsvp.left", "bob", "going"),
        ("rsvp.promoted", "carol", "going"),
    ]
    newest_first = select(models.outbox.c.envelope).order_by(models.outbox.c.created_at.desc())
    promoted = (await session.execute(newest_first)).scalars().first()
    assert promoted["data"]["user_name"] == "Carol"  # remembered from when she joined


async def test_leaving_the_waitlist_promotes_nobody(session):
    event = await repository.create_event(session, "alice", event_data(capacity=2))
    await repository.join_event(session, event.id, "bob", "Bob")
    await repository.join_event(session, event.id, "carol", "Carol")

    await repository.leave_event(session, event.id, "carol", "Carol")

    assert (await messages(session))[2:] == [("rsvp.left", "carol", "waitlisted")]


async def test_racing_for_the_last_seat_sends_exactly_one_message_each(committing_sessions):
    async with committing_sessions() as setup:
        event_id = (await repository.create_event(setup, "alice", event_data(capacity=2))).id

    async def attempt(user_id: str) -> str:
        async with committing_sessions() as s:
            return (await repository.join_event(s, event_id, user_id, user_id.title())).status

    await asyncio.gather(attempt("bob"), attempt("carol"))

    async with committing_sessions() as check:
        sent = sorted(await messages(check))
    # The loser of the race retried; its rolled-back first attempt left no message behind
    assert sorted(status for _, _, status in sent) == ["going", "waitlisted"]
    assert sorted(user for _, user, _ in sent) == ["bob", "carol"]
