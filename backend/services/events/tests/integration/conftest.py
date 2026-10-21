import os
import subprocess
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import get_session
from app.main import app

SERVICE_ROOT = Path(__file__).resolve().parents[2]


def migrate(url: str) -> None:
    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=SERVICE_ROOT,
        env={**os.environ, "DATABASE_URL": url},
        check=True,
    )


@pytest.fixture(scope="session")
def database_url():
    """A migrated PostGIS database: TEST_DATABASE_URL if set, otherwise Testcontainers."""
    url = os.getenv("TEST_DATABASE_URL")
    if url:
        migrate(url)
        yield url
        return
    from testcontainers.community.postgres import PostgresContainer

    with PostgresContainer("postgis/postgis:16-3.4", driver="asyncpg") as pg:
        url = pg.get_connection_url()
        migrate(url)
        yield url


@pytest_asyncio.fixture
async def session(database_url):
    """One test's session; everything it does is rolled back afterwards."""
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
            await outer.rollback()
    await engine.dispose()


@pytest_asyncio.fixture
async def api(session):
    async def override_get_session():
        yield session

    app.dependency_overrides[get_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def committing_sessions(database_url):
    """Independent sessions that really commit, for race tests. Cleans up after."""
    engine = create_async_engine(database_url)
    yield async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE outbox, rsvps, events RESTART IDENTITY CASCADE"))
    await engine.dispose()
