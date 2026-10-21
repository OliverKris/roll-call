import base64

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from rollcall_common.auth import CurrentUser, get_current_user, parse_userinfo
from rollcall_common.testing import make_userinfo_header

app = FastAPI()


@app.get("/whoami")
def whoami(user: CurrentUser = Depends(get_current_user)):
    return user


client = TestClient(app)


def test_valid_header_is_parsed_into_current_user():
    header = make_userinfo_header(sub="abc", email="a@example.com", name="Alice")
    user = parse_userinfo(header)
    assert user == CurrentUser(sub="abc", email="a@example.com", name="Alice")


def test_unknown_claims_are_ignored():
    user = parse_userinfo(make_userinfo_header(sub="abc", realm_access={"roles": ["x"]}))
    assert user.sub == "abc"


def test_missing_padding_is_tolerated():
    header = make_userinfo_header(sub="abc").rstrip("=")
    assert parse_userinfo(header).sub == "abc"


@pytest.mark.parametrize(
    "raw",
    [
        "not-base64!!!",
        base64.b64encode(b"not json").decode(),
        base64.b64encode(b'{"email": "no-sub@example.com"}').decode(),
        base64.b64encode(b'["a", "list"]').decode(),
    ],
)
def test_malformed_headers_are_rejected(raw):
    with pytest.raises(ValueError):
        parse_userinfo(raw)


def test_dependency_returns_401_without_header():
    r = client.get("/whoami")
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"


def test_dependency_returns_401_for_bad_header():
    r = client.get("/whoami", headers={"X-Userinfo": "garbage"})
    assert r.status_code == 401


def test_dependency_returns_user_for_good_header():
    r = client.get("/whoami", headers={"X-Userinfo": make_userinfo_header(sub="abc")})
    assert r.status_code == 200
    assert r.json()["sub"] == "abc"


@pytest.mark.parametrize(
    "claims, expected",
    [
        ({"name": "Alice Tester", "preferred_username": "alice"}, "Alice Tester"),
        ({"preferred_username": "alice"}, "alice"),
        ({"email": "bob@example.com"}, "bob"),
        ({}, "Someone"),
    ],
)
def test_display_name_falls_back_through_claims(claims, expected):
    assert CurrentUser(sub="abc", **claims).display_name == expected
