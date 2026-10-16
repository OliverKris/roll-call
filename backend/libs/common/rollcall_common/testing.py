import base64
import json


def make_userinfo_header(sub: str = "user-123", **claims) -> str:
    """Build an X-Userinfo value exactly like APISIX does."""
    return base64.b64encode(json.dumps({"sub": sub, **claims}).encode()).decode()
