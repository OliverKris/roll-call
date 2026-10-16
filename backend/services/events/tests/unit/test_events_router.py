from datetime import UTC, datetime, timedelta

from app import models, repository
from app.repository import (
    EventNotFoundError,
    EventNotJoinableError,
    HostCannotLeaveError,
    TooMuchContentionError,
)


def stub(monkeypatch, name, result=None, raises=None):
    """Replace a repository function; record the arguments it was called with."""
    calls = []

    async def fake(*args, **kwargs):
        calls.append((args, kwargs))
        if raises:
            raise raises
        return result

    monkeypatch.setattr(repository, name, fake)
    return calls


# ---------- create ----------


def test_create_requires_login(client, valid_payload):
    assert client.post("/events", json=valid_payload).status_code == 401


def test_create_sets_host_from_token(client, auth_headers, valid_payload, monkeypatch, make_event):
    calls = stub(monkeypatch, "create_event", result=make_event())

    r = client.post("/events", headers=auth_headers, json=valid_payload)

    assert r.status_code == 201
    assert calls[0][0][1] == "user-123"  # host_user_id came from X-Userinfo
    assert r.json()["seats_left"] == 3


def test_create_rejects_past_start_time(client, auth_headers, valid_payload):
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    r = client.post("/events", headers=auth_headers, json={**valid_payload, "starts_at": past})
    assert r.status_code == 422


def test_create_rejects_start_time_without_timezone(client, auth_headers, valid_payload):
    r = client.post(
        "/events", headers=auth_headers, json={**valid_payload, "starts_at": "2030-01-01T19:00"}
    )
    assert r.status_code == 422


def test_create_rejects_unknown_game(client, auth_headers, valid_payload, monkeypatch):
    calls = stub(monkeypatch, "create_event")

    r = client.post("/events", headers=auth_headers, json={**valid_payload, "game_id": 99})

    assert r.status_code == 422
    assert r.json()["detail"]["missing_game_ids"] == [99]
    assert calls == []


def test_create_returns_503_when_catalog_down(client, auth_headers, valid_payload, catalog_state):
    catalog_state["down"] = True
    assert client.post("/events", headers=auth_headers, json=valid_payload).status_code == 503


# ---------- nearby ----------


def test_nearby_is_public_and_reports_km(client, monkeypatch, make_event):
    stub(monkeypatch, "find_nearby", result=[(make_event(), 9432.7)])

    r = client.get("/events/nearby", params={"lat": 40.758, "lng": -73.9855})

    assert r.status_code == 200
    assert r.json()[0]["distance_km"] == 9.43


def test_nearby_validates_coordinates(client):
    r = client.get("/events/nearby", params={"lat": 91, "lng": 0})
    assert r.status_code == 422


def test_nearby_caps_radius(client):
    r = client.get("/events/nearby", params={"lat": 40, "lng": -73, "radius_km": 500})
    assert r.status_code == 422


# ---------- get ----------


def test_get_missing_event_returns_404(client, monkeypatch):
    stub(monkeypatch, "get_event", result=None)
    assert client.get("/events/42").status_code == 404


# ---------- rsvp ----------


def test_join_returns_rsvp_status(client, auth_headers, monkeypatch):
    rsvp = models.Rsvp(
        event_id=1, user_id="user-123", status="waitlisted", joined_at=datetime.now(UTC)
    )
    stub(monkeypatch, "join_event", result=rsvp)

    r = client.post("/events/1/rsvp", headers=auth_headers)

    assert r.status_code == 200
    assert r.json()["status"] == "waitlisted"


def test_join_requires_login(client):
    assert client.post("/events/1/rsvp").status_code == 401


def test_join_cancelled_event_returns_409(client, auth_headers, monkeypatch):
    stub(monkeypatch, "join_event", raises=EventNotJoinableError("Event is cancelled"))

    r = client.post("/events/1/rsvp", headers=auth_headers)

    assert r.status_code == 409
    assert r.json()["detail"] == "Event is cancelled"


def test_join_under_heavy_contention_returns_409_retry(client, auth_headers, monkeypatch):
    stub(monkeypatch, "join_event", raises=TooMuchContentionError(1))

    r = client.post("/events/1/rsvp", headers=auth_headers)

    assert r.status_code == 409
    assert "retry" in r.json()["detail"]


def test_join_missing_event_returns_404(client, auth_headers, monkeypatch):
    stub(monkeypatch, "join_event", raises=EventNotFoundError(1))
    assert client.post("/events/1/rsvp", headers=auth_headers).status_code == 404


def test_leave_returns_204(client, auth_headers, monkeypatch):
    stub(monkeypatch, "leave_event")

    r = client.delete("/events/1/rsvp", headers=auth_headers)

    assert r.status_code == 204
    assert r.content == b""


def test_host_cannot_leave(client, auth_headers, monkeypatch):
    stub(monkeypatch, "leave_event", raises=HostCannotLeaveError(1))
    assert client.delete("/events/1/rsvp", headers=auth_headers).status_code == 409
