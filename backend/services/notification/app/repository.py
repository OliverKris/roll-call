import uuid
from collections.abc import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


async def list_for_user(
    session: AsyncSession, user_id: str, limit: int = 50
) -> Sequence[models.Notification]:
    result = await session.scalars(
        select(models.Notification)
        .where(models.Notification.user_id == user_id)
        .order_by(models.Notification.created_at.desc(), models.Notification.id)
        .limit(limit)
    )
    return result.all()


async def unread_count(session: AsyncSession, user_id: str) -> int:
    count = await session.scalar(
        select(func.count())
        .select_from(models.Notification)
        .where(models.Notification.user_id == user_id, models.Notification.read_at.is_(None))
    )
    return count or 0


async def mark_read(session: AsyncSession, user_id: str, notification_id: uuid.UUID) -> bool:
    """Mark one notification read. False if it doesn't exist or isn't this user's."""
    result = await session.execute(
        update(models.Notification)
        .where(
            models.Notification.id == notification_id,
            models.Notification.user_id == user_id,
        )
        .values(read_at=func.coalesce(models.Notification.read_at, func.now()))
    )
    await session.commit()
    return result.rowcount > 0


async def mark_all_read(session: AsyncSession, user_id: str) -> None:
    await session.execute(
        update(models.Notification)
        .where(models.Notification.user_id == user_id, models.Notification.read_at.is_(None))
        .values(read_at=func.now())
    )
    await session.commit()
