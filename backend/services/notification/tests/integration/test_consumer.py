import asyncio

import pytest
from sqlalchemy import func, select

from app import models, repository
from app.consumer import PoisonMessageError, handle_message
from tests.factories import rsvp_message

pytestmark = pytest.mark.integration


def raw(envelope) -> bytes:
    return envelope.model_dump_json().encode()


async def count(sessions, model) -> int:
    async with sessions() as s:
        return await s.scalar(select(func.count()).select_from(model))


async def test_message_creates_notification_for_the_host(sessions):
    assert await handle_message(sessions, raw(rsvp_message("rsvp.joined"))) == "processed"

    async with sessions() as s:
        (n,) = await repository.list_for_user(s, "alice")
    assert (n.title, n.body, n.event_id, n.read_at) == (
        "Catan night",
        "Bob Tester took a seat.",
        1,
        None,
    )


async def test_redelivered_message_is_ignored(sessions):
    message = raw(rsvp_message("rsvp.promoted", user_id="carol", user_name="Carol"))

    first = await handle_message(sessions, message)
    second = await handle_message(sessions, message)

    assert (first, second) == ("processed", "duplicate")
    assert await count(sessions, models.Notification) == 2  # Carol and the host, once each


async def test_simultaneous_redeliveries_produce_one_set_of_notifications(sessions):
    message = raw(rsvp_message("rsvp.joined"))

    outcomes = await asyncio.gather(*(handle_message(sessions, message) for _ in range(5)))

    assert sorted(outcomes) == ["duplicate"] * 4 + ["processed"]
    assert await count(sessions, models.Notification) == 1


async def test_message_with_nobody_to_notify_is_still_recorded(sessions):
    message = raw(rsvp_message("rsvp.left", status="waitlisted"))

    assert await handle_message(sessions, message) == "ignored"
    assert await handle_message(sessions, message) == "duplicate"
    assert await count(sessions, models.Notification) == 0


async def test_malformed_message_writes_nothing(sessions):
    with pytest.raises(PoisonMessageError):
        await handle_message(sessions, b'{"not": "an envelope"}')

    assert await count(sessions, models.ProcessedMessage) == 0


async def test_unread_count_and_mark_read(sessions):
    await handle_message(sessions, raw(rsvp_message("rsvp.joined", user_id="bob")))
    await handle_message(sessions, raw(rsvp_message("rsvp.joined", user_id="dave")))

    async with sessions() as s:
        assert await repository.unread_count(s, "alice") == 2
        newest, _ = await repository.list_for_user(s, "alice")
        assert await repository.mark_read(s, "alice", newest.id) is True
        assert await repository.unread_count(s, "alice") == 1
        await repository.mark_all_read(s, "alice")
        assert await repository.unread_count(s, "alice") == 0


async def test_users_cannot_mark_each_others_notifications(sessions):
    await handle_message(sessions, raw(rsvp_message("rsvp.joined")))

    async with sessions() as s:
        (n,) = await repository.list_for_user(s, "alice")
        assert await repository.mark_read(s, "mallory", n.id) is False
        assert await repository.unread_count(s, "alice") == 1
