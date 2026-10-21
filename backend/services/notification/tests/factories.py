from rollcall_common.messages import Envelope


def rsvp_message(type_: str, *, status: str = "going", user_id: str = "bob", **data) -> Envelope:
    payload = {
        "event_id": 1,
        "event_title": "Catan night",
        "host_user_id": "alice",
        "user_id": user_id,
        "user_name": "Bob Tester",
        "status": status,
    }
    payload.update(data)
    return Envelope(type=type_, source="events-service", data=payload)
