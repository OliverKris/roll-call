"""Identity forwarded by the API gateway.

APISIX verifies the Keycloak token and forwards the claims as base64-encoded
JSON in X-Userinfo. Services trust this header only because the gateway
strips it from public routes and overwrites it on protected ones.
"""

import base64
import binascii
import json
from typing import Annotated

from fastapi import Header, HTTPException, status
from pydantic import BaseModel, ValidationError

USERINFO_HEADER = "X-Userinfo"


class CurrentUser(BaseModel):
    sub: str
    email: str | None = None
    preferred_username: str | None = None
    name: str | None = None

    @property
    def display_name(self) -> str:
        """Best human-readable name from the token, for messages to other users."""
        if self.name:
            return self.name
        if self.preferred_username:
            return self.preferred_username
        if self.email:
            return self.email.split("@")[0]
        return "Someone"


def parse_userinfo(raw: str) -> CurrentUser:
    try:
        decoded = base64.b64decode(raw + "=" * (-len(raw) % 4))
        return CurrentUser.model_validate(json.loads(decoded))
    except (binascii.Error, UnicodeDecodeError, json.JSONDecodeError, ValidationError) as exc:
        raise ValueError("invalid X-Userinfo header") from exc


def get_current_user(
    x_userinfo: Annotated[str | None, Header(alias=USERINFO_HEADER)] = None,
) -> CurrentUser:
    """FastAPI dependency: the authenticated user, or 401."""
    if not x_userinfo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return parse_userinfo(x_userinfo)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid identity header",
        ) from None
