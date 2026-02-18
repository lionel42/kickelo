# Docker Quick Start Guide

## Build and Run

```bash
# Using docker-compose (easiest)
docker-compose up --build

# Or using Docker directly
docker build -t kickelo .
docker run -p 8000:8000 -v $(pwd)/data:/app/backend/data kickelo
```

## Access the Application

Open your browser to: **http://localhost:8000**

## Database Persistence

The SQLite database is stored in `./data/kickelo.db` (automatically created).
This directory is mounted as a volume, so your data persists across container restarts.

## Stopping the Container

```bash
# If using docker-compose
docker-compose down

# If using docker run
docker stop <container-id>
```

## Rebuilding After Changes

```bash
docker-compose up --build
```

## Production Deployment

For production, consider:
1. Using a reverse proxy (nginx/traefik) with HTTPS
2. Setting proper CORS origins in `backend/main.py`
3. Using environment variables for configuration
4. Regular database backups from `./data/kickelo.db`
5. Using Docker volumes instead of bind mounts for better performance

## Troubleshooting

**Port already in use:**
```bash
# Change port in docker-compose.yml
ports:
  - "3000:8000"  # Now accessible at localhost:3000
```

**Database not persisting:**
Ensure the `data` directory has proper permissions:
```bash
mkdir -p data
chmod 755 data
```

**View logs:**
```bash
docker-compose logs -f
```
