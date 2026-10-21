from datetime import UTC, datetime

from rollcall_common.testing import make_userinfo_header

from app import models, repository


def stub(monkeypatch, name, result=None):
    calls = []

    async def fake(*args, **kwargs):
        calls.append((args, kwargs))
        return result

    monkeypatch.setattr(repository, name, fake)
    return calls


def test_join_passes_the_players_name_from_their_token(client, auth_headers, monkeypatch):
    rsvp = models.Rsvp(event_id=1, user_id="user-123", status="going", joined_at=datetime.now(UTC))
    calls = stub(monkeypatch, "join_event", result=rsvp)

    client.post("/events/1/rsvp", headers=auth_headers)

    args, _ = calls[0]
    assert args[1:] == (1, "user-123", "Alice Tester")


def test_leave_passes_the_players_name_from_their_token(client, auth_headers, monkeypatch):
    calls = stub(monkeypatch, "leave_event")

    client.delete("/events/1/rsvp", headers=auth_headers)

    args, _ = calls[0]
    assert args[1:] == (1, "user-123", "Alice Tester")


def test_name_falls_back_to_username_when_token_has_no_full_name(client, monkeypatch):
    rsvp = models.Rsvp(event_id=1, user_id="u", status="going", joined_at=datetime.now(UTC))
    calls = stub(monkeypatch, "join_event", result=rsvp)

    client.post(
        "/events/1/rsvp",
        headers={"X-Userinfo": make_userinfo_header(sub="u", preferred_username="bob")},
    )

    args, _ = calls[0]
    assert args[3] == "bob"


def test_create_passes_the_hosts_name(client, auth_headers, monkeypatch, make_event):
    calls = stub(monkeypatch, "create_event", result=make_event())
    payload = {
        "title": "Catan night",
        "game_id": 1,
        "starts_at": "2030-01-01T19:00:00Z",
        "location_name": "Cafe",
        "latitude": 40.6,
        "longitude": -73.9,
        "capacity": 4,
    }

    client.post("/events", headers=auth_headers, json=payload)

    _, kwargs = calls[0]
    assert kwargs["host_name"] == "Alice Tester"
