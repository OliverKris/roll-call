"""create games table"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    games = op.create_table(
        "games",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
        sa.Column("min_players", sa.Integer, nullable=False),
        sa.Column("max_players", sa.Integer, nullable=False),
        sa.Column("play_time_minutes", sa.Integer, nullable=False),
        sa.CheckConstraint(
            "min_players >= 1 AND max_players >= min_players",
            name="ck_games_player_range",
        ),
    )
    op.bulk_insert(
        games,
        [
            {"name": "Catan", "min_players": 3, "max_players": 4, "play_time_minutes": 90},
            {"name": "Ticket to Ride", "min_players": 2, "max_players": 5, "play_time_minutes": 60},
            {"name": "Azul", "min_players": 2, "max_players": 4, "play_time_minutes": 45},
        ],
    )


def downgrade() -> None:
    op.drop_table("games")
