import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import text

from app.config import settings
from app.consumer import run_consumer
from app.db import SessionLocal, engine
from app.routers import notifications

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # The Kafka consumer runs alongside the API in the same process.
    # In Kubernetes it could become its own deployment without code changes.
    stop = asyncio.Event()
    task = None
    if settings.kafka_bootstrap_servers:
        task = asyncio.create_task(
            run_consumer(
                SessionLocal, settings.kafka_bootstrap_servers, settings.kafka_group_id, stop
            )
        )
    yield
    stop.set()
    if task is not None:
        await task
    await engine.dispose()


app = FastAPI(title="Notification Service", lifespan=lifespan)
app.include_router(notifications.router)


@app.get("/health")
def health():
    return {"status": "healthy", "service": "notification"}


@app.get("/health/ready")
async def ready():
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok"}
