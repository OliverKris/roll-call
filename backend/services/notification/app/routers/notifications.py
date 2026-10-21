import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from rollcall_common.auth import CurrentUser, get_current_user
from sqlalchemy.ext.asyncio import AsyncSession

from app import repository
from app.db import get_session
from app.schemas.notification import Inbox, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

UserDep = Annotated[CurrentUser, Depends(get_current_user)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.get("", response_model=Inbox)
async def my_inbox(
    user: UserDep, session: SessionDep, limit: Annotated[int, Query(ge=1, le=100)] = 50
):
    items = await repository.list_for_user(session, user.sub, limit=limit)
    count = await repository.unread_count(session, user.sub)
    return Inbox(items=[NotificationOut.model_validate(n) for n in items], unread_count=count)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def read_all(user: UserDep, session: SessionDep):
    await repository.mark_all_read(session, user.sub)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def read_one(notification_id: uuid.UUID, user: UserDep, session: SessionDep):
    if not await repository.mark_read(session, user.sub, notification_id):
        raise HTTPException(status_code=404, detail="Notification not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
