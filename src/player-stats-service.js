// Import from the centralized data services
import { isDataReady as isMatchesDataReady, allMatches } from "./match-data-service.js";
import { allPlayers } from "./player-data-service.js";


function getPlayerInfo(playerName) {
    // Find the player in the centrally managed 'allPlayers' array.
    const player = allPlayers.find(p => p.id === playerName);
    if (player) {
        return player; // Returns the full player object, including elo.
    }
    return null; // Player not found
}

/**
 * Calculates the ELO trajectory for a given player based on their recent matches.
 * Reads from the local, real-time cache of matches.
 * @param {string} playerName - The name of the player.
 * @param {number} numRecentMatches - The number of most recent matches to consider for the trajectory.
 * @returns {Array<{elo: number, timestamp: number}>} An array of ELO points. Now synchronous.
 */
export function getEloTrajectory(playerName, numRecentMatches = 1000) {
    if (!isMatchesDataReady) {
        console.warn("Match data is not ready yet.");
        return [];
    }

    const playerInfo = getPlayerInfo(playerName);
    if (!playerInfo) {
        console.warn(`Player ${playerName} not found.`);
        return [];
    }

    let currentElo = playerInfo.elo;
    const trajectory = [{ elo: currentElo, timestamp: Date.now() }];

    const relevantMatches = allMatches
        .filter(match => match.teamA.includes(playerName) || match.teamB.includes(playerName))
        .slice(0, numRecentMatches);

    for (const match of relevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');
        const eloDelta = match.eloDelta || 0;

        if (playerWasWinner) {
            currentElo -= eloDelta;
        } else {
            currentElo += eloDelta;
        }
        trajectory.unshift({ elo: Math.round(currentElo), timestamp: match.timestamp });
    }

    return trajectory;
}

/**
 * Calculates win/loss ratios for a player against different opponents.
 * @param {string} playerName - The name of the player.
 * @returns {Object<string, {wins: number, losses: number}>}
 */
export function getWinLossRatios(playerName) {
    if (!isMatchesDataReady) return {};
    const ratios = {};
    const allRelevantMatches = allMatches.filter(match =>
        match.teamA.includes(playerName) || match.teamB.includes(playerName)
    );

    for (const match of allRelevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');
        const opponents = isPlayerInTeamA ? match.teamB : match.teamA;

        opponents.forEach(opponent => {
            if (!ratios[opponent]) ratios[opponent] = { wins: 0, losses: 0 };
            if (playerWasWinner) ratios[opponent].wins++;
            else ratios[opponent].losses++;
        });
    }
    return ratios;
}

/**
 * Calculates win/loss ratios for a player with different teammates.
 * @param {string} playerName - The name of the player.
 * @returns {Object<string, {wins: number, losses: number}>}
 */
export function getWinLossRatiosWithTeammates(playerName) {
    if (!isMatchesDataReady) return {};
    const ratios = {};
    const allRelevantMatches = allMatches.filter(match =>
        match.teamA.includes(playerName) || match.teamB.includes(playerName)
    );

    for (const match of allRelevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');
        const teammates = isPlayerInTeamA ? match.teamA : match.teamB;

        teammates.forEach(teammate => {
            if (teammate === playerName) return;
            if (!ratios[teammate]) ratios[teammate] = { wins: 0, losses: 0 };
            if (playerWasWinner) ratios[teammate].wins++;
            else ratios[teammate].losses++;
        });
    }
    return ratios;
}

/**
 * Calculates the net ELO a player has gained from or lost to each opponent.
 * @param {string} playerName - The name of the player.
 * @returns {Object<string, number>}
 */
export function getEloGainsAndLosses(playerName) {
    if (!isMatchesDataReady) return {};
    const netEloChanges = {};
    const allRelevantMatches = allMatches.filter(match =>
        match.teamA.includes(playerName) || match.teamB.includes(playerName)
    );

    for (const match of allRelevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');
        const eloDelta = match.eloDelta || 0;
        const opponents = isPlayerInTeamA ? match.teamB : match.teamA;

        opponents.forEach(opponent => {
            if (!netEloChanges[opponent]) netEloChanges[opponent] = 0;
            // Note: The original logic had a * 0.5 which might be a bug.
            // Assuming the full delta is attributed to each opponent for the stat.
            if (playerWasWinner) netEloChanges[opponent] += eloDelta;
            else netEloChanges[opponent] -= eloDelta;
        });
    }
    return netEloChanges;
}

/**
 * Gets the current win or loss streak for a player.
 * @param {string} playerName - The name of the player.
 * @returns {{type: 'win' | 'loss' | 'none', length: number}}
 */
export function getCurrentStreak(playerName) {
    if (!isMatchesDataReady) return { type: 'none', length: 0 };
    const relevantMatches = allMatches.filter(match =>
        match.teamA.includes(playerName) || match.teamB.includes(playerName)
    );

    if (relevantMatches.length === 0) return { type: 'none', length: 0 };

    const lastMatch = relevantMatches[0];
    const lastMatchWon = (lastMatch.teamA.includes(playerName) && lastMatch.winner === 'A') || (lastMatch.teamB.includes(playerName) && lastMatch.winner === 'B');
    const streakType = lastMatchWon ? 'win' : 'loss';
    let streakLength = 0;

    for (const match of relevantMatches) {
        const currentMatchWon = (match.teamA.includes(playerName) && match.winner === 'A') || (match.teamB.includes(playerName) && match.winner === 'B');
        const currentMatchResult = currentMatchWon ? 'win' : 'loss';
        if (currentMatchResult === streakType) {
            streakLength++;
        } else {
            break;
        }
    }
    return { type: streakType, length: streakLength };
}

/**
 * Gets the longest historical win and loss streaks for a player.
 * @param {string} playerName - The name of the player.
 * @returns {{longestWinStreak: number, longestLossStreak: number}}
 */
export function getLongestStreaks(playerName) {
    if (!isMatchesDataReady) return { longestWinStreak: 0, longestLossStreak: 0 };
    const relevantMatches = allMatches
        .filter(match => match.teamA.includes(playerName) || match.teamB.includes(playerName))
        .reverse();

    if (relevantMatches.length === 0) return { longestWinStreak: 0, longestLossStreak: 0 };

    let longestWinStreak = 0, longestLossStreak = 0;
    let currentWinStreak = 0, currentLossStreak = 0;

    for (const match of relevantMatches) {
        const playerWon = (match.teamA.includes(playerName) && match.winner === 'A') || (match.teamB.includes(playerName) && match.winner === 'B');
        if (playerWon) {
            currentWinStreak++;
            currentLossStreak = 0;
            if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak;
        } else {
            currentLossStreak++;
            currentWinStreak = 0;
            if (currentLossStreak > longestLossStreak) longestLossStreak = currentLossStreak;
        }
    }
    return { longestWinStreak, longestLossStreak };
}

/**
 * Gets the ELO difference for every player since the start of the current day.
 * This is now a synchronous function.
 * @returns {Object<string, number>} An object mapping player names to their ELO change today.
 */
export function getDailyEloChanges() {
    if (!isMatchesDataReady) return {};

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayTimestamp = startOfDay.getTime();

    const todaysMatches = allMatches.filter(match => match.timestamp >= startOfDayTimestamp);

    const playerEloChanges = {};
    const playersInvolved = new Set();
    todaysMatches.forEach(match => {
        match.teamA.forEach(p => playersInvolved.add(p));
        match.teamB.forEach(p => playersInvolved.add(p));
    });

    for (const playerName of playersInvolved) {
        const playerInfo = getPlayerInfo(playerName);
        if (!playerInfo) continue;

        let eloAtStartOfDay = playerInfo.elo;

        const playerMatchesToday = todaysMatches.filter(m => m.teamA.includes(playerName) || m.teamB.includes(playerName));
        for (const match of playerMatchesToday) {
            const playerWon = (match.teamA.includes(playerName) && match.winner === 'A') || (match.teamB.includes(playerName) && match.winner === 'B');
            const eloDelta = match.eloDelta || 0;
            if (playerWon) eloAtStartOfDay -= eloDelta;
            else eloAtStartOfDay += eloDelta;
        }

        playerEloChanges[playerName] = playerInfo.elo - eloAtStartOfDay;
    }

    return playerEloChanges;
}
