from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        CheckConstraint(
            "min_players >= 1 AND max_players >= min_players",
            name="ck_games_player_range",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    min_players: Mapped[int]
    max_players: Mapped[int]
    play_time_minutes: Mapped[int]
