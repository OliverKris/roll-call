import asyncio
import json

import pytest
import pytest_asyncio
from sqlalchemy import MetaData, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from rollcall_common.messages import Envelope
from rollcall_common.outbox import OutboxRelay, enqueue, make_outbox_table

metadata = MetaData()
outbox = make_outbox_table(metadata)


class FakePublisher:
    def __init__(self, fail_on: int | None = None):
        self.sent: list[tuple[str, str, dict]] = []
        self.fail_on = fail_on

    async def send(self, topic: str, key: str, value: bytes) -> None:
        if self.fail_on is not None and len(self.sent) == self.fail_on:
            raise ConnectionError("broker unavailable")
        self.sent.append((topic, key, json.loads(value)))


@pytest_asyncio.fixture
async def sessions(database_url):
    engine = create_async_engine(database_url)
    async with engine.begin() as conn:
        await conn.run_sync(metadata.drop_all)
        await conn.run_sync(metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(metadata.drop_all)
    await engine.dispose()


def message(n: int) -> Envelope:
    return Envelope(type="test.happened", source="tests", data={"n": n})


async def enqueue_committed(sessions, *envelopes: Envelope) -> None:
    async with sessions() as s, s.begin():
        for env in envelopes:
            await enqueue(s, outbox, topic="test.topic", key="k", envelope=env)


async def pending_count(sessions) -> int:
    async with sessions() as s:
        return await s.scalar(
            select(func.count()).select_from(outbox).where(outbox.c.published_at.is_(None))
        )


async def test_relay_publishes_in_order_and_marks_rows_sent(sessions):
    await enqueue_committed(sessions, message(1), message(2), message(3))
    pub = FakePublisher()

    sent = await OutboxRelay(sessions, outbox, pub).publish_pending()

    assert sent == 3
    assert [m["data"]["n"] for _, _, m in pub.sent] == [1, 2, 3]
    assert await pending_count(sessions) == 0


async def test_published_envelope_round_trips(sessions):
    env = message(7)
    await enqueue_committed(sessions, env)
    pub = FakePublisher()

    await OutboxRelay(sessions, outbox, pub).publish_pending()

    topic, key, body = pub.sent[0]
    assert (topic, key) == ("test.topic", "k")
    assert Envelope.model_validate(body) == env


async def test_rolled_back_transaction_leaves_no_message(sessions):
    with pytest.raises(RuntimeError):
        async with sessions() as s, s.begin():
            await enqueue(s, outbox, topic="test.topic", key="k", envelope=message(1))
            raise RuntimeError("the business change failed")

    assert await pending_count(sessions) == 0


async def test_failed_publish_keeps_rows_pending_for_retry(sessions):
    await enqueue_committed(sessions, message(1), message(2))

    with pytest.raises(ConnectionError):
        await OutboxRelay(sessions, outbox, FakePublisher(fail_on=1)).publish_pending()
    assert await pending_count(sessions) == 2  # nothing marked sent

    retry = FakePublisher()
    assert await OutboxRelay(sessions, outbox, retry).publish_pending() == 2
    assert await pending_count(sessions) == 0


async def test_two_relays_never_send_the_same_row(sessions):
    await enqueue_committed(sessions, *[message(n) for n in range(40)])
    pub_a, pub_b = FakePublisher(), FakePublisher()
    relay_a = OutboxRelay(sessions, outbox, pub_a, batch_size=10)
    relay_b = OutboxRelay(sessions, outbox, pub_b, batch_size=10)

    async def drain(relay):
        while await relay.publish_pending():
            await asyncio.sleep(0)

    await asyncio.gather(drain(relay_a), drain(relay_b))

    ids_a = {m["id"] for _, _, m in pub_a.sent}
    ids_b = {m["id"] for _, _, m in pub_b.sent}
    assert len(ids_a) + len(ids_b) == 40
    assert ids_a.isdisjoint(ids_b)


async def test_run_loop_stops_when_asked(sessions):
    await enqueue_committed(sessions, message(1))
    pub = FakePublisher()
    stop = asyncio.Event()
    relay = OutboxRelay(sessions, outbox, pub, poll_interval=0.05)

    task = asyncio.create_task(relay.run(stop))
    await asyncio.sleep(0.2)
    stop.set()
    await asyncio.wait_for(task, timeout=2)

    assert len(pub.sent) == 1


async def test_messages_from_one_transaction_keep_their_order(sessions):
    async with sessions() as s, s.begin():
        for n in range(5):
            await enqueue(s, outbox, topic="test.topic", key="k", envelope=message(n))
    pub = FakePublisher()

    await OutboxRelay(sessions, outbox, pub).publish_pending()

    assert [m["data"]["n"] for _, _, m in pub.sent] == [0, 1, 2, 3, 4]


async def test_kafka_relay_gives_up_cleanly_when_stopped_before_connecting(sessions):
    from rollcall_common.outbox import run_kafka_relay

    stop = asyncio.Event()
    task = asyncio.create_task(
        run_kafka_relay(sessions, outbox, "127.0.0.1:1", stop, retry_seconds=0.1)
    )
    await asyncio.sleep(0.3)
    stop.set()
    await asyncio.wait_for(task, timeout=5)
