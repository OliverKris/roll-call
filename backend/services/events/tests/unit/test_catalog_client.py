import httpx
import pytest

from app.catalog_client import CatalogUnavailableError, find_missing_game_ids


def client_with(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://catalog")


async def test_returns_only_missing_ids():
    def handler(request):
        return httpx.Response(200 if request.url.path == "/games/1" else 404)

    async with client_with(handler) as c:
        assert await find_missing_game_ids(c, [1, 2, 3]) == [2, 3]


async def test_empty_list_makes_no_calls():
    calls = 0

    def handler(request):
        nonlocal calls
        calls += 1
        return httpx.Response(200)

    async with client_with(handler) as c:
        assert await find_missing_game_ids(c, []) == []
    assert calls == 0


async def test_server_error_is_treated_as_unavailable():
    async with client_with(lambda r: httpx.Response(500)) as c:
        with pytest.raises(CatalogUnavailableError):
            await find_missing_game_ids(c, [1])


async def test_connection_error_is_treated_as_unavailable():
    def handler(request):
        raise httpx.ConnectError("refused", request=request)

    async with client_with(handler) as c:
        with pytest.raises(CatalogUnavailableError):
            await find_missing_game_ids(c, [1])
