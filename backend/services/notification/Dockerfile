FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app

COPY libs/common /libs/common
RUN uv pip install --system /libs/common

COPY services/notification/pyproject.toml .
RUN uv pip install --system -r pyproject.toml

COPY services/notification/alembic.ini .
COPY services/notification/alembic ./alembic
COPY services/notification/app ./app

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
