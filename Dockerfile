# syntax=docker/dockerfile:1

# ---- Stage 1: build the Next.js static export -----------------------------
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build
# Output: /app/frontend/out/

# ---- Stage 2: Python runtime -----------------------------------------------
FROM python:3.12-slim AS runtime

# Pin uv by copying the official static binary rather than using pip/curl,
# so no build toolchain or network installer script is needed in this stage.
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /usr/local/bin/

WORKDIR /app

# Preserve backend/ as a subdirectory (sibling of db/) — backend/app/main.py
# computes its default FINALLY_DB_PATH from its own file location assuming
# this layout; see the NOTE for devops-engineer in that file.
COPY backend/ /app/backend/

WORKDIR /app/backend
RUN uv sync --locked --no-dev

# Frontend static export is served by FastAPI from backend/static/ when present.
COPY --from=frontend-builder /app/frontend/out/ /app/backend/static/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health').status == 200 else 1)"

CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
