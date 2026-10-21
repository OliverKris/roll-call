from datetime import datetime
from enum import StrEnum

from geoalchemy2 import Geography
from rollcall_common.outbox import make_outbox_table
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class EventStatus(StrEnum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"


class RsvpStatus(StrEnum):
    GOING = "going"
    WAITLISTED = "waitlisted"


class Base(DeclarativeBase):
    pass


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint("capacity >= 1", name="ck_events_capacity_positive"),
        CheckConstraint(
            "seats_taken >= 0 AND seats_taken <= capacity",
            name="ck_events_seats_within_capacity",
        ),
        CheckConstraint("status IN ('scheduled', 'cancelled')", name="ck_events_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    host_user_id: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    game_id: Mapped[int] = mapped_column(Integer)  # Catalog game; no FK across services
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    location_name: Mapped[str] = mapped_column(String(200))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    # Used only for spatial queries; deferred so normal loads never read it
    location: Mapped[object] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False), deferred=True
    )
    capacity: Mapped[int] = mapped_column(Integer)
    seats_taken: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default=EventStatus.SCHEDULED)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Optimistic locking: every UPDATE includes "WHERE version = <what I read>"
    # and increments it. If someone else updated first, zero rows match and
    # SQLAlchemy raises StaleDataError.
    __mapper_args__ = {"version_id_col": version}

    @property
    def seats_left(self) -> int:
        return self.capacity - self.seats_taken


class Rsvp(Base):
    __tablename__ = "rsvps"
    __table_args__ = (
        CheckConstraint("status IN ('going', 'waitlisted')", name="ck_rsvps_status"),
        Index("ix_rsvps_event_status_joined", "event_id", "status", "joined_at"),
    )

    event_id: Mapped[int] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # Name at the time of joining, so messages about this RSVP can say who it was
    user_name: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(16))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# Messages waiting to be published to Kafka, written in the same transaction as the change
outbox = make_outbox_table(Base.metadata)
