import pytest
from pydantic import ValidationError
from rollcall_common.messages import Envelope

from app.rules import build_notifications
from tests.factories import rsvp_message


def summary(envelope):
    return [(n.user_id, n.kind, n.body) for n in build_notifications(envelope)]


def test_taking_a_seat_tells_the_host():
    assert summary(rsvp_message("rsvp.joined", status="going")) == [
        ("alice", "seat_taken", "Bob Tester took a seat."),
    ]


def test_joining_the_waitlist_tells_the_host():
    assert summary(rsvp_message("rsvp.joined", status="waitlisted")) == [
        ("alice", "waitlist_joined", "Bob Tester joined the waitlist."),
    ]


def test_promotion_tells_the_player_and_the_host():
    assert summary(rsvp_message("rsvp.promoted", user_id="carol", user_name="Carol")) == [
        ("carol", "seat_offered", "A seat opened up, so you're in. See you there."),
        ("alice", "waitlist_promoted", "Carol moved off the waitlist into a seat."),
    ]


def test_giving_up_a_seat_tells_the_host():
    assert summary(rsvp_message("rsvp.left", status="going")) == [
        ("alice", "seat_given_up", "Bob Tester gave up their seat."),
    ]


def test_leaving_the_waitlist_tells_nobody():
    assert summary(rsvp_message("rsvp.left", status="waitlisted")) == []


def test_host_is_never_notified_about_themselves():
    assert summary(rsvp_message("rsvp.joined", user_id="alice")) == []


def test_notification_title_is_the_event_and_links_to_it():
    (n,) = build_notifications(rsvp_message("rsvp.joined", event_id=42, event_title="Root night"))
    assert (n.title, n.event_id) == ("Root night", 42)


def test_unknown_message_types_are_ignored():
    assert build_notifications(Envelope(type="profile.updated", source="x", data={})) == []


def test_malformed_rsvp_data_raises():
    with pytest.raises(ValidationError):
        build_notifications(Envelope(type="rsvp.joined", source="x", data={"event_id": "oops"}))
