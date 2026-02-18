# Kickelo

Kickelo is a web app for tracking foosball matches with Elo (overall + role‑based offense/defense) and OpenSkill ratings. It supports live and manual match entry, 1v1 and 2v2 play, rich stats, and near real-time updates via a FastAPI backend.

## Features

- Live match mode with goal timeline and match duration
- 1v1 and 2v2 matches across all stats and history views
- Role‑based Elo (offense/defense) when positions are confirmed
- Leaderboards, streaks, badges, and player stats charts
- 2v2 pairing suggestions with waiting‑karma logic
- Season selection with optional K‑factor overrides
- Optional vibration logs persisted with match records

## Tech Stack

- **Frontend:** Vanilla JS (ES modules) + Vite
- **Charts:** Chart.js
- **Ratings:** Elo + OpenSkill
- **Backend:** FastAPI + SQLite (local file database)
- **Hosting:** Vite frontend + Python API backend

## Getting Started

### Prerequisites

- Node.js (for frontend)
- Python 3.11+ (for backend)
- Docker & Docker Compose (optional, for containerized deployment)

### Install

```bash
npm install
```

### Run with Docker (Recommended)

Build and start both frontend and backend in a single container:

```bash
docker-compose up --build
```

The app will be available at `http://localhost:8000`

Database is persisted in `./data/kickelo.db`

To stop:
```bash
docker-compose down
```

### Run locally (Development)

Start backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Start frontend (in project root):

```bash
npm run dev
```

Vite proxies `/api/*` requests to `http://127.0.0.1:8000` in development.

### Build & preview

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test
```

Or run individual suites:

```bash
npm run test:stats
npm run test:cache
```

## API Endpoints (local)

- `GET /api/players`
- `POST /api/players/ensure`
- `POST /api/players/increment-games`
- `GET /api/matches`
- `POST /api/matches`
- `GET /api/session`
- `PUT /api/session`

## Notes

- Existing Firebase config/files remain in the repo for historical reference only.
- Notification toggle is currently disabled in the FastAPI migration.

## Project Docs

These were created by and used mainly for use with AI tools.
- `overview.md`: Current architecture and feature overview
- `BATCH_STATS.md`: Batch stats computation details
- `PAUSE_FEATURE.md`, `vibration_tracking.md`, `waiting_karma.md`: Feature docs
