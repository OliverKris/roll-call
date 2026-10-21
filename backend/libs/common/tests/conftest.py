import os

import pytest


@pytest.fixture(scope="session")
def database_url():
    """A real Postgres: TEST_DATABASE_URL if set, otherwise a Testcontainers one."""
    url = os.getenv("TEST_DATABASE_URL")
    if url:
        yield url
        return
    from testcontainers.community.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine", driver="asyncpg") as pg:
        yield pg.get_connection_url()
