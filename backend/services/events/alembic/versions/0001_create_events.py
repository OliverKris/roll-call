"""create events and rsvps"""

import sqlalchemy as sa
from geoalchemy2 import Geography

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("host_user_id", sa.String(64), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("game_id", sa.Integer, nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location_name", sa.String(200), nullable=False),
        sa.Column("latitude", sa.Float, nullable=False),
        sa.Column("longitude", sa.Float, nullable=False),
        sa.Column(
            "location",
            Geography(geometry_type="POINT", srid=4326, spatial_index=False),
            nullable=False,
        ),
        sa.Column("capacity", sa.Integer, nullable=False),
        sa.Column("seats_taken", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="scheduled"),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("capacity >= 1", name="ck_events_capacity_positive"),
        sa.CheckConstraint(
            "seats_taken >= 0 AND seats_taken <= capacity",
            name="ck_events_seats_within_capacity",
        ),
        sa.CheckConstraint("status IN ('scheduled', 'cancelled')", name="ck_events_status"),
    )
    op.create_index("ix_events_location", "events", ["location"], postgresql_using="gist")
    op.create_index("ix_events_starts_at", "events", ["starts_at"])

    op.create_table(
        "rsvps",
        sa.Column(
            "event_id",
            sa.Integer,
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("user_id", sa.String(64), primary_key=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column(
            "joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("status IN ('going', 'waitlisted')", name="ck_rsvps_status"),
    )
    op.create_index("ix_rsvps_event_status_joined", "rsvps", ["event_id", "status", "joined_at"])


def downgrade() -> None:
    op.drop_table("rsvps")
    op.drop_index("ix_events_starts_at", table_name="events")
    op.drop_index("ix_events_location", table_name="events")
    op.drop_table("events")
