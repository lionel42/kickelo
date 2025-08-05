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
export async function getEloTrajectory(playerName, numRecentMatches = 20) {
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