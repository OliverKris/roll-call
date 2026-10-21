"""Turning Kafka messages into notifications.

`handle_message` does the work in one database transaction: it records the
message ID and writes the notifications together, so a redelivered message
finds its ID already recorded and changes nothing.

`MessageProcessor` adds retries and the dead-letter topic. `run_consumer`
connects it to Kafka and commits offsets only after a message is handled.
"""

import asyncio
import logging
from typing import Literal

from pydantic import ValidationError
from rollcall_common.messages import RSVP_DEAD_LETTER_TOPIC, RSVP_TOPIC, Envelope
from rollcall_common.outbox import Publisher
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app import models
from app.rules import build_notifications

log = logging.getLogger(__name__)

Outcome = Literal["processed", "duplicate", "ignored"]


class PoisonMessageError(Exception):
    """A message that will never succeed, however often it's retried."""


async def handle_message(sessions: async_sessionmaker[AsyncSession], raw: bytes) -> Outcome:
    try:
        envelope = Envelope.model_validate_json(raw)
        notifications = build_notifications(envelope)
    except ValidationError as exc:
        raise PoisonMessageError(str(exc)) from exc

    async with sessions() as session, session.begin():
        recorded = await session.scalar(
            insert(models.ProcessedMessage)
            .values(message_id=envelope.id)
            .on_conflict_do_nothing()
            .returning(models.ProcessedMessage.message_id)
        )
        if recorded is None:
            return "duplicate"
        session.add_all(
            models.Notification(
                user_id=n.user_id,
                kind=n.kind,
                title=n.title,
                body=n.body,
                event_id=n.event_id,
                message_id=envelope.id,
            )
            for n in notifications
        )
    return "processed" if notifications else "ignored"


class MessageProcessor:
    def __init__(
        self,
        sessions: async_sessionmaker[AsyncSession],
        dead_letters: Publisher,
        *,
        attempts: int = 3,
        backoff_seconds: float = 0.5,
    ) -> None:
        self._sessions = sessions
        self._dead_letters = dead_letters
        self._attempts = attempts
        self._backoff = backoff_seconds

    async def process(self, raw: bytes, key: str = "") -> str:
        """Handle one message. Never raises: failures end up in the dead-letter topic."""
        for attempt in range(1, self._attempts + 1):
            try:
                return await handle_message(self._sessions, raw)
            except PoisonMessageError:
                log.warning("malformed message sent to dead-letter topic")
                break
            except Exception:
                log.exception("handling failed (attempt %d of %d)", attempt, self._attempts)
                if attempt < self._attempts:
                    await asyncio.sleep(self._backoff * 2 ** (attempt - 1))
        await self._dead_letters.send(RSVP_DEAD_LETTER_TOPIC, key, raw)
        return "dead_lettered"


async def run_consumer(
    sessions: async_sessionmaker[AsyncSession],
    bootstrap_servers: str,
    group_id: str,
    stop: asyncio.Event,
) -> None:
    from aiokafka import AIOKafkaConsumer
    from rollcall_common.outbox import KafkaPublisher

    # Kafka may still be starting; keep trying instead of crashing the service
    consumer = None
    dead_letters = None
    while not stop.is_set():
        candidate = AIOKafkaConsumer(
            RSVP_TOPIC,
            bootstrap_servers=bootstrap_servers,
            group_id=group_id,
            enable_auto_commit=False,
            auto_offset_reset="earliest",
        )
        publisher = KafkaPublisher(bootstrap_servers)
        try:
            await candidate.start()
            await publisher.start()
            consumer, dead_letters = candidate, publisher
            break
        except Exception:
            log.warning("Kafka not reachable yet; retrying in 3s")
            await candidate.stop()
            await publisher.stop()
            await asyncio.sleep(3)
    if consumer is None or dead_letters is None:
        return

    processor = MessageProcessor(sessions, dead_letters)
    try:
        while not stop.is_set():
            batches = await consumer.getmany(timeout_ms=1000)
            for messages in batches.values():
                for msg in messages:
                    key = msg.key.decode() if msg.key else ""
                    outcome = await processor.process(msg.value, key)
                    log.info("message at offset %d: %s", msg.offset, outcome)
            if batches:
                # Only now is it safe to tell Kafka these messages are done
                await consumer.commit()
    finally:
        await consumer.stop()
        await dead_letters.stop()
