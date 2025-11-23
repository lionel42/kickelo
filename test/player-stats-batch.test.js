import { computeAllPlayerStats } from '../src/player-stats-batch.js';
import { validateStats, printDetailedStats } from '../src/utils/player-stats-validator.js';

// Mock MAX_GOALS for testing
const MAX_GOALS = 5;

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
            goalsA: 5,
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
                { team: 'red', timestamp: 40000 },
            ]
        },
        {
            id: 'match4',
            teamA: ['Alice', 'Charlie'],
            teamB: ['Bob', 'David'],
            winner: 'B',
            goalsA: 4,
            goalsB: 5,
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
            goalsA: 5,
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
            goalsA: 5,
            goalsB: 4,
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
            goalsB: 5,
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
    
    const stats = computeAllPlayerStats(matches);

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
    }

    const aliceFastWins = stats['Alice']?.statusEvents?.fastWinCount ?? 0;
    const bobFastWins = stats['Bob']?.statusEvents?.fastWinCount ?? 0;
    if (aliceFastWins < 1 || bobFastWins < 1) {
        throw new Error(`Expected Alice and Bob to earn a fast-win coffee badge (got Alice=${aliceFastWins}, Bob=${bobFastWins})`);
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
