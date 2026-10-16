from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://profile:profile@localhost:5434/profile"
    catalog_url: str = "http://localhost:9080/api/v1"
    catalog_timeout_seconds: float = 2.0


settings = Settings()
