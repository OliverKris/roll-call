from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://catalog:catalog@localhost:5433/catalog"


settings = Settings()
