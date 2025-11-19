import { MAX_GOALS, STARTING_ELO, INACTIVE_THRESHOLD_DAYS } from "./constants.js";

function getDayKey(timestamp) {
    const day = new Date(timestamp);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
}

/**
 * Computes all statistics for all players present in a list of matches.
 * Matches must be sorted by timestamp (newest first, as they come from Firestore).
 * @param {Array<Object>} matches - Array of match objects sorted by timestamp descending.
 * @returns {Object<string, Object>} Mapping from player id to their statistics.
 */
export function computeAllPlayerStats(matches) {
    const startTime = performance.now();
    
    // Extract all unique player IDs from matches
    const playerSet = new Set();
    for (const match of matches) {
        for (const team of ['teamA', 'teamB']) {
            if (Array.isArray(match[team])) {
                for (const pid of match[team]) {
                    playerSet.add(pid);
                }
            }
        }
    }
    const players = Array.from(playerSet);

    // Prepare start of day timestamp for daily stats
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayTimestamp = startOfDay.getTime();

    // Initialize stats for each player
    const stats = {};
    for (const playerName of players) {
        stats[playerName] = {
            eloTrajectory: [],
            winLossRatios: {},
            winLossRatiosWithTeammates: {},
            eloGainsAndLosses: {},
            currentStreak: { type: 'none', length: 0 },
            longestStreaks: { longestWinStreak: 0, longestLossStreak: 0 },
            streakType: null,
            streakLength: 0,
            currentWinStreak: 0,
            currentLossStreak: 0,
            longestWinStreak: 0,
            longestLossStreak: 0,
            dailyEloChange: 0,
            streakyness: { score: 1, totalWins: 0, totalLosses: 0 },
            winCount: 0,
            lossCount: 0,
            consecutiveSame: 0,
            lastResult: null,
            goalStats: { goalsFor: 0, goalsAgainst: 0, resultHistogram: {} },
            highestElo: 0,  // Will be set properly as we process matches
            goldenRatio: null,
            goldenCounts: { won54: 0, lost45: 0 },
            comebackCounts: { games: 0, wins: 0 },
            avgTimeBetweenGoals: { totalTimePlayed: 0, totalTeamGoals: 0, totalOpponentGoals: 0 },
            lastPlayed: null,  // Will be set to the most recent match timestamp
            statusEvents: {
                extinguisherCount: 0,
                underdogPointSum: 0,
                comebackGoalSum: 0,
                shutoutCount: 0
            },
            dailyDeltas: {},
            alternatingRunLength: 0,
            lastAlternatingResult: null,
            currentAlternatingRun: 0,
            currentPositiveDayRun: 0,
            phoenix: { isActive: false, recoveredAmount: 0 }
        };
    }

    console.log(`Computing stats for ${players.length} players over ${matches.length} matches..`);

    // Process all matches in reverse order (oldest to most recent)
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const hasGoalLog = Array.isArray(match.goalLog) && match.goalLog.length > 0;
        
        // Defensive: skip invalid matches add log a warning
        if (!Array.isArray(match.teamA) || !Array.isArray(match.teamB)) {
            console.warn(`Skipping invalid match with id ${match.id}: missing teamA or teamB array`);
            continue;
        }
        
        const dayKey = getDayKey(match.timestamp);
        const matchIsToday = match.timestamp >= startOfDayTimestamp;
        const allPlayersInMatch = [...match.teamA, ...match.teamB];

        const playerMeta = {};
        for (const playerId of allPlayersInMatch) {
            const playerStats = stats[playerId];
            if (!playerStats) continue;
            const lastEloPoint = playerStats.eloTrajectory.length > 0
                ? playerStats.eloTrajectory[playerStats.eloTrajectory.length - 1].elo
                : STARTING_ELO;
            playerMeta[playerId] = {
                preMatchElo: lastEloPoint,
                streakType: playerStats.streakType,
                streakLength: playerStats.streakLength,
                alternatingRunLength: playerStats.alternatingRunLength || 0,
                lastAlternatingResult: playerStats.lastAlternatingResult
            };
        }

        const teamAAvgElo = match.teamA.length > 0
            ? match.teamA.reduce((sum, pid) => sum + (playerMeta[pid]?.preMatchElo ?? STARTING_ELO), 0) / match.teamA.length
            : STARTING_ELO;
        const teamBAvgElo = match.teamB.length > 0
            ? match.teamB.reduce((sum, pid) => sum + (playerMeta[pid]?.preMatchElo ?? STARTING_ELO), 0) / match.teamB.length
            : STARTING_ELO;

        const streakBreaksAgainstA = match.teamB.reduce((count, pid) => {
            const meta = playerMeta[pid];
            return count + (meta?.streakType === 'win' && (meta.streakLength || 0) >= 3 ? 1 : 0);
        }, 0);
        const streakBreaksAgainstB = match.teamA.reduce((count, pid) => {
            const meta = playerMeta[pid];
            return count + (meta?.streakType === 'win' && (meta.streakLength || 0) >= 3 ? 1 : 0);
        }, 0);

        let underdogPoints = 0;
        const winningAvg = match.winner === 'A' ? teamAAvgElo : teamBAvgElo;
        const losingAvg = match.winner === 'A' ? teamBAvgElo : teamAAvgElo;
        if (!Number.isNaN(winningAvg) && !Number.isNaN(losingAvg)) {
            const diff = losingAvg - winningAvg;
            if (diff >= 100) {
                underdogPoints = Math.floor(diff / 100);
            }
        }

        const maxDeficits = computeMaxDeficits(match.goalLog);
        const comebackDeficit = match.winner === 'A' ? maxDeficits.A : maxDeficits.B;
        const winningGoals = match.winner === 'A' ? match.goalsA : match.goalsB;
        const losingGoals = match.winner === 'A' ? match.goalsB : match.goalsA;
        const isShutoutWin = winningGoals === MAX_GOALS && losingGoals === 0;
        const winnerOppStreakCount = match.winner === 'A' ? streakBreaksAgainstA : streakBreaksAgainstB;

        // Process each player involved in the match
        for (const playerId of allPlayersInMatch) {
            if (!stats[playerId]) continue;
            const s = stats[playerId];
            
            // Determine which team the player is on
            const isTeamA = match.teamA.includes(playerId);
            const team = isTeamA ? 'A' : 'B';
            const teamPlayers = isTeamA ? match.teamA : match.teamB;
            const oppPlayers = isTeamA ? match.teamB : match.teamA;
            const teamGoals = isTeamA ? match.goalsA : match.goalsB;
            const oppGoals = isTeamA ? match.goalsB : match.goalsA;
            
            // ELO trajectory
            let currentElo = s.eloTrajectory.length > 0 ? s.eloTrajectory[s.eloTrajectory.length - 1].elo : STARTING_ELO;
            const playerWasWinner = (team === match.winner);
            const eloDelta = match.eloDelta || 0;
            if (playerWasWinner) currentElo += eloDelta;
            else currentElo -= eloDelta;
            s.eloTrajectory.push({ elo: Math.round(currentElo), timestamp: match.timestamp });
            if (Math.round(currentElo) > s.highestElo) s.highestElo = Math.round(currentElo);

            const perMatchDelta = playerWasWinner ? eloDelta : -eloDelta;
            s.dailyDeltas[dayKey] = (s.dailyDeltas[dayKey] || 0) + perMatchDelta;

            // Track last played timestamp (will end up with the newest match since we process oldest->newest)
            if (!s.lastPlayed || match.timestamp > s.lastPlayed) {
                s.lastPlayed = match.timestamp;
            }

            // Win/loss ratios vs opponents
            for (const opp of oppPlayers) {
                if (!s.winLossRatios[opp]) s.winLossRatios[opp] = { wins: 0, losses: 0 };
                if (playerWasWinner) s.winLossRatios[opp].wins++;
                else s.winLossRatios[opp].losses++;
                if (!s.eloGainsAndLosses[opp]) s.eloGainsAndLosses[opp] = 0;
                const perOpponentDelta = eloDelta / oppPlayers.length;
                if (playerWasWinner) s.eloGainsAndLosses[opp] += perOpponentDelta;
                else s.eloGainsAndLosses[opp] -= perOpponentDelta;
            }

            // Win/loss ratios with teammates
            for (const teammate of teamPlayers) {
                if (teammate === playerId) continue;
                if (!s.winLossRatiosWithTeammates[teammate]) s.winLossRatiosWithTeammates[teammate] = { wins: 0, losses: 0 };
                if (playerWasWinner) s.winLossRatiosWithTeammates[teammate].wins++;
                else s.winLossRatiosWithTeammates[teammate].losses++;
            }
            
            // Goal stats
            if (teamGoals !== undefined && oppGoals !== undefined) {
                s.goalStats.goalsFor += teamGoals;
                s.goalStats.goalsAgainst += oppGoals;
                const key = `${teamGoals}:${oppGoals}`;
                s.goalStats.resultHistogram[key] = (s.goalStats.resultHistogram[key] || 0) + 1;
            }
            
            // Golden ratio
            if (playerWasWinner && oppGoals === MAX_GOALS-1) s.goldenCounts.won54++;
            else if (!playerWasWinner && teamGoals === MAX_GOALS-1) s.goldenCounts.lost45++;
            
            // Comeback percentage
            if (hasGoalLog) {
                let teamAGoals = 0, teamBGoals = 0, fellBehind = false;
                for (const goal of match.goalLog) {
                    if (goal.team === 'red') teamAGoals++;
                    else if (goal.team === 'blue') teamBGoals++;
                    if (team === 'A' && teamAGoals < teamBGoals) fellBehind = true;
                    if (team === 'B' && teamBGoals < teamAGoals) fellBehind = true;
                }
                if (fellBehind) {
                    s.comebackCounts.games++;
                    if (playerWasWinner) s.comebackCounts.wins++;
                }
            }
            
            // Avg time between goals
            if (hasGoalLog) {
                let matchDuration = Math.max(...match.goalLog.map(g => g.timestamp));
                s.avgTimeBetweenGoals.totalTimePlayed += matchDuration;
                s.avgTimeBetweenGoals.totalTeamGoals += match.goalLog.filter(g => g.team === (team === 'A' ? 'red' : 'blue')).length;
                s.avgTimeBetweenGoals.totalOpponentGoals += match.goalLog.filter(g => g.team === (team === 'A' ? 'blue' : 'red')).length;
            }
            
            // Inline streak calculations
            const result = playerWasWinner ? 'win' : 'loss';
            if (s.streakType === null) {
                s.streakType = result;
                s.streakLength = 1;
            } else if (s.streakType === result) {
                s.streakLength++;
            } else {
                s.streakType = result;
                s.streakLength = 1;
            }
            s.currentStreak = { type: s.streakType, length: s.streakLength };

            const previousAltResult = playerMeta[playerId]?.lastAlternatingResult;
            const previousAltLength = playerMeta[playerId]?.alternatingRunLength || 0;
            if (previousAltResult === null || previousAltResult === undefined) {
                s.alternatingRunLength = 1;
            } else if (previousAltResult !== result) {
                s.alternatingRunLength = previousAltLength + 1;
            } else {
                s.alternatingRunLength = 1;
            }
            s.lastAlternatingResult = result;
            
            // Longest streaks
            if (result === 'win') {
                s.currentWinStreak++;
                s.currentLossStreak = 0;
                if (s.currentWinStreak > s.longestWinStreak) s.longestWinStreak = s.currentWinStreak;
            } else {
                s.currentLossStreak++;
                s.currentWinStreak = 0;
                if (s.currentLossStreak > s.longestLossStreak) s.longestLossStreak = s.currentLossStreak;
            }
            s.longestStreaks = { longestWinStreak: s.longestWinStreak, longestLossStreak: s.longestLossStreak };
            
            if (matchIsToday && playerWasWinner) {
                if (winnerOppStreakCount > 0) s.statusEvents.extinguisherCount += winnerOppStreakCount;
                if (underdogPoints > 0) s.statusEvents.underdogPointSum += underdogPoints;
                if (comebackDeficit >= 2) s.statusEvents.comebackGoalSum += comebackDeficit;
                if (isShutoutWin) s.statusEvents.shutoutCount += 1;
            }

            // Streakyness
            if (s.lastResult !== null && s.lastResult === result) s.consecutiveSame++;
            s.lastResult = result;
            if (result === 'win') s.winCount++;
            else s.lossCount++;
        }
    }

    // Finalize stats for each player
    for (const playerName of players) {
        const s = stats[playerName];
        
        const todayKeyStr = String(startOfDayTimestamp);
        s.dailyEloChange = s.dailyDeltas[todayKeyStr] || 0;

        const dailyEntries = Object.entries(s.dailyDeltas)
            .map(([dayKey, delta]) => ({ day: Number(dayKey), delta }))
            .sort((a, b) => a.day - b.day);

        let positiveRun = 0;
        for (let idx = dailyEntries.length - 1; idx >= 0; idx--) {
            if (dailyEntries[idx].delta > 0) {
                positiveRun++;
            } else {
                break;
            }
        }
        s.currentPositiveDayRun = positiveRun;

        let phoenix = { isActive: false, recoveredAmount: 0 };
        if (dailyEntries.length >= 2) {
            const latest = dailyEntries[dailyEntries.length - 1];
            const previous = dailyEntries[dailyEntries.length - 2];
            const recoveredToday = latest.day === startOfDayTimestamp;
            if (
                recoveredToday &&
                latest.delta > 0 &&
                previous.delta < 0 &&
                latest.delta > Math.abs(previous.delta)
            ) {
                phoenix = { isActive: true, recoveredAmount: latest.delta };
            }
        }
        s.phoenix = phoenix;
        s.currentAlternatingRun = s.alternatingRunLength || 0;
        
        // Streakyness
        const n = s.winCount + s.lossCount;
        if (n >= 2) {
            const pConsecutive = s.consecutiveSame / (n - 1);
            const pWin = s.winCount / n;
            const pLoss = s.lossCount / n;
            const pRandomSame = (pWin * pWin) + (pLoss * pLoss);
            s.streakyness = pRandomSame === 0 ? { score: 1, totalWins: s.winCount, totalLosses: s.lossCount }
                : { score: pConsecutive / pRandomSame, totalWins: s.winCount, totalLosses: s.lossCount };
        } else {
            s.streakyness = { score: 1, totalWins: s.winCount, totalLosses: s.lossCount };
        }
        // Golden ratio
        const totalGolden = s.goldenCounts.won54 + s.goldenCounts.lost45;
        s.goldenRatio = totalGolden === 0 ? null : s.goldenCounts.won54 / totalGolden;
        // Comeback percentage
        s.comebackPercentage = s.comebackCounts.games === 0 ? null : s.comebackCounts.wins / s.comebackCounts.games;
        // Avg time between goals
        s.avgTimeBetweenGoals = {
            avgTimePerTeamGoal: s.avgTimeBetweenGoals.totalTeamGoals > 0 ? s.avgTimeBetweenGoals.totalTimePlayed / s.avgTimeBetweenGoals.totalTeamGoals : null,
            avgTimePerOpponentGoal: s.avgTimeBetweenGoals.totalOpponentGoals > 0 ? s.avgTimeBetweenGoals.totalTimePlayed / s.avgTimeBetweenGoals.totalOpponentGoals : null
        };
        
        // Determine if player is active (played within last 2 weeks)
        const inactiveThresholdMs = INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
        const activityCutoff = Date.now() - inactiveThresholdMs;
        s.isActive = s.lastPlayed && s.lastPlayed >= activityCutoff;
        
        // Remove helper fields
        delete s.streakType;
        delete s.streakLength;
        delete s.currentWinStreak;
        delete s.currentLossStreak;
        delete s.longestWinStreak;
        delete s.longestLossStreak;
        delete s.winCount;
        delete s.lossCount;
        delete s.consecutiveSame;
        delete s.lastResult;
        delete s.goldenCounts;
        delete s.comebackCounts;
        delete s.avgTimeBetweenGoals.totalTimePlayed;
        delete s.avgTimeBetweenGoals.totalTeamGoals;
        delete s.avgTimeBetweenGoals.totalOpponentGoals;
        delete s.dailyDeltas;
        delete s.alternatingRunLength;
        delete s.lastAlternatingResult;
    }
    const endTime = performance.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(3);
    console.log(`computeAllPlayerStats: total time taken = ${elapsedSeconds} seconds`);
    console.debug(stats)
    return stats;
}

function computeMaxDeficits(goalLog) {
    if (!Array.isArray(goalLog) || goalLog.length === 0) {
        return { A: 0, B: 0 };
    }
    let teamAGoals = 0;
    let teamBGoals = 0;
    let maxDeficitA = 0;
    let maxDeficitB = 0;
    for (const goal of goalLog) {
        if (goal.team === 'red') {
            teamAGoals++;
        } else if (goal.team === 'blue') {
            teamBGoals++;
        } else {
            continue;
        }
        maxDeficitA = Math.max(maxDeficitA, teamBGoals - teamAGoals);
        maxDeficitB = Math.max(maxDeficitB, teamAGoals - teamBGoals);
    }
    return { A: maxDeficitA, B: maxDeficitB };
}
