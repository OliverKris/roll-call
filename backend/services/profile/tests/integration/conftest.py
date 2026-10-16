import os
import subprocess
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from testcontainers.community.postgres import PostgresContainer

from app.db import get_session
from app.main import app

SERVICE_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def database_url():
    with PostgresContainer("postgres:16-alpine", driver="asyncpg") as pg:
        url = pg.get_connection_url()
        # Run the real migration in a subprocess, exactly as the container does
        subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=SERVICE_ROOT,
            env={**os.environ, "DATABASE_URL": url},
            check=True,
        )
        yield url


@pytest_asyncio.fixture
async def session(database_url):
    engine = create_async_engine(database_url)
    async with engine.connect() as conn:
        outer = await conn.begin()
        session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",  # commits become savepoints
        )
        try:
            yield session
        finally:
            await session.close()
            await outer.rollback()  # undo everything this test did
    await engine.dispose()


@pytest_asyncio.fixture
async def api(session):
    async def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
