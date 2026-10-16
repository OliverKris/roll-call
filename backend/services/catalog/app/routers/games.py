from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import repository
from app.db import get_session
from app.schemas.game import Game, GameCreate

router = APIRouter(prefix="/games", tags=["games"])


@router.get("", response_model=list[Game])
async def list_games(
    q: str | None = None,
    players: int | None = None,
    session: AsyncSession = Depends(get_session),
):
    return await repository.list_games(session, q=q, players=players)


@router.get("/{game_id}", response_model=Game)
async def get_game(game_id: int, session: AsyncSession = Depends(get_session)):
    game = await repository.get_game(session, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return game


@router.post("", response_model=Game, status_code=status.HTTP_201_CREATED)
async def create_game(data: GameCreate, session: AsyncSession = Depends(get_session)):
    try:
        return await repository.create_game(session, data)
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="A game with that name already exists")
