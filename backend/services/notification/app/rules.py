"""Which people hear about an RSVP change, and what they're told.

Pure functions with no I/O, so every rule is easy to unit test.
"""

from dataclasses import dataclass

from rollcall_common.messages import Envelope, RsvpChange


@dataclass(frozen=True)
class NewNotification:
    user_id: str
    kind: str
    title: str
    body: str
    event_id: int


HANDLED_TYPES = {"rsvp.joined", "rsvp.promoted", "rsvp.left"}


def build_notifications(envelope: Envelope) -> list[NewNotification]:
    """Raises pydantic.ValidationError if the message data is malformed."""
    if envelope.type not in HANDLED_TYPES:
        return []
    change = RsvpChange.model_validate(envelope.data)

    def to(user_id: str, kind: str, body: str) -> NewNotification:
        return NewNotification(
            user_id=user_id,
            kind=kind,
            title=change.event_title,
            body=body,
            event_id=change.event_id,
        )

    # The host is seated automatically when they create the event; never tell them about themselves
    if change.user_id == change.host_user_id:
        return []

    name = change.user_name
    if envelope.type == "rsvp.joined":
        if change.status == "going":
            return [to(change.host_user_id, "seat_taken", f"{name} took a seat.")]
        return [to(change.host_user_id, "waitlist_joined", f"{name} joined the waitlist.")]

    if envelope.type == "rsvp.promoted":
        return [
            to(change.user_id, "seat_offered", "A seat opened up, so you're in. See you there."),
            to(
                change.host_user_id,
                "waitlist_promoted",
                f"{name} moved off the waitlist into a seat.",
            ),
        ]

    # rsvp.left: only a freed seat is worth telling the host about
    if change.status == "going":
        return [to(change.host_user_id, "seat_given_up", f"{name} gave up their seat.")]
    return []
