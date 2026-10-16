from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.schemas.game import GameCreate


async def list_games(
    session: AsyncSession, q: str | None = None, players: int | None = None
) -> Sequence[models.Game]:
    stmt = select(models.Game).order_by(models.Game.name)
    if q:
        stmt = stmt.where(models.Game.name.ilike(f"%{q}%"))
    if players:
        stmt = stmt.where(
            models.Game.min_players <= players,
            models.Game.max_players >= players,
        )
    result = await session.scalars(stmt)
    return result.all()


async def get_game(session: AsyncSession, game_id: int) -> models.Game | None:
    return await session.get(models.Game, game_id)


async def create_game(session: AsyncSession, data: GameCreate) -> models.Game:
    game = models.Game(**data.model_dump())
    session.add(game)
    await session.commit()
    await session.refresh(game)
    return game
