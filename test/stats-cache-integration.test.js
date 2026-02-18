/**
 * Integration Test for Stats Cache
 * 
 * This test verifies that the stats cache service integrates properly
 * with the batch computation and can be used by UI components.
 */

import { updateStatsCache, getCachedStats, getAllCachedStats, isCacheReady, getCacheInfo, getAllTeamEloStats } from '../src/stats-cache-service.js';
import { MAX_GOALS } from '../src/constants.js';

// Create test matches
function createTestMatches() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    
    return [
        {
            id: 'match3',
            teamA: ['Alice', 'Bob'],
            teamB: ['Charlie', 'David'],
            winner: 'A',
            goalsA: MAX_GOALS,
            goalsB: 3,
            eloDelta: 20,
            timestamp: now - oneHour,
            goalLog: []
        },
        {
            id: 'match2',
            teamA: ['Alice', 'Charlie'],
            teamB: ['Bob', 'David'],
            winner: 'B',
            goalsA: MAX_GOALS - 1,
            goalsB: MAX_GOALS,
            eloDelta: 25,
            timestamp: now - (2 * oneHour),
            goalLog: []
        },
        {
            id: 'match1',
            teamA: ['Alice', 'Bob'],
            teamB: ['Charlie', 'David'],
            winner: 'A',
            goalsA: MAX_GOALS,
            goalsB: 2,
            eloDelta: 15,
            timestamp: now - oneDay,
            goalLog: []
        },
    ];
}

console.log('=== Stats Cache Integration Test ===\n');

// Test 1: Cache initialization
console.log('Test 1: Initialize cache');
const matches = createTestMatches();
updateStatsCache(matches);

if (isCacheReady()) {
    console.log('✓ Cache initialized successfully');
} else {
    console.error('✗ Cache failed to initialize');
    process.exit(1);
}

// Test 2: Cache info
console.log('\nTest 2: Get cache info');
const info = getCacheInfo();
console.log(`  Players in cache: ${info.playerCount}`);
console.log(`  Compute time: ${info.lastComputeTime.toFixed(2)}ms`);
console.log(`  Players: ${info.playerNames.join(', ')}`);

if (info.playerCount === 4 && info.playerNames.includes('Alice')) {
    console.log('✓ Cache info correct');
} else {
    console.error('✗ Cache info incorrect');
    process.exit(1);
}

// Test 3: Get individual player stats
console.log('\nTest 3: Get individual player stats');
const aliceStats = getCachedStats('Alice');

if (aliceStats && aliceStats.eloTrajectory && aliceStats.currentStreak) {
    console.log(`  Alice's trajectory has ${aliceStats.eloTrajectory.length} points`);
    console.log(`  Alice's streak: ${aliceStats.currentStreak.type} × ${aliceStats.currentStreak.length}`);
    console.log(`  Alice's daily change: ${aliceStats.dailyEloChange > 0 ? '+' : ''}${aliceStats.dailyEloChange}`);
    console.log('✓ Individual stats retrieved correctly');
} else {
    console.error('✗ Failed to get individual stats');
    process.exit(1);
}

// Test 4: Get all stats
console.log('\nTest 4: Get all cached stats');
const allStats = getAllCachedStats();

if (Object.keys(allStats).length === 4) {
    console.log(`  Retrieved stats for all ${Object.keys(allStats).length} players`);
    console.log('✓ Bulk stats retrieval works');
} else {
    console.error('✗ Bulk stats retrieval failed');
    process.exit(1);
}

console.log('\nTest 4b: Get team Elo stats');
const allTeamStats = getAllTeamEloStats();
const teamEntries = Object.keys(allTeamStats);
if (teamEntries.length > 0) {
    console.log(`  Retrieved ${teamEntries.length} team entries`);
    console.log('✓ Team stats retrieval works');
} else {
    console.error('✗ Expected at least one team Elo entry');
    process.exit(1);
}

// Test 5: Verify stats match expectations
console.log('\nTest 5: Verify stats correctness');
let allCorrect = true;

for (const [playerName, stats] of Object.entries(allStats)) {
    // Check that essential fields exist
    if (!stats.eloTrajectory || !stats.currentStreak || !stats.longestStreaks) {
        console.error(`✗ ${playerName} missing essential fields`);
        allCorrect = false;
    }
    
    // Check that trajectory has correct number of matches
    const playerMatches = matches.filter(m => 
        m.teamA.includes(playerName) || m.teamB.includes(playerName)
    ).length;
    
    if (stats.eloTrajectory.length !== playerMatches) {
        console.error(`✗ ${playerName} trajectory length mismatch: ${stats.eloTrajectory.length} vs ${playerMatches} matches`);
        allCorrect = false;
    }
}

if (allCorrect) {
    console.log('✓ All stats are structurally correct');
} else {
    process.exit(1);
}

// Test 6: Update cache with new matches
console.log('\nTest 6: Update cache with new match');
const updatedMatches = [
    {
        id: 'match4',
        teamA: ['Alice', 'Bob'],
        teamB: ['Charlie', 'David'],
        winner: 'B',
        goalsA: 3,
        goalsB: MAX_GOALS,
        eloDelta: 30,
        timestamp: Date.now(),
        goalLog: []
    },
    ...matches
];

updateStatsCache(updatedMatches);
const updatedAliceStats = getCachedStats('Alice');

if (updatedAliceStats.eloTrajectory.length === 4) {
    console.log(`  Alice's trajectory updated to ${updatedAliceStats.eloTrajectory.length} points`);
    console.log(`  Alice's new streak: ${updatedAliceStats.currentStreak.type} × ${updatedAliceStats.currentStreak.length}`);
    console.log('✓ Cache updates correctly');
} else {
    console.error('✗ Cache update failed');
    process.exit(1);
}

console.log('\n=== All Tests Passed ✓ ===');
console.log('\nIntegration test complete. The stats cache is working correctly!');
