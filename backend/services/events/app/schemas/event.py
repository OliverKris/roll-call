from datetime import UTC, datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, PositiveInt, field_validator


class EventCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    game_id: PositiveInt
    starts_at: AwareDatetime
    location_name: str = Field(min_length=1, max_length=200)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    capacity: int = Field(ge=2, le=20)

    @field_validator("starts_at")
    @classmethod
    def must_be_in_future(cls, v: datetime) -> datetime:
        if v <= datetime.now(UTC):
            raise ValueError("starts_at must be in the future")
        return v

    @field_validator("description")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        return v or None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    host_user_id: str
    title: str
    description: str | None
    game_id: int
    starts_at: datetime
    location_name: str
    latitude: float
    longitude: float
    capacity: int
    seats_taken: int
    seats_left: int
    status: str
    created_at: datetime


class NearbyEvent(EventOut):
    distance_km: float


class RsvpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_id: int
    user_id: str
    status: str
    joined_at: datetime


class MyEvent(EventOut):
    my_status: str
