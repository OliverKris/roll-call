from pydantic import BaseModel, ConfigDict, Field, model_validator


class GameBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    min_players: int = Field(ge=1)
    max_players: int = Field(ge=1)
    play_time_minutes: int = Field(gt=0)

    @model_validator(mode="after")
    def check_player_range(self):
        if self.max_players < self.min_players:
            raise ValueError("max_players must be >= min_players")
        return self


class GameCreate(GameBase):
    pass


class Game(GameBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
