import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from rollcall_common.testing import make_userinfo_header

from app import models, repository
from app.db import get_session
from app.main import app


@pytest.fixture
def client():
    async def override_session():
        yield object()  # repository functions are stubbed

    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth():
    return {"X-Userinfo": make_userinfo_header(sub="alice")}


def stub(monkeypatch, name, result=None):
    calls = []

    async def fake(*args, **kwargs):
        calls.append(args)
        return result

    monkeypatch.setattr(repository, name, fake)
    return calls


def notification(**overrides) -> models.Notification:
    data = {
        "id": uuid.uuid4(),
        "user_id": "alice",
        "kind": "seat_taken",
        "title": "Catan night",
        "body": "Bob Tester took a seat.",
        "event_id": 1,
        "message_id": uuid.uuid4(),
        "created_at": datetime(2026, 10, 20, 19, tzinfo=UTC),
        "read_at": None,
    }
    data.update(overrides)
    return models.Notification(**data)


def test_inbox_requires_login(client):
    assert client.get("/notifications").status_code == 401


def test_inbox_returns_items_and_unread_count(client, auth, monkeypatch):
    calls = stub(monkeypatch, "list_for_user", [notification()])
    stub(monkeypatch, "unread_count", 1)

    r = client.get("/notifications", headers=auth)

    assert r.status_code == 200
    body = r.json()
    assert body["unread_count"] == 1
    assert body["items"][0]["body"] == "Bob Tester took a seat."
    assert calls[0][1] == "alice"  # only ever the signed-in user's inbox


def test_inbox_response_hides_internal_fields(client, auth, monkeypatch):
    stub(monkeypatch, "list_for_user", [notification()])
    stub(monkeypatch, "unread_count", 0)

    item = client.get("/notifications", headers=auth).json()["items"][0]

    assert set(item) == {"id", "kind", "title", "body", "event_id", "created_at", "read_at"}


def test_inbox_limit_is_capped(client, auth):
    assert client.get("/notifications?limit=500", headers=auth).status_code == 422


def test_mark_read_returns_204(client, auth, monkeypatch):
    stub(monkeypatch, "mark_read", True)
    r = client.post(f"/notifications/{uuid.uuid4()}/read", headers=auth)
    assert r.status_code == 204


def test_mark_someone_elses_notification_returns_404(client, auth, monkeypatch):
    stub(monkeypatch, "mark_read", False)
    r = client.post(f"/notifications/{uuid.uuid4()}/read", headers=auth)
    assert r.status_code == 404


def test_mark_read_rejects_a_non_uuid(client, auth):
    assert client.post("/notifications/abc/read", headers=auth).status_code == 422


def test_read_all_returns_204(client, auth, monkeypatch):
    stub(monkeypatch, "mark_all_read")
    assert client.post("/notifications/read-all", headers=auth).status_code == 204
