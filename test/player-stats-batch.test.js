import { computeAllPlayerStats } from '../src/player-stats-batch.js';
import { validateStats, printDetailedStats } from '../src/utils/player-stats-validator.js';
import { BADGE_THRESHOLDS, MAX_GOALS } from '../src/constants.js';

/**
 * Create test matches to validate the function
 */
function createTestMatches() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    
    // Matches are sorted newest first (as they come from Firestore)
    return [
        // Today's matches (newest)
        {
            id: 'match5',
            teamA: ['Alice', 'Bob'],
            teamB: ['Charlie', 'David'],
            winner: 'A',
            goalsA: MAX_GOALS,
            goalsB: 3,
            eloDelta: 20,
            timestamp: now - oneHour,
            goalLog: [
                { team: 'red', timestamp: 5000 },
                { team: 'blue', timestamp: 10000 },
                { team: 'red', timestamp: 15000 },
                { team: 'blue', timestamp: 20000 },
                { team: 'red', timestamp: 25000 },
                { team: 'blue', timestamp: 30000 },
                { team: 'red', timestamp: 35000 },
                ...Array(MAX_GOALS - 4).fill(null).map((_, i) => ({ team: 'red', timestamp: 40000 + i * 5000 }))
            ]
        },
        {
            id: 'match4',
            teamA: ['Alice', 'Charlie'],
            teamB: ['Bob', 'David'],
            winner: 'B',
            goalsA: MAX_GOALS - 1,
            goalsB: MAX_GOALS,
            eloDelta: 25,
            timestamp: now - (2 * oneHour),
            goalLog: []
        },
        // Yesterday's matches
        {
            id: 'match3',
            teamA: ['Alice', 'Bob'],
            teamB: ['Charlie', 'David'],
            winner: 'A',
            goalsA: MAX_GOALS,
            goalsB: 2,
            eloDelta: 15,
            timestamp: now - oneDay - oneHour,
            goalLog: []
        },
        {
            id: 'match2',
            teamA: ['Bob', 'Charlie'],
            teamB: ['Alice', 'David'],
            winner: 'A',
            goalsA: MAX_GOALS,
            goalsB: MAX_GOALS - 1,
            eloDelta: 18,
            timestamp: now - oneDay - (2 * oneHour),
            goalLog: []
        },
        // 2 days ago
        {
            id: 'match1',
            teamA: ['Alice', 'Charlie'],
            teamB: ['Bob', 'David'],
            winner: 'B',
            goalsA: 3,
            goalsB: MAX_GOALS,
            eloDelta: 22,
            timestamp: now - (2 * oneDay),
            goalLog: []
        },
    ];
}

/**
 * Test the function and print results
 */
function testComputeAllPlayerStats() {
    console.log('=== Testing computeAllPlayerStats ===\n');
    
    const matches = createTestMatches();
    console.log(`Created ${matches.length} test matches`);
    console.log(`Players in matches: ${[...new Set(matches.flatMap(m => [...m.teamA, ...m.teamB]))].join(', ')}\n`);
    
    const { players: stats, teams: teamStats } = computeAllPlayerStats(matches);

    for (const [playerName, playerStats] of Object.entries(stats)) {
        if (!playerStats.statusEvents) {
            throw new Error(`${playerName} missing statusEvents payload`);
        }
        if (typeof playerStats.statusEvents.fastWinCount === 'undefined') {
            throw new Error(`${playerName} missing fastWinCount status event`);
        }
        if (typeof playerStats.currentAlternatingRun === 'undefined') {
            throw new Error(`${playerName} missing currentAlternatingRun`);
        }
        if (typeof playerStats.currentPositiveDayRun === 'undefined') {
            throw new Error(`${playerName} missing currentPositiveDayRun`);
        }
        if (!playerStats.phoenix || typeof playerStats.phoenix.isActive === 'undefined') {
            throw new Error(`${playerName} missing phoenix status`);
        }
        if (!playerStats.openskillRating || typeof playerStats.openskillRating.mu !== 'number') {
            throw new Error(`${playerName} missing OpenSkill rating snapshot`);
        }
        if (!Array.isArray(playerStats.openskillTrajectory)) {
            throw new Error(`${playerName} missing OpenSkill trajectory data`);
        }
        if (!playerStats.roleElo || typeof playerStats.roleElo.offense !== 'number' || typeof playerStats.roleElo.defense !== 'number') {
            throw new Error(`${playerName} missing role-specific Elo ratings`);
        }
        if (!playerStats.roleEloTrajectory || !Array.isArray(playerStats.roleEloTrajectory.offense) || !Array.isArray(playerStats.roleEloTrajectory.defense)) {
            throw new Error(`${playerName} missing role-specific Elo trajectories`);
        }
    }

    const aliceFastWins = stats['Alice']?.statusEvents?.fastWinCount ?? 0;
    const bobFastWins = stats['Bob']?.statusEvents?.fastWinCount ?? 0;
    if (aliceFastWins < 1 || bobFastWins < 1) {
        throw new Error(`Expected Alice and Bob to earn a fast-win coffee badge (got Alice=${aliceFastWins}, Bob=${bobFastWins})`);
    }

    const aliceBobTeam = Object.values(teamStats).find(team =>
        Array.isArray(team.players) && team.players.includes('Alice') && team.players.includes('Bob')
    );
    if (!aliceBobTeam) {
        throw new Error('Expected Alice & Bob team Elo entry to exist');
    }
    if ((aliceBobTeam.games || 0) === 0) {
        throw new Error('Expected Alice & Bob to have at least one recorded team game');
    }
    
    console.log('\n=== Results for each player ===\n');
    
    for (const [playerName, playerStats] of Object.entries(stats)) {
        console.log(`\n--- ${playerName} ---`);
        console.log(`Elo Trajectory (${playerStats.eloTrajectory.length} points):`);
        playerStats.eloTrajectory.forEach((point, idx) => {
            const date = new Date(point.timestamp).toLocaleString();
            console.log(`  ${idx}: ${point.elo} at ${date}`);
        });
        
        console.log(`\nCurrent Streak: ${playerStats.currentStreak.type} streak of ${playerStats.currentStreak.length}`);
        console.log(`Longest Streaks: Win=${playerStats.longestStreaks.longestWinStreak}, Loss=${playerStats.longestStreaks.longestLossStreak}`);
        
        console.log(`\nDaily ELO Change: ${playerStats.dailyEloChange > 0 ? '+' : ''}${playerStats.dailyEloChange}`);
        console.log(`Highest ELO Ever: ${playerStats.highestElo}`);
        
        console.log(`\nStreakyness: ${playerStats.streakyness.score.toFixed(2)} (Wins: ${playerStats.streakyness.totalWins}, Losses: ${playerStats.streakyness.totalLosses})`);
        
        console.log(`\nGoal Stats: For=${playerStats.goalStats.goalsFor}, Against=${playerStats.goalStats.goalsAgainst}`);
        console.log(`Result Histogram:`, playerStats.goalStats.resultHistogram);
        
        console.log(`\nGolden Ratio: ${playerStats.goldenRatio !== null ? (playerStats.goldenRatio * 100).toFixed(1) + '%' : 'N/A'}`);
        console.log(`Comeback %: ${playerStats.comebackPercentage !== null ? (playerStats.comebackPercentage * 100).toFixed(1) + '%' : 'N/A'}`);
        
        console.log(`\nWin/Loss vs Opponents:`);
        for (const [opp, record] of Object.entries(playerStats.winLossRatios)) {
            console.log(`  vs ${opp}: ${record.wins}W - ${record.losses}L`);
        }
        
        console.log(`\nWin/Loss with Teammates:`);
        for (const [teammate, record] of Object.entries(playerStats.winLossRatiosWithTeammates)) {
            console.log(`  with ${teammate}: ${record.wins}W - ${record.losses}L`);
        }
        
        console.log(`\nElo Gains/Losses:`);
        for (const [opp, elo] of Object.entries(playerStats.eloGainsAndLosses)) {
            console.log(`  vs ${opp}: ${elo > 0 ? '+' : ''}${elo.toFixed(1)}`);
        }
        
        if (playerStats.avgTimeBetweenGoals) {
            console.log(`\nAvg Time Between Goals:`);
            console.log(`  Team: ${playerStats.avgTimeBetweenGoals.avgTimePerTeamGoal !== null ? (playerStats.avgTimeBetweenGoals.avgTimePerTeamGoal / 1000).toFixed(1) + 's' : 'N/A'}`);
            console.log(`  Opponent: ${playerStats.avgTimeBetweenGoals.avgTimePerOpponentGoal !== null ? (playerStats.avgTimeBetweenGoals.avgTimePerOpponentGoal / 1000).toFixed(1) + 's' : 'N/A'}`);
        }
    }
    
    // Run validation
    const validation = validateStats(stats, matches);
    
    if (validation.valid) {
        console.log('\n\n✅ All validation checks passed!\n');
    } else {
        console.log('\n\n❌ Validation failed. Please review errors above.\n');
    }
    
    // Print detailed stats for one player as example
    console.log('\n--- Example Detailed View ---');
    printDetailedStats(stats, 'Alice');
    
    console.log('\n=== Test Complete ===');
}

// Run the test
testComputeAllPlayerStats();

function testBadgeScenarios() {
    console.log('\n=== Testing badge-specific scenarios ===\n');
    const matches = createBadgeScenarioMatches();
    const { players: stats } = computeAllPlayerStats(matches);
    const aliceStats = stats['Alice'];
    if (!aliceStats) {
        throw new Error('Alice missing from badge scenario stats');
    }

    const medicThreshold = BADGE_THRESHOLDS?.medic?.minUniqueTeammates ?? 3;
    if ((aliceStats.medicTeammatesHelped || 0) < medicThreshold) {
        throw new Error(`Expected Alice to have Medic badge with ≥${medicThreshold} teammates helped (got ${aliceStats.medicTeammatesHelped || 0})`);
    }

    const gardenerThreshold = BADGE_THRESHOLDS?.gardener?.requiredWeekdays ?? 5;
    if ((aliceStats.gardenerWeekdayStreak || 0) < gardenerThreshold) {
        throw new Error(`Expected Alice to have Gardener streak ≥${gardenerThreshold} (got ${aliceStats.gardenerWeekdayStreak || 0})`);
    }

    const goldenThreshold = BADGE_THRESHOLDS?.goldenPhi?.minWins ?? 3;
    if ((aliceStats.goldenPhiStreak || 0) < goldenThreshold) {
        throw new Error(`Expected Alice to have Golden Phi streak ≥${goldenThreshold} (got ${aliceStats.goldenPhiStreak || 0})`);
    }

    if ((aliceStats.statusEvents?.rollercoasterCount || 0) < 1) {
        throw new Error('Expected at least one Rollercoaster event for Alice');
    }
    if ((aliceStats.statusEvents?.chillComebackCount || 0) < 1) {
        throw new Error('Expected at least one Chill Comeback event for Alice');
    }

    console.log('✓ Badge scenario assertions passed');
}

testBadgeScenarios();

function createBadgeScenarioMatches() {
    const matches = [];
    const HOUR = 60 * 60 * 1000;
    const medicLossLength = BADGE_THRESHOLDS?.medic?.teammateLossStreakLength ?? 3;
    const weekdayCount = BADGE_THRESHOLDS?.gardener?.requiredWeekdays ?? 5;
    const minWeekdays = Math.max(weekdayCount, 3);
    const weekdayTimestamps = getRecentWeekdayTimestamps(minWeekdays);
    const opponents = ['Henry', 'Ivan'];

    const bobWinTs = weekdayTimestamps[0];
    const charlieWinTs = weekdayTimestamps[1];
    const davidWinTs = weekdayTimestamps[2];

    addLossSeries(matches, 'Bob', 'Eve', opponents, bobWinTs, medicLossLength, HOUR);
    addMatch(matches, {
        id: 'bob-medic-win',
        teamA: ['Alice', 'Bob'],
        teamB: opponents,
        winner: 'A',
        goalsA: MAX_GOALS,
        goalsB: MAX_GOALS - 1,
        timestamp: bobWinTs
    });

    addLossSeries(matches, 'Charlie', 'Fiona', opponents, charlieWinTs, medicLossLength, HOUR);
    addMatch(matches, {
        id: 'charlie-medic-win',
        teamA: ['Alice', 'Charlie'],
        teamB: opponents,
        winner: 'A',
        goalsA: MAX_GOALS,
        goalsB: MAX_GOALS - 1,
        timestamp: charlieWinTs
    });

    addLossSeries(matches, 'David', 'Gina', opponents, davidWinTs, medicLossLength, HOUR);
    addMatch(matches, {
        id: 'david-medic-win',
        teamA: ['Alice', 'David'],
        teamB: opponents,
        winner: 'A',
        goalsA: MAX_GOALS,
        goalsB: MAX_GOALS - 1,
        timestamp: davidWinTs
    });

    for (let i = 3; i < weekdayTimestamps.length; i++) {
        addMatch(matches, {
            id: `gardener-extra-${i}`,
            teamA: ['Alice', 'Eve'],
            teamB: ['Grace', 'Henry'],
            winner: 'A',
            goalsA: MAX_GOALS,
            goalsB: 2,
            timestamp: weekdayTimestamps[i]
        });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const rollerTimestamp = todayStart.getTime() + HOUR;
    const chillTimestamp = rollerTimestamp + HOUR;

    // Rollercoaster: alternating lead changes (red-blue-blue-red-red-blue-blue-red...)
    // Total goals = MAX_GOALS + (MAX_GOALS - 1)
    const rollerSequence = [];
    for (let i = 0; i < MAX_GOALS + (MAX_GOALS - 1); i++) {
        if (i < 2) rollerSequence.push(i % 2 === 0 ? 'red' : 'blue');
        else rollerSequence.push(Math.floor((i - 2) / 2) % 2 === 0 ? 'red' : 'blue');
    }
    // Ensure red wins with MAX_GOALS
    while (rollerSequence.filter(t => t === 'red').length < MAX_GOALS) {
        const blueIdx = rollerSequence.lastIndexOf('blue');
        if (blueIdx !== -1) rollerSequence[blueIdx] = 'red';
    }

    addMatch(matches, {
        id: 'rollercoaster-today',
        teamA: ['Alice', 'Bob'],
        teamB: ['Charlie', 'David'],
        winner: 'A',
        goalsA: MAX_GOALS,
        goalsB: MAX_GOALS - 1,
        timestamp: rollerTimestamp,
        goalSequence: rollerSequence
    });

    // Chill comeback: blue leads entire game until red scores last goals to win
    // Blue gets (MAX_GOALS - 1) goals first, then red gets MAX_GOALS
    const chillSequence = [
        ...Array(MAX_GOALS - 1).fill('blue'),
        ...Array(MAX_GOALS).fill('red')
    ];

    addMatch(matches, {
        id: 'chill-today',
        teamA: ['Alice', 'Bob'],
        teamB: ['Charlie', 'David'],
        winner: 'A',
        goalsA: MAX_GOALS,
        goalsB: MAX_GOALS - 1,
        timestamp: chillTimestamp,
        goalSequence: chillSequence
    });

    return matches.sort((a, b) => b.timestamp - a.timestamp);
}

function addLossSeries(matches, player, teammate, opponents, winTimestamp, lossCount, HOUR) {
    const startTs = winTimestamp - (lossCount + 1) * HOUR;
    for (let i = 0; i < lossCount; i++) {
        addMatch(matches, {
            id: `${player}-loss-${i}`,
            teamA: [player, teammate],
            teamB: opponents,
            winner: 'B',
            goalsA: 2,
            goalsB: MAX_GOALS,
            timestamp: startTs + i * HOUR
        });
    }
}

function addMatch(matches, match) {
    const goalLog = match.goalLog || (match.goalSequence ? buildGoalLog(match.goalSequence) : undefined);
    const entry = {
        eloDelta: match.eloDelta ?? 20,
        ...match,
        goalLog
    };
    delete entry.goalSequence;
    matches.push(entry);
}

function buildGoalLog(sequence) {
    if (!sequence) return undefined;
    return sequence.map((team, idx) => ({ team, timestamp: (idx + 1) * 5000 }));
}

function getRecentWeekdayTimestamps(count) {
    const results = [];
    const cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    while (!isWeekday(cursor)) {
        cursor.setDate(cursor.getDate() - 1);
    }
    while (results.length < count) {
        results.unshift(cursor.getTime());
        cursor.setDate(cursor.getDate() - 1);
        while (!isWeekday(cursor)) {
            cursor.setDate(cursor.getDate() - 1);
        }
        cursor.setHours(12, 0, 0, 0);
    }
    return results;
}

function isWeekday(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
}
