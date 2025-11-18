// Import from the centralized data services
import { isDataReady as isMatchesDataReady, allMatches } from "./match-data-service.js";
import { allPlayers } from "./player-data-service.js";
import { MAX_GOALS } from "./constants.js";

/**
 * NOTE: For performance-critical scenarios, consider using computeAllPlayerStats
 * from player-stats-batch.js which computes all stats in a single pass.
 * See BATCH_STATS.md for details.
 */

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
        // account for multiple opponents by dividing the eloDelta equally
        const perOpponentDelta = eloDelta / opponents.length;
        opponents.forEach(opponent => {
            if (!netEloChanges[opponent]) netEloChanges[opponent] = 0;
            if (playerWasWinner) netEloChanges[opponent] += perOpponentDelta;
            else netEloChanges[opponent] -= perOpponentDelta;
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

/**
 * @param {string} playerName - The name of the player.
 * @returns {{score: number, totalWins: number, totalLosses: number}}
 */
export function getStreakyness(playerName) {
    if (!isMatchesDataReady) return { score: 1, totalWins: 0, totalLosses: 0 };

    const relevantMatches = allMatches
        .filter(match => match.teamA.includes(playerName) || match.teamB.includes(playerName))
        .reverse(); // Chronological order (oldest first) is needed for this calculation

    const n = relevantMatches.length;
    if (n < 2) return { score: 1, totalWins: 0, totalLosses: 0 };

    const results = relevantMatches.map(match => {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        return (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');
    });

    let wins = 0;
    let consecutiveSame = 0;
    for (let i = 0; i < n; i++) {
        if (results[i]) wins++;
        if (i > 0 && results[i] === results[i-1]) {
            consecutiveSame++;
        }
    }

    const losses = n - wins;
    const pConsecutive = consecutiveSame / (n - 1);

    // Probability of two random matches having the same result
    const pWin = wins / n;
    const pLoss = losses / n;
    const pRandomSame = (pWin * pWin) + (pLoss * pLoss);

    if (pRandomSame === 0) return { score: 1, totalWins: wins, totalLosses: losses }; // Avoid division by zero

    return {
        score: pConsecutive / pRandomSame,
        totalWins: wins,
        totalLosses: losses
    };
}

/**
 * Gets the all-time goal score and a histogram of match results for a player.
 * @param {string} playerName - The name of the player.
 * @returns {{ totalGoals: number, resultHistogram: Object<string, number> }}
 */
export function getGoalStats(playerName) {
    if (!isMatchesDataReady) return { goalsFor: 0, goalsAgainst: 0, resultHistogram: {} };
    let goalsFor = 0;
    let goalsAgainst = 0;
    const resultHistogram = {};

    const relevantMatches = allMatches.filter(match =>
        match.teamA.includes(playerName) || match.teamB.includes(playerName)
    );

    for (const match of relevantMatches) {
        let teamGoals, oppGoals;
        if (match.goalsA !== undefined && match.goalsB !== undefined) {
            // match has goals recorded
            if (match.teamA.includes(playerName)) {
                teamGoals = match.goalsA;
                oppGoals = match.goalsB;
            } else {
                teamGoals = match.goalsB;
                oppGoals = match.goalsA;
            }
            goalsFor += teamGoals;
            goalsAgainst += oppGoals;
            const key = `${teamGoals}:${oppGoals}`;
            resultHistogram[key] = (resultHistogram[key] || 0) + 1;
        }
    }
    return { goalsFor, goalsAgainst, resultHistogram };
}

/**
 * Calculates the all-time highest ELO for a given player.
 * @param {string} playerName - The name of the player.
 * @returns {number} The highest ELO ever reached by the player.
 */
export function getHighestElo(playerName) {
    if (!isMatchesDataReady) {
        console.warn("Match data is not ready yet.");
        return null;
    }
    const playerInfo = getPlayerInfo(playerName);
    if (!playerInfo) {
        console.warn(`Player ${playerName} not found.`);
        return null;
    }
    let currentElo = playerInfo.elo;
    let highestElo = currentElo;
    const relevantMatches = allMatches
        .filter(match => match.teamA.includes(playerName) || match.teamB.includes(playerName));
    for (const match of relevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (!isPlayerInTeamA && match.winner === 'B');
        const eloDelta = match.eloDelta || 0;
        if (playerWasWinner) {
            currentElo -= eloDelta;
        } else {
            currentElo += eloDelta;
        }
        if (currentElo > highestElo) highestElo = currentElo;
    }
    return Math.round(highestElo);
}

/**
 * Calculates the 'golden ratio' for a player: ratio of games won 5:4 to (games won 5:4 + games lost 4:5).
 * @param {string} playerName - The name of the player.
 * @returns {number|null} Golden ratio, or null if no relevant games.
 */
export function getGoldenRatio(playerName) {
    if (!isMatchesDataReady) return null;
    let won54 = 0;
    let lost45 = 0;
    let consideredMatches = 0;
    for (const match of allMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const isPlayerInTeamB = match.teamB.includes(playerName);
        if (!isPlayerInTeamA && !isPlayerInTeamB) continue;
        consideredMatches++;
        const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (isPlayerInTeamB && match.winner === 'B');
        if (playerWasWinner && ((isPlayerInTeamA && match.goalsB === MAX_GOALS-1) || (isPlayerInTeamB && match.goalsA === MAX_GOALS-1))) {
            won54++;
        } else if (!playerWasWinner && ((isPlayerInTeamA && match.goalsA === MAX_GOALS-1) || (isPlayerInTeamB && match.goalsB === MAX_GOALS-1))) {
            lost45++;
        }
    }
    const total = won54 + lost45;
    console.debug('[GoldenRatio] Final counts:', {won54, lost45, total, consideredMatches});
    if (total === 0) {
        console.debug('[GoldenRatio] Returning null because total is 0');
        return null;
    }
    return won54 / total;
}

/**
 * Calculates the 'comeback percentage' for a player: win-rate in games with a goal log where the player fell behind at any point.
 * @param {string} playerName - The name of the player.
 * @returns {number|null} Comeback win percentage, or null if no comeback games.
 */
export function getComebackPercentage(playerName) {
    if (!isMatchesDataReady) return null;
    let comebackGames = 0;
    let comebackWins = 0;
    let consideredMatches = 0;
    for (const match of allMatches) {
        if (!match.goalLog || !Array.isArray(match.goalLog) || match.goalLog.length === 0) {
            console.debug('[Comeback%] Skipping match, no valid goalLog:', match);
            continue;
        }
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const isPlayerInTeamB = match.teamB.includes(playerName);
        if (!isPlayerInTeamA && !isPlayerInTeamB) continue;
        consideredMatches++;
        let teamAGoals = 0;
        let teamBGoals = 0;
        let playerFellBehind = false;
        for (const goal of match.goalLog) {
            if (goal.team === 'red') teamAGoals++;
            else if (goal.team === 'blue') teamBGoals++;
            if (isPlayerInTeamA && teamAGoals < teamBGoals) playerFellBehind = true;
            if (isPlayerInTeamB && teamBGoals < teamAGoals) playerFellBehind = true;
        }
        if (playerFellBehind) {
            comebackGames++;
            const playerWasWinner = (isPlayerInTeamA && match.winner === 'A') || (isPlayerInTeamB && match.winner === 'B');
            if (playerWasWinner) comebackWins++;
        }
    }
    if (comebackGames === 0) return null;
    return comebackWins / comebackGames;
}

/**
 * Computes average time between goals for a player's team and opposing teams.
 * Only considers matches with a goalLog.
 * @param {string} playerName - The name/id of the player.
 * @returns {{ avgTimePerTeamGoal: number|null, avgTimePerOpponentGoal: number|null }}
 */
export function getAverageTimeBetweenGoals(playerName) {
    if (!isMatchesDataReady) return { avgTimePerTeamGoal: null, avgTimePerOpponentGoal: null };
    let totalTimePlayed = 0;
    let totalTeamGoals = 0;
    let totalOpponentGoals = 0;
    const relevantMatches = allMatches.filter(match =>
        (match.teamA.includes(playerName) || match.teamB.includes(playerName)) && Array.isArray(match.goalLog) && match.goalLog.length > 0
    );
    for (const match of relevantMatches) {
        const isPlayerInTeamA = match.teamA.includes(playerName);
        const playerTeam = isPlayerInTeamA ? 'red' : 'blue';
        const opponentTeam = isPlayerInTeamA ? 'blue' : 'red';
        // Match duration: use last goal timestamp, or fallback to match.matchDuration or 0
        let matchDuration = 0;
        if (match.goalLog.length > 0) {
            matchDuration = Math.max(...match.goalLog.map(g => g.timestamp));
        } else if (match.matchDuration) {
            matchDuration = match.matchDuration;
        }
        totalTimePlayed += matchDuration;
        totalTeamGoals += match.goalLog.filter(g => g.team === playerTeam).length;
        totalOpponentGoals += match.goalLog.filter(g => g.team === opponentTeam).length;
    }
    return {
        avgTimePerTeamGoal: totalTeamGoals > 0 ? totalTimePlayed / totalTeamGoals : null,
        avgTimePerOpponentGoal: totalOpponentGoals > 0 ? totalTimePlayed / totalOpponentGoals : null
    };
}
