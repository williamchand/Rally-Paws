# Rally: single-service image (FastAPI backend serves the built React PWA).
# Build the frontend with Node, then serve it same-origin from the backend.
FROM node:22-alpine AS webbuild
WORKDIR /web
COPY rally-web/package.json rally-web/package-lock.json* ./
RUN npm ci
COPY rally-web/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend/
COPY --from=webbuild /web/dist ./web-dist/
WORKDIR /app/backend
RUN python -m pytest -q
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
