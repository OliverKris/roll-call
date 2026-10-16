from fastapi import FastAPI
from sqlalchemy import text

from app.db import engine
from app.routers import games

app = FastAPI(title="Catalog Service")
app.include_router(games.router)


@app.get("/health")
def health():
    return {"status": "healthy", "service": "catalog"}


@app.get("/health/ready")
async def ready():
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ready", "database": "ok"}
