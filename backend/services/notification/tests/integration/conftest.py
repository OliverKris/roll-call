import os
import subprocess
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

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
    """A migrated Postgres: TEST_DATABASE_URL if set, otherwise a Testcontainers one."""
    url = os.getenv("TEST_DATABASE_URL")
    if url:
        migrate(url)
        yield url
        return
    from testcontainers.community.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine", driver="asyncpg") as pg:
        url = pg.get_connection_url()
        migrate(url)
        yield url


@pytest_asyncio.fixture
async def sessions(database_url):
    """Sessions that really commit, like the consumer's. Tables are emptied after each test."""
    engine = create_async_engine(database_url)
    yield async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE notifications, processed_messages"))
    await engine.dispose()
