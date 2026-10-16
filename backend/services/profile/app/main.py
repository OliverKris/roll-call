from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from sqlalchemy import text

from app.config import settings
from app.db import engine
from app.routers import profiles


@asynccontextmanager
async def lifespan(app: FastAPI):
    # One pooled HTTP client for the whole process, not one per request
    async with httpx.AsyncClient(
        base_url=settings.catalog_url, timeout=settings.catalog_timeout_seconds
    ) as client:
        app.state.catalog_client = client
        yield
    await engine.dispose()


app = FastAPI(title="Profile Service", lifespan=lifespan)
app.include_router(profiles.router)


@app.get("/health")
def health():
    return {"status": "healthy", "service": "profile"}


@app.get("/health/ready")
async def ready():
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok"}