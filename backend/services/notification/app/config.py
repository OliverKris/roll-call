from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://notification:notification@localhost:5436/notification"
    # Leave unset to run the API without consuming from Kafka (e.g. in tests)
    kafka_bootstrap_servers: str | None = None
    kafka_group_id: str = "notification-service"


settings = Settings()
