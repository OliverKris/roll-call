import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: str
    title: str
    body: str
    event_id: int | None
    created_at: datetime
    read_at: datetime | None


class Inbox(BaseModel):
    items: list[NotificationOut]
    unread_count: int
