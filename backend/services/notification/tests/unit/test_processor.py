from rollcall_common.messages import RSVP_DEAD_LETTER_TOPIC

from app import consumer
from app.consumer import MessageProcessor, PoisonMessageError


class FakeDeadLetters:
    def __init__(self):
        self.sent: list[tuple[str, str, bytes]] = []

    async def send(self, topic: str, key: str, value: bytes) -> None:
        self.sent.append((topic, key, value))


def stub_handler(monkeypatch, *results):
    """Make handle_message return or raise each result in turn."""
    calls = []

    async def fake(sessions, raw):
        calls.append(raw)
        result = results[min(len(calls), len(results)) - 1]
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(consumer, "handle_message", fake)
    return calls


async def test_success_is_returned_without_dead_lettering(monkeypatch):
    stub_handler(monkeypatch, "processed")
    dlt = FakeDeadLetters()

    outcome = await MessageProcessor(None, dlt, backoff_seconds=0).process(b"{}", "1")

    assert outcome == "processed"
    assert dlt.sent == []


async def test_transient_failure_is_retried_then_succeeds(monkeypatch):
    calls = stub_handler(monkeypatch, ConnectionError("db down"), "processed")
    dlt = FakeDeadLetters()

    outcome = await MessageProcessor(None, dlt, backoff_seconds=0).process(b"{}", "1")

    assert outcome == "processed"
    assert len(calls) == 2
    assert dlt.sent == []


async def test_repeated_failure_goes_to_dead_letter_topic(monkeypatch):
    calls = stub_handler(monkeypatch, ConnectionError("db down"))
    dlt = FakeDeadLetters()

    outcome = await MessageProcessor(None, dlt, attempts=3, backoff_seconds=0).process(b"raw", "7")

    assert outcome == "dead_lettered"
    assert len(calls) == 3
    assert dlt.sent == [(RSVP_DEAD_LETTER_TOPIC, "7", b"raw")]


async def test_malformed_message_is_dead_lettered_without_retrying(monkeypatch):
    calls = stub_handler(monkeypatch, PoisonMessageError("bad json"))
    dlt = FakeDeadLetters()

    outcome = await MessageProcessor(None, dlt, backoff_seconds=0).process(b"not json", "")

    assert outcome == "dead_lettered"
    assert len(calls) == 1
    assert len(dlt.sent) == 1
