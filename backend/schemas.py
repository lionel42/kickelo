from typing import Any, Literal

from pydantic import BaseModel, Field
from pydantic import model_validator


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
    winner: Literal["A", "B"]
    goalsA: int
    goalsB: int
    pairingMetadata: dict[str, Any] | None = None
    positionsConfirmed: bool | dict[str, Any] | None = None
    ranked: bool = True
    goalLog: list[dict[str, Any]] | None = None
    matchDuration: int | None = None
    vibrationLog: list[dict[str, Any]] | None = None

    @model_validator(mode="after")
    def validate_match_payload(self):
        team_a = [name.strip() for name in self.teamA if isinstance(name, str) and name.strip()]
        team_b = [name.strip() for name in self.teamB if isinstance(name, str) and name.strip()]

        if len(team_a) != len(self.teamA) or len(team_b) != len(self.teamB):
            raise ValueError("Player names cannot be empty.")

        if len(team_a) > 2 or len(team_b) > 2:
            raise ValueError("Each team can have at most 2 players.")

        total_players = len(team_a) + len(team_b)
        if total_players < 2 or total_players > 4:
            raise ValueError("Only 1v1, 1v2, 2v1, or 2v2 matches are supported.")

        all_players = team_a + team_b
        if len(set(all_players)) != len(all_players):
            raise ValueError("A player cannot appear on both teams.")

        if self.goalsA < 0 or self.goalsB < 0:
            raise ValueError("Goals cannot be negative.")

        if self.goalsA == self.goalsB:
            raise ValueError("Matches cannot end in a tie.")

        expected_winner = "A" if self.goalsA > self.goalsB else "B"
        if self.winner != expected_winner:
            raise ValueError("Winner does not match the score.")

        self.teamA = team_a
        self.teamB = team_b
        return self


class MatchOut(BaseModel):
    id: str
    teamA: list[str]
    teamB: list[str]
    winner: Literal["A", "B"]
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
