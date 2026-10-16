from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Profile(Base):
    __tablename__ = "profiles"

    # Keycloak's `sub` claim. Keycloak owns identity; this service owns the profile.
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(80))
    home_area: Mapped[str | None] = mapped_column(String(120))
    bio: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    games: Mapped[list["ProfileGame"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def game_ids(self) -> list[int]:
        return sorted(g.game_id for g in self.games)


class ProfileGame(Base):
    __tablename__ = "profile_games"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.user_id", ondelete="CASCADE"), primary_key=True
    )
    # Refers to a Catalog game. No foreign key: that table lives in another service's database.
    game_id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    profile: Mapped[Profile] = relationship(back_populates="games")
