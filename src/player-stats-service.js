// src/player-stats-service.js

import { db, doc, getDoc} from './firebase-service.js';
import {isDataReady, allMatches} from "./match-data-service.js";

// Helper to get a player's current ELO and games count
// Helper to get a player's current ELO and games count (this remains async as it fetches from 'players')
async function getPlayerInfo(playerName) {
    const playerDocRef = doc(db, 'players', playerName);
    const docSnap = await getDoc(playerDocRef);
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return null; // Player not found
}

/**
 * Calculates the ELO trajectory for a given player based on their recent matches.
 * Reads from the local, real-time cache of matches.
 * @param {string} playerName - The name of the player.
 * @param {number} numRecentMatches - The number of most recent matches to consider for the trajectory.
 * @returns {Promise<Array<{elo: number, timestamp: number}>>} A promise that resolves to an array of ELO points.
 */
export async function getEloTrajectory(playerName, numRecentMatches = 1000) {
    if (!isDataReady) {
        console.warn("Match data is not ready yet. Call initializeMatchesData() and wait for the data to load.");
        return [];
    }

    const playerInfo = await getPlayerInfo(playerName);
    if (!playerInfo) {
        console.warn(`Player ${playerName} not found.`);
        return [];
    }

    let currentElo = playerInfo.elo;
    const trajectory = [{ elo: currentElo, timestamp: Date.now() }];

    // Filter the local array instead of querying Firestore.
    // Since `allMatches` is pre-sorted newest-to-oldest, we can just slice the results.
    const relevantMatches = allMatches
        .filter(match => match.teamA.includes(playerName) || match.teamB.includes(playerName))
        .slice(0, numRecentMatches);

    // The rest of the calculation logic is identical.
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
 * This function is now synchronous as it only reads from the local array.
 * @param {string} playerName - The name of the player.
 * @returns {Object<string, {wins: number, losses: number}>} An object mapping opponent names to their win/loss counts.
 */
export function getWinLossRatios(playerName) {
    if (!isDataReady) {
        console.warn("Match data is not ready yet. Call initializeMatchesData() and wait for the data to load.");
        return {};
    }

    const ratios = {};

    // Filter the local array instead of querying Firestore.
    const allRelevantMatches = allMatches.filter(match =>
        match.teamA.includes(playerName) || match.teamB.includes(playerName)
    );

    for (const match of allRelevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');

        const opponents = isPlayerInTeamA ? match.teamB : match.teamA;

        opponents.forEach(opponent => {
            if (!ratios[opponent]) {
                ratios[opponent] = { wins: 0, losses: 0 };
            }

            if (playerWasWinner) {
                ratios[opponent].wins++;
            } else {
                ratios[opponent].losses++;
            }
        });
    }
    return ratios;
}

/**
 * 1. Calculates win/loss ratios for a player with different teammates.
 * @param {string} playerName - The name of the player.
 * @returns {Object<string, {wins: number, losses: number}>} An object mapping teammate names to win/loss counts.
 */
export function getWinLossRatiosWithTeammates(playerName) {
    if (!isDataReady) return {};
    const ratios = {};
    const allRelevantMatches = allMatches.filter(match =>
        match.teamA.includes(playerName) || match.teamB.includes(playerName)
    );

    for (const match of allRelevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');
        const teammates = isPlayerInTeamA ? match.teamA : match.teamB;

        teammates.forEach(teammate => {
            if (teammate === playerName) return; // Skip the player themselves
            if (!ratios[teammate]) ratios[teammate] = { wins: 0, losses: 0 };
            if (playerWasWinner) ratios[teammate].wins++;
            else ratios[teammate].losses++;
        });
    }
    return ratios;
}

/**
 * 2. Calculates the net ELO a player has gained from or lost to each opponent.
 * @param {string} playerName - The name of the player.
 * @returns {Object<string, number>} An object mapping opponent names to the net ELO change.
 */
export function getEloGainsAndLosses(playerName) {
    if (!isDataReady) return {};
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
            if (playerWasWinner) netEloChanges[opponent] += eloDelta;
            else netEloChanges[opponent] -= eloDelta;
        });
    }
    return netEloChanges;
}

/**
 * 3. Gets the current win or loss streak for a player.
 * @param {string} playerName - The name of the player.
 * @returns {{type: 'win' | 'loss' | 'none', length: number}} The streak type and length.
 */
export function getCurrentStreak(playerName) {
    if (!isDataReady) return { type: 'none', length: 0 };
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
            break; // Streak is broken
        }
    }
    return { type: streakType, length: streakLength };
}

/**
 * 4. Gets the longest historical win and loss streaks for a player.
 * @param {string} playerName - The name of the player.
 * @returns {{longestWinStreak: number, longestLossStreak: number}}
 */
export function getLongestStreaks(playerName) {
    if (!isDataReady) return { longestWinStreak: 0, longestLossStreak: 0 };
    // Matches must be in chronological order (oldest first) for this logic
    const relevantMatches = allMatches
        .filter(match => match.teamA.includes(playerName) || match.teamB.includes(playerName))
        .reverse();

    if (relevantMatches.length === 0) return { longestWinStreak: 0, longestLossStreak: 0 };

    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const match of relevantMatches) {
        const playerWon = (match.teamA.includes(playerName) && match.winner === 'A') || (match.teamB.includes(playerName) && match.winner === 'B');
        if (playerWon) {
            currentWinStreak++;
            currentLossStreak = 0; // Reset loss streak
            if (currentWinStreak > longestWinStreak) {
                longestWinStreak = currentWinStreak;
            }
        } else {
            currentLossStreak++;
            currentWinStreak = 0; // Reset win streak
            if (currentLossStreak > longestLossStreak) {
                longestLossStreak = currentLossStreak;
            }
        }
    }
    return { longestWinStreak, longestLossStreak };
}

/**
 * 5. Gets the ELO difference for every player since the start of the current day.
 * @returns {Promise<Object<string, number>>} A promise resolving to an object mapping player names to their ELO change today.
 */
export async function getDailyEloChanges() {
    if (!isDataReady) return {};

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
        const playerInfo = await getPlayerInfo(playerName);
        if (!playerInfo) continue;

        let eloAtStartOfDay = playerInfo.elo;

        // Reverse calculate ELO at start of day
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