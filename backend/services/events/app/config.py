from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://events:events@localhost:5435/events"
    catalog_url: str = "http://localhost:9080/api/v1"
    catalog_timeout_seconds: float = 2.0
    # Leave unset to run without publishing to Kafka (messages wait in the outbox)
    kafka_bootstrap_servers: str | None = None


settings = Settings()
