from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, PositiveInt, field_validator


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    display_name: str = Field(min_length=1, max_length=80)
    home_area: str | None = Field(default=None, max_length=120)
    bio: str | None = Field(default=None, max_length=500)

    @field_validator("home_area", "bio")
    @classmethod
    def blank_to_none(cls, v: str | None) -> str | None:
        return v or None


class ProfileGamesUpdate(BaseModel):
    game_ids: list[PositiveInt] = Field(max_length=50)

    @field_validator("game_ids")
    @classmethod
    def dedupe_keep_order(cls, v: list[int]) -> list[int]:
        return list(dict.fromkeys(v))


class PublicProfile(BaseModel):
    """What other users may see."""

    model_config = ConfigDict(from_attributes=True)

    user_id: str
    display_name: str
    home_area: str | None
    game_ids: list[int]


class MyProfile(PublicProfile):
    """What the owner sees."""

    bio: str | None
    created_at: datetime
    updated_at: datetime