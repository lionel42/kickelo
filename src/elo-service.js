import { ELO_K_FACTOR, ELO_RATING_SCALE } from './constants.js';

// Re-export for backwards compatibility
const K = ELO_K_FACTOR;
const TEAM_SIZE_ELO_BONUS_PER_PLAYER = 35;
const UNDERDOG_CLOSE_LOSS_MAX_SCORE = 0.7;

function expectedScore(r1, r2) {
    return 1 / (1 + Math.pow(10, (r2 - r1) / ELO_RATING_SCALE));
}

function updateRating(old, expected, score, kFactor = K) {
    return Math.round(old + kFactor * (score - expected));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getCloseLossScore(loserGoals, winnerGoals) {
    if (winnerGoals <= 0) return 0;
    const closeness = clamp(loserGoals / winnerGoals, 0, 1);
    return closeness * UNDERDOG_CLOSE_LOSS_MAX_SCORE;
}

export function getTeamSizeAdjustedExpectedScore(teamARating, teamBRating, teamASize = 2, teamBSize = 2) {
    const sizeGap = (teamBSize || 0) - (teamASize || 0);
    const adjustedTeamARating = teamARating + sizeGap * TEAM_SIZE_ELO_BONUS_PER_PLAYER;
    return expectedScore(adjustedTeamARating, teamBRating);
}

export function getHandicapAdjustedScoreA(winner, goalsA, goalsB, teamASize = 2, teamBSize = 2) {
    let scoreA = winner === 'A' ? 1 : 0;

    const teamADisadvantaged = teamASize < teamBSize;
    if (!scoreA && teamADisadvantaged) {
        scoreA = getCloseLossScore(goalsA, goalsB);
    }

    const teamBDisadvantaged = teamBSize < teamASize;
    if (scoreA === 1 && teamBDisadvantaged) {
        const teamBCloseLossScore = getCloseLossScore(goalsB, goalsA);
        scoreA = 1 - teamBCloseLossScore;
    }

    return clamp(scoreA, 0, 1);
}

export function calculateMatchEloDelta({
    teamARating,
    teamBRating,
    teamASize,
    teamBSize,
    winner,
    goalsA,
    goalsB,
    kFactor = K
}) {
    const expectedA = getTeamSizeAdjustedExpectedScore(teamARating, teamBRating, teamASize, teamBSize);
    const scoreA = getHandicapAdjustedScoreA(winner, goalsA, goalsB, teamASize, teamBSize);
    const signedDeltaA = updateRating(0, expectedA, scoreA, kFactor);
    return {
        expectedA,
        scoreA,
        signedDeltaA,
        delta: Math.abs(signedDeltaA)
    };
}

export {
    K, // You might still need K externally, so export it
    expectedScore,
    updateRating
};