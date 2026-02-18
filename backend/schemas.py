from typing import Any

from pydantic import BaseModel, Field


class PlayerOut(BaseModel):
    id: str
    name: str
    games: int


class EnsurePlayerRequest(BaseModel):
    name: str = Field(min_length=1)


class IncrementGamesRequest(BaseModel):
    names: list[str] = Field(default_factory=list)


class MatchCreate(BaseModel):
    teamA: list[str] = Field(min_length=1)
    teamB: list[str] = Field(min_length=1)
    winner: str
    goalsA: int
    goalsB: int
    pairingMetadata: dict[str, Any] | None = None
    positionsConfirmed: bool | dict[str, Any] | None = None
    ranked: bool = True
    goalLog: list[dict[str, Any]] | None = None
    matchDuration: int | None = None
    vibrationLog: list[dict[str, Any]] | None = None


class MatchOut(BaseModel):
    id: str
    teamA: list[str]
    teamB: list[str]
    winner: str
    goalsA: int
    goalsB: int
    timestamp: int
    pairingMetadata: dict[str, Any] | None = None
    positionsConfirmed: bool | dict[str, Any] | None = None
    ranked: bool = True
    goalLog: list[dict[str, Any]] | None = None
    matchDuration: int | None = None


class SessionStateOut(BaseModel):
    activePlayers: list[str] = Field(default_factory=list)


class SessionStateUpdate(BaseModel):
    activePlayers: list[str] = Field(default_factory=list)
