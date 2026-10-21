"""Transactional outbox.

A service writes a message to its own `outbox` table in the same database
transaction as the change it describes, so the two can never disagree: if the
change rolls back, the message was never written. `OutboxRelay` then publishes
pending rows to Kafka and marks them as sent.

Delivery is at least once. If the relay crashes after Kafka accepts a message
but before the row is marked, the message is sent again, which is why every
consumer ignores message IDs it has already handled.
"""

import asyncio
import json
import logging
from typing import Protocol

from sqlalchemy import (
    Column,
    DateTime,
    Index,
    MetaData,
    String,
    Table,
    func,
    insert,
    select,
    text,
    update,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from rollcall_common.messages import Envelope

log = logging.getLogger(__name__)


def make_outbox_table(metadata: MetaData) -> Table:
    """The outbox table, attached to a service's own metadata."""
    return Table(
        "outbox",
        metadata,
        Column("id", PG_UUID(as_uuid=True), primary_key=True),
        Column("topic", String(200), nullable=False),
        Column("key", String(200), nullable=False),
        Column("envelope", JSONB, nullable=False),
        # clock_timestamp(), unlike now(), advances within a transaction, so two
        # messages written together keep the order they were written in
        Column(
            "created_at",
            DateTime(timezone=True),
            server_default=text("clock_timestamp()"),
            nullable=False,
        ),
        Column("published_at", DateTime(timezone=True), nullable=True),
        # Partial index: the relay only ever looks for unpublished rows
        Index("ix_outbox_unpublished", "created_at", postgresql_where=text("published_at IS NULL")),
    )


async def enqueue(
    session: AsyncSession, table: Table, *, topic: str, key: str, envelope: Envelope
) -> None:
    """Add a message to the outbox inside the caller's current transaction."""
    await session.execute(
        insert(table).values(
            id=envelope.id,
            topic=topic,
            key=key,
            envelope=envelope.model_dump(mode="json"),
        )
    )


class Publisher(Protocol):
    async def send(self, topic: str, key: str, value: bytes) -> None: ...


class KafkaPublisher:
    """Publishes to Kafka, waiting until the broker has stored each message."""

    def __init__(self, bootstrap_servers: str) -> None:
        self._bootstrap_servers = bootstrap_servers
        self._producer = None

    async def start(self) -> None:
        from aiokafka import AIOKafkaProducer

        self._producer = AIOKafkaProducer(
            bootstrap_servers=self._bootstrap_servers,
            acks="all",
            enable_idempotence=True,
        )
        await self._producer.start()

    async def stop(self) -> None:
        if self._producer is not None:
            await self._producer.stop()

    async def send(self, topic: str, key: str, value: bytes) -> None:
        if self._producer is None:
            raise RuntimeError("KafkaPublisher.start() was not called")
        await self._producer.send_and_wait(topic, value=value, key=key.encode())


class OutboxRelay:
    def __init__(
        self,
        sessionmaker: async_sessionmaker[AsyncSession],
        table: Table,
        publisher: Publisher,
        *,
        batch_size: int = 100,
        poll_interval: float = 0.5,
    ) -> None:
        self._sessionmaker = sessionmaker
        self._table = table
        self._publisher = publisher
        self._batch_size = batch_size
        self._poll_interval = poll_interval

    async def publish_pending(self) -> int:
        """Publish one batch of pending messages. Returns how many were sent."""
        t = self._table
        async with self._sessionmaker() as session, session.begin():
            # SKIP LOCKED lets several replicas relay at once without sending a row twice
            rows = (
                await session.execute(
                    select(t.c.id, t.c.topic, t.c.key, t.c.envelope)
                    .where(t.c.published_at.is_(None))
                    .order_by(t.c.created_at)
                    .limit(self._batch_size)
                    .with_for_update(skip_locked=True)
                )
            ).all()
            if not rows:
                return 0
            for row in rows:
                await self._publisher.send(row.topic, row.key, json.dumps(row.envelope).encode())
            await session.execute(
                update(t).where(t.c.id.in_([r.id for r in rows])).values(published_at=func.now())
            )
            return len(rows)

    async def run(self, stop: asyncio.Event) -> None:
        """Keep relaying until `stop` is set. Errors are logged and retried."""
        while not stop.is_set():
            try:
                sent = await self.publish_pending()
            except Exception:
                log.exception("outbox relay failed; retrying")
                sent = 0
            if sent == 0:
                try:
                    await asyncio.wait_for(stop.wait(), timeout=self._poll_interval)
                except TimeoutError:
                    pass


async def run_kafka_relay(
    sessionmaker: async_sessionmaker[AsyncSession],
    table: Table,
    bootstrap_servers: str,
    stop: asyncio.Event,
    *,
    retry_seconds: float = 3.0,
) -> None:
    """Connect to Kafka (waiting for it if needed), then relay until `stop` is set."""
    publisher = None
    while not stop.is_set():
        candidate = KafkaPublisher(bootstrap_servers)
        try:
            await candidate.start()
            publisher = candidate
            break
        except Exception:
            log.warning("Kafka not reachable yet; retrying in %ss", retry_seconds)
            await candidate.stop()
            try:
                await asyncio.wait_for(stop.wait(), timeout=retry_seconds)
            except TimeoutError:
                pass
    if publisher is None:
        return
    try:
        await OutboxRelay(sessionmaker, table, publisher).run(stop)
    finally:
        await publisher.stop()
