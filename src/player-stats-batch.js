import { MAX_GOALS, STARTING_ELO, INACTIVE_THRESHOLD_DAYS } from "./constants.js";

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
            lastPlayed: null  // Will be set to the most recent match timestamp
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
        
        // Process each player involved in the match
        const allPlayersInMatch = [...match.teamA, ...match.teamB];
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
        
        // Calculate daily ELO change
        // Start with current ELO (last point in trajectory) and work backwards through today's matches
        const currentElo = s.eloTrajectory.length > 0 ? s.eloTrajectory[s.eloTrajectory.length - 1].elo : STARTING_ELO;
        let eloAtStartOfDay = currentElo;
        
        // Work backwards through today's matches (matches are sorted newest first)
        for (const match of matches) {
            const isToday = match.timestamp >= startOfDayTimestamp;
            if (!isToday) break; // matches are sorted newest first, so we can stop
            
            if (!Array.isArray(match.teamA) || !Array.isArray(match.teamB)) continue;
            
            // Check if this player was in this match
            const isTeamA = match.teamA.includes(playerName);
            const isTeamB = match.teamB.includes(playerName);
            if (!isTeamA && !isTeamB) continue; // Player not in this match
            
            const team = isTeamA ? 'A' : 'B';
            const playerWasWinner = (team === match.winner);
            const eloDelta = match.eloDelta || 0;
            
            // Work backwards: if they won, subtract delta; if they lost, add delta
            if (playerWasWinner) eloAtStartOfDay -= eloDelta;
            else eloAtStartOfDay += eloDelta;
        }
        
        s.dailyEloChange = currentElo - eloAtStartOfDay;
        
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
    }
    const endTime = performance.now();
    const elapsedSeconds = ((endTime - startTime) / 1000).toFixed(3);
    console.log(`computeAllPlayerStats: total time taken = ${elapsedSeconds} seconds`);
    console.debug(stats)
    return stats;
}
