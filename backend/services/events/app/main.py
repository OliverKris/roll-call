import asyncio
import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from rollcall_common.outbox import run_kafka_relay
from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal, engine
from app.models import outbox
from app.routers import events

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop = asyncio.Event()
    relay = None
    if settings.kafka_bootstrap_servers:
        # Publishes outbox rows to Kafka in the background
        relay = asyncio.create_task(
            run_kafka_relay(SessionLocal, outbox, settings.kafka_bootstrap_servers, stop)
        )
    # One pooled HTTP client for the whole process, not one per request
    async with httpx.AsyncClient(
        base_url=settings.catalog_url, timeout=settings.catalog_timeout_seconds
    ) as client:
        app.state.catalog_client = client
        yield
    stop.set()
    if relay is not None:
        await relay
    await engine.dispose()


app = FastAPI(title="Events Service", lifespan=lifespan)
app.include_router(events.router)


@app.get("/health")
def health():
    return {"status": "healthy", "service": "events"}


@app.get("/health/ready")
async def ready():
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok"}
