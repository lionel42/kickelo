// src/player-stats-service.js

import { db, collection, doc, getDoc, query, where, orderBy, limit, getDocs } from './firebase-service.js';

// Helper to get a player's current ELO and games count
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
 * The trajectory is calculated backwards from the player's current ELO.
 * @param {string} playerName - The name of the player.
 * @param {number} numRecentMatches - The number of most recent matches to consider for the trajectory.
 * @returns {Array<{elo: number, timestamp: number}>} An array of ELO points with timestamps, in chronological order.
 */
export async function getEloTrajectory(playerName, numRecentMatches = 20) {
    const playerInfo = await getPlayerInfo(playerName);
    if (!playerInfo) {
        console.warn(`Player ${playerName} not found.`);
        return [];
    }

    let currentElo = playerInfo.elo;
    const trajectory = [{ elo: currentElo, timestamp: Date.now() }]; // Start with current ELO

    const matchesColRef = collection(db, 'matches');

    // Fetch matches where player is in Team A OR Team B
    const qA = query(
        matchesColRef,
        where("teamA", "array-contains", playerName),
        orderBy("timestamp", "desc"),
        limit(numRecentMatches)
    );
    const qB = query(
        matchesColRef,
        where("teamB", "array-contains", playerName),
        orderBy("timestamp", "desc"),
        limit(numRecentMatches)
    );

    const [snapshotA, snapshotB] = await Promise.all([getDocs(qA), getDocs(qB)]);

    let relevantMatches = [];
    const processedMatchIds = new Set(); // To avoid duplicates if a player is in both queries (not typical for 2v2, but good practice)

    snapshotA.docs.forEach(doc => {
        if (!processedMatchIds.has(doc.id)) {
            relevantMatches.push({ id: doc.id, ...doc.data() });
            processedMatchIds.add(doc.id);
        }
    });
    snapshotB.docs.forEach(doc => {
        if (!processedMatchIds.has(doc.id)) {
            relevantMatches.push({ id: doc.id, ...doc.data() });
            processedMatchIds.add(doc.id);
        }
    });

    // Sort matches in reverse chronological order (most recent first)
    relevantMatches.sort((a, b) => b.timestamp - a.timestamp);

    // Calculate trajectory backwards
    for (const match of relevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');

        const eloDelta = match.eloDelta || 0; // Ensure eloDelta exists, default to 0

        // If player won this match, their ELO was lower before this match
        // If player lost this match, their ELO was higher before this match
        if (playerWasWinner) {
            currentElo -= eloDelta;
        } else {
            currentElo += eloDelta;
        }

        // Add to the beginning of the trajectory to keep it chronological
        trajectory.unshift({ elo: Math.round(currentElo), timestamp: match.timestamp });
    }

    return trajectory;
}

/**
 * Calculates win/loss ratios for a player against different opponents.
 * @param {string} playerName - The name of the player.
 * @returns {Object<string, {wins: number, losses: number}>} An object mapping opponent names to their win/loss counts.
 */
export async function getWinLossRatios(playerName) {
    const ratios = {};
    const matchesColRef = collection(db, 'matches');

    // Fetch all matches for the player (consider adding a time limit for very large datasets)
    const qA = query(
        matchesColRef,
        where("teamA", "array-contains", playerName)
    );
    const qB = query(
        matchesColRef,
        where("teamB", "array-contains", playerName)
    );

    const [snapshotA, snapshotB] = await Promise.all([getDocs(qA), getDocs(qB)]);

    let allRelevantMatches = [];
    const processedMatchIds = new Set();

    snapshotA.docs.forEach(doc => {
        if (!processedMatchIds.has(doc.id)) {
            allRelevantMatches.push({ id: doc.id, ...doc.data() });
            processedMatchIds.add(doc.id);
        }
    });
    snapshotB.docs.forEach(doc => {
        if (!processedMatchIds.has(doc.id)) {
            allRelevantMatches.push({ id: doc.id, ...doc.data() });
            processedMatchIds.add(doc.id);
        }
    });

    for (const match of allRelevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');

        let opponents = [];
        if (isPlayerInTeamA) {
            // Opponents are all players in Team B
            opponents = match.teamB;
        } else {
            // Opponents are all players in Team A
            opponents = match.teamA;
        }

        opponents.forEach(opponent => {
            if (opponent === playerName) return; // Should not happen if logic is correct, but safety check

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