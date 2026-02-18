import json
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from models import Match, Player, SessionState
from schemas import (
    EnsurePlayerRequest,
    IncrementGamesRequest,
    MatchCreate,
    MatchOut,
    PlayerOut,
    SessionStateOut,
    SessionStateUpdate,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def parse_json_field(raw_value: str | None, fallback):
    if not raw_value:
        return fallback
    try:
        return json.loads(raw_value)
    except json.JSONDecodeError:
        return fallback


def match_to_out(match_row: Match) -> MatchOut:
    return MatchOut(
        id=str(match_row.id),
        teamA=parse_json_field(match_row.team_a, []),
        teamB=parse_json_field(match_row.team_b, []),
        winner=match_row.winner,
        goalsA=match_row.goals_a,
        goalsB=match_row.goals_b,
        timestamp=match_row.timestamp,
        pairingMetadata=parse_json_field(match_row.pairing_metadata, None),
        positionsConfirmed=parse_json_field(match_row.positions_confirmed, None),
        ranked=match_row.ranked,
        goalLog=parse_json_field(match_row.goal_log, None),
        matchDuration=match_row.match_duration,
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Kickelo API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for production (built frontend)
DIST_DIR = Path(__file__).parent.parent / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


@app.get("/api/health")
def healthcheck():
    return {"ok": True}


@app.get("/api/players", response_model=list[PlayerOut])
def get_players(db: Session = Depends(get_db)):
    players = db.execute(select(Player).order_by(Player.name.asc())).scalars().all()
    return [PlayerOut(id=p.id, name=p.name, games=p.games) for p in players]


@app.post("/api/players/ensure", response_model=PlayerOut)
def ensure_player(payload: EnsurePlayerRequest, db: Session = Depends(get_db)):
    player_id = payload.name.strip()
    if not player_id:
        raise HTTPException(status_code=400, detail="Player name cannot be empty.")

    player = db.get(Player, player_id)
    if not player:
        player = Player(id=player_id, name=player_id, games=0)
        db.add(player)
        db.commit()
        db.refresh(player)

    return PlayerOut(id=player.id, name=player.name, games=player.games)


@app.post("/api/players/increment-games")
def increment_games(payload: IncrementGamesRequest, db: Session = Depends(get_db)):
    for raw_name in payload.names:
        name = raw_name.strip()
        if not name:
            continue
        player = db.get(Player, name)
        if not player:
            player = Player(id=name, name=name, games=0)
            db.add(player)
            db.flush()
        player.games = (player.games or 0) + 1

    db.commit()
    return {"ok": True}


@app.get("/api/matches", response_model=list[MatchOut])
def get_matches(db: Session = Depends(get_db)):
    matches = db.execute(select(Match).order_by(Match.timestamp.desc())).scalars().all()
    return [match_to_out(match_row) for match_row in matches]


@app.post("/api/matches", response_model=MatchOut)
def create_match(payload: MatchCreate, db: Session = Depends(get_db)):
    timestamp_ms = int(time.time() * 1000)
    
    # Handle positionsConfirmed - can be bool, dict, or None
    positions_confirmed_json = None
    if payload.positionsConfirmed is not None:
        if isinstance(payload.positionsConfirmed, bool):
            positions_confirmed_json = json.dumps({"confirmed": payload.positionsConfirmed})
        else:
            positions_confirmed_json = json.dumps(payload.positionsConfirmed)
    
    match = Match(
        team_a=json.dumps(payload.teamA),
        team_b=json.dumps(payload.teamB),
        winner=payload.winner,
        goals_a=payload.goalsA,
        goals_b=payload.goalsB,
        timestamp=timestamp_ms,
        pairing_metadata=json.dumps(payload.pairingMetadata) if payload.pairingMetadata is not None else None,
        positions_confirmed=positions_confirmed_json,
        ranked=payload.ranked,
        goal_log=json.dumps(payload.goalLog) if payload.goalLog is not None else None,
        match_duration=payload.matchDuration,
        vibration_log=json.dumps(payload.vibrationLog) if payload.vibrationLog is not None else None,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return match_to_out(match)


def get_or_create_session(db: Session) -> SessionState:
    session_state = db.get(SessionState, 1)
    if not session_state:
        session_state = SessionState(id=1, active_players="[]")
        db.add(session_state)
        db.commit()
        db.refresh(session_state)
    return session_state


@app.get("/api/session", response_model=SessionStateOut)
def get_session_state(db: Session = Depends(get_db)):
    session_state = get_or_create_session(db)
    return SessionStateOut(activePlayers=parse_json_field(session_state.active_players, []))


@app.put("/api/session", response_model=SessionStateOut)
def update_session_state(payload: SessionStateUpdate, db: Session = Depends(get_db)):
    session_state = get_or_create_session(db)
    session_state.active_players = json.dumps(payload.activePlayers)
    db.commit()
    db.refresh(session_state)
    return SessionStateOut(activePlayers=parse_json_field(session_state.active_players, []))


# Serve frontend SPA - must be last to catch all non-API routes
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve the frontend SPA for all non-API routes."""
    if DIST_DIR.exists():
        # Try to serve the exact file if it exists
        file_path = DIST_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        # Otherwise serve index.html for client-side routing
        return FileResponse(DIST_DIR / "index.html")
    return {"message": "Frontend not built. Run 'npm run build' first."}
    session_state = get_or_create_session(db)
    session_state.active_players = json.dumps(payload.activePlayers)
    db.commit()
    db.refresh(session_state)
    return SessionStateOut(activePlayers=parse_json_field(session_state.active_players, []))
