from sqlalchemy import BigInteger, Boolean, Column, Integer, String, Text

from database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    games = Column(Integer, nullable=False, default=0)


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    team_a = Column(Text, nullable=False)
    team_b = Column(Text, nullable=False)
    winner = Column(String, nullable=False)
    goals_a = Column(Integer, nullable=False)
    goals_b = Column(Integer, nullable=False)
    timestamp = Column(BigInteger, nullable=False, index=True)
    pairing_metadata = Column(Text, nullable=True)
    positions_confirmed = Column(Text, nullable=True)
    ranked = Column(Boolean, nullable=False, default=True)
    goal_log = Column(Text, nullable=True)
    match_duration = Column(Integer, nullable=True)
    vibration_log = Column(Text, nullable=True)


class SessionState(Base):
    __tablename__ = "session_state"

    id = Column(Integer, primary_key=True)
    active_players = Column(Text, nullable=False, default="[]")
