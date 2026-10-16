"""create profiles and profile_games"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("user_id", sa.String(64), primary_key=True),
        sa.Column("display_name", sa.String(80), nullable=False),
        sa.Column("home_area", sa.String(120), nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_table(
        "profile_games",
        sa.Column(
            "user_id",
            sa.String(64),
            sa.ForeignKey("profiles.user_id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("game_id", sa.Integer, primary_key=True),
    )
    # Matching will ask "who owns game X?", so index game_id
    op.create_index("ix_profile_games_game_id", "profile_games", ["game_id"])


def downgrade() -> None:
    op.drop_index("ix_profile_games_game_id", table_name="profile_games")
    op.drop_table("profile_games")
    op.drop_table("profiles")
