import asyncio

import httpx
from fastapi import Request


class CatalogUnavailableError(Exception):
    """Catalog could not give a definite answer."""


async def find_missing_game_ids(client: httpx.AsyncClient, game_ids: list[int]) -> list[int]:
    """Return the IDs Catalog says do not exist. Raises if Catalog can't answer."""

    async def exists(game_id: int) -> bool:
        try:
            r = await client.get(f"/games/{game_id}")
        except httpx.HTTPError as exc:
            raise CatalogUnavailableError(str(exc)) from exc
        if r.status_code == 200:
            return True
        if r.status_code == 404:
            return False
        raise CatalogUnavailableError(f"unexpected status {r.status_code} for game {game_id}")

    results = await asyncio.gather(*(exists(g) for g in game_ids))
    return [g for g, ok in zip(game_ids, results) if not ok]


def get_catalog_client(request: Request) -> httpx.AsyncClient:
    """FastAPI dependency: the shared HTTP client created at startup."""
    return request.app.state.catalog_client
