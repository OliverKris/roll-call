"""Messages services exchange over Kafka.

Every message is wrapped in the same envelope. `id` is unique per message and
is what consumers use to ignore a message they have already handled, since
Kafka delivers at least once.
"""

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

# One topic per kind of entity. Messages are keyed by event ID, so every change
# to one game night lands on the same partition and is read in order.
RSVP_TOPIC = "rollcall.rsvp"
RSVP_DEAD_LETTER_TOPIC = "rollcall.rsvp.dead-letter"

RsvpMessageType = Literal["rsvp.joined", "rsvp.promoted", "rsvp.left"]


class Envelope(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    type: str
    source: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    data: dict[str, Any]


class RsvpChange(BaseModel):
    """The `data` of every rsvp.* message."""

    event_id: int
    event_title: str
    host_user_id: str
    user_id: str
    user_name: str
    status: Literal["going", "waitlisted"]
