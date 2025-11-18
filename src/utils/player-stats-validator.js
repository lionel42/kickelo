/**
 * Debugging utility for computeAllPlayerStats
 * This file helps validate the batch function against the original individual functions
 */

import { computeAllPlayerStats } from '../player-stats-batch.js';
import { STARTING_ELO } from '../constants.js';

/**
 * Validates the output structure and data integrity
 */
export function validateStats(stats, matches) {
    const errors = [];
    const warnings = [];
    
    console.log('\n=== Validation Report ===\n');
    
    for (const [playerName, s] of Object.entries(stats)) {
        console.log(`Validating ${playerName}...`);
        
        // 1. Check that elo trajectory is in chronological order
        for (let i = 1; i < s.eloTrajectory.length; i++) {
            if (s.eloTrajectory[i].timestamp < s.eloTrajectory[i-1].timestamp) {
                errors.push(`${playerName}: Elo trajectory timestamps out of order at index ${i}`);
            }
        }
        
        // 2. Check that all elo values are numbers
        for (const point of s.eloTrajectory) {
            if (typeof point.elo !== 'number' || isNaN(point.elo)) {
                errors.push(`${playerName}: Invalid elo value ${point.elo}`);
            }
        }
        
        // 3. Validate win/loss counts - Note: winLossRatios count per opponent,
        // so in 2v2 matches, each match counts as 2 (one for each opponent)
        // We can check that the total is consistent with number of matches
        const totalWins = s.streakyness.totalWins;
        const totalLosses = s.streakyness.totalLosses;
        const totalMatches = totalWins + totalLosses;
        const totalFromRatios = Object.values(s.winLossRatios).reduce((sum, r) => sum + r.wins + r.losses, 0);
        
        // The ratio should be consistent (all 1v1, all 2v2, or mixed)
        // For now, just check that ratios exist and are reasonable
        if (totalFromRatios === 0 && totalMatches > 0) {
            warnings.push(`${playerName}: Has matches but no opponent ratios recorded`);
        }
        
        // 4. Check elo trajectory length matches total games
        const expectedGames = totalWins + totalLosses;
        if (s.eloTrajectory.length !== expectedGames) {
            errors.push(`${playerName}: Elo trajectory length (${s.eloTrajectory.length}) doesn't match total games (${expectedGames})`);
        }
        
        // 5. Validate highest elo is actually the highest
        const actualHighest = Math.max(...s.eloTrajectory.map(p => p.elo));
        if (s.highestElo !== actualHighest) {
            errors.push(`${playerName}: Highest elo mismatch. Stored: ${s.highestElo}, Actual: ${actualHighest}`);
        }
        
        // 6. Check that current streak matches the actual last matches
        const relevantMatches = matches.filter(m => 
            m.teamA.includes(playerName) || m.teamB.includes(playerName)
        );
        if (relevantMatches.length > 0) {
            const lastMatch = relevantMatches[0];
            const isTeamA = lastMatch.teamA.includes(playerName);
            const lastWon = (isTeamA && lastMatch.winner === 'A') || (!isTeamA && lastMatch.winner === 'B');
            const expectedStreakType = lastWon ? 'win' : 'loss';
            
            if (s.currentStreak.type !== expectedStreakType) {
                errors.push(`${playerName}: Current streak type mismatch. Expected: ${expectedStreakType}, Got: ${s.currentStreak.type}`);
            }
        }
        
        // 7. Validate golden ratio is between 0 and 1
        if (s.goldenRatio !== null && (s.goldenRatio < 0 || s.goldenRatio > 1)) {
            errors.push(`${playerName}: Golden ratio out of range: ${s.goldenRatio}`);
        }
        
        // 8. Validate comeback percentage is between 0 and 1
        if (s.comebackPercentage !== null && (s.comebackPercentage < 0 || s.comebackPercentage > 1)) {
            errors.push(`${playerName}: Comeback percentage out of range: ${s.comebackPercentage}`);
        }
        
        // 9. Check that goal stats make sense
        if (s.goalStats.goalsFor < 0 || s.goalStats.goalsAgainst < 0) {
            errors.push(`${playerName}: Negative goals: For=${s.goalStats.goalsFor}, Against=${s.goalStats.goalsAgainst}`);
        }
        
        // 10. Validate streakyness score is positive
        if (s.streakyness.score < 0) {
            errors.push(`${playerName}: Negative streakyness score: ${s.streakyness.score}`);
        }
        
        // 11. Check longest streaks are at least as long as current streak
        if (s.currentStreak.type === 'win' && s.currentStreak.length > s.longestStreaks.longestWinStreak) {
            errors.push(`${playerName}: Current win streak (${s.currentStreak.length}) longer than longest (${s.longestStreaks.longestWinStreak})`);
        }
        if (s.currentStreak.type === 'loss' && s.currentStreak.length > s.longestStreaks.longestLossStreak) {
            errors.push(`${playerName}: Current loss streak (${s.currentStreak.length}) longer than longest (${s.longestStreaks.longestLossStreak})`);
        }
        
        // Warnings
        if (totalWins === 0 && totalLosses === 0) {
            warnings.push(`${playerName}: No matches played`);
        }
        
        if (s.eloTrajectory.length > 0) {
            const startElo = s.eloTrajectory[0].elo;
            const endElo = s.eloTrajectory[s.eloTrajectory.length - 1].elo;
            const eloChange = endElo - startElo;
            
            if (Math.abs(eloChange) > 500) {
                warnings.push(`${playerName}: Large elo change: ${eloChange > 0 ? '+' : ''}${eloChange}`);
            }
        }
    }
    
    console.log('\n--- Results ---');
    console.log(`✓ Validated ${Object.keys(stats).length} players`);
    
    if (errors.length > 0) {
        console.log(`\n❌ ${errors.length} ERRORS:`);
        errors.forEach(err => console.log(`  - ${err}`));
    } else {
        console.log('\n✓ No errors found!');
    }
    
    if (warnings.length > 0) {
        console.log(`\n⚠ ${warnings.length} WARNINGS:`);
        warnings.forEach(warn => console.log(`  - ${warn}`));
    }
    
    return { errors, warnings, valid: errors.length === 0 };
}

/**
 * Prints a detailed summary of stats for debugging
 */
export function printDetailedStats(stats, playerName) {
    const s = stats[playerName];
    if (!s) {
        console.log(`Player ${playerName} not found in stats`);
        return;
    }
    
    console.log(`\n=== Detailed Stats for ${playerName} ===\n`);
    
    console.log('Elo Trajectory:');
    s.eloTrajectory.forEach((point, i) => {
        const date = new Date(point.timestamp).toLocaleTimeString();
        console.log(`  ${i + 1}. ${point.elo} at ${date}`);
    });
    
    console.log(`\nStreaks:`);
    console.log(`  Current: ${s.currentStreak.type} × ${s.currentStreak.length}`);
    console.log(`  Longest Win: ${s.longestStreaks.longestWinStreak}`);
    console.log(`  Longest Loss: ${s.longestStreaks.longestLossStreak}`);
    
    console.log(`\nPerformance:`);
    console.log(`  Record: ${s.streakyness.totalWins}W - ${s.streakyness.totalLosses}L`);
    console.log(`  Win Rate: ${(s.streakyness.totalWins / (s.streakyness.totalWins + s.streakyness.totalLosses) * 100).toFixed(1)}%`);
    console.log(`  Streakyness: ${s.streakyness.score.toFixed(2)}`);
    
    console.log(`\nElo:`);
    const currentElo = s.eloTrajectory.length > 0 ? s.eloTrajectory[s.eloTrajectory.length - 1].elo : STARTING_ELO;
    console.log(`  Current: ${currentElo}`);
    console.log(`  Highest: ${s.highestElo}`);
    console.log(`  Daily Change: ${s.dailyEloChange > 0 ? '+' : ''}${s.dailyEloChange}`);
    
    console.log(`\nGoals:`);
    console.log(`  For: ${s.goalStats.goalsFor}`);
    console.log(`  Against: ${s.goalStats.goalsAgainst}`);
    console.log(`  Differential: ${s.goalStats.goalsFor - s.goalStats.goalsAgainst > 0 ? '+' : ''}${s.goalStats.goalsFor - s.goalStats.goalsAgainst}`);
    
    console.log(`\nSpecial Stats:`);
    console.log(`  Golden Ratio: ${s.goldenRatio !== null ? (s.goldenRatio * 100).toFixed(1) + '%' : 'N/A'}`);
    console.log(`  Comeback %: ${s.comebackPercentage !== null ? (s.comebackPercentage * 100).toFixed(1) + '%' : 'N/A'}`);
    
    if (s.avgTimeBetweenGoals.avgTimePerTeamGoal !== null) {
        console.log(`\nGoal Timing:`);
        console.log(`  Team Goals: ${(s.avgTimeBetweenGoals.avgTimePerTeamGoal / 1000).toFixed(1)}s`);
        console.log(`  Opponent Goals: ${(s.avgTimeBetweenGoals.avgTimePerOpponentGoal / 1000).toFixed(1)}s`);
    }
}

/**
 * Compare two stat objects (for comparing old vs new implementation)
 */
export function compareStats(oldStats, newStats, playerName) {
    console.log(`\n=== Comparing Stats for ${playerName} ===\n`);
    
    const fields = [
        { key: 'highestElo', label: 'Highest Elo' },
        { key: 'dailyEloChange', label: 'Daily Elo Change' },
        { key: 'goldenRatio', label: 'Golden Ratio' },
        { key: 'comebackPercentage', label: 'Comeback %' },
        { key: 'streakyness.score', label: 'Streakyness' },
        { key: 'streakyness.totalWins', label: 'Total Wins' },
        { key: 'streakyness.totalLosses', label: 'Total Losses' },
    ];
    
    let differences = 0;
    
    for (const field of fields) {
        const oldVal = field.key.includes('.') 
            ? field.key.split('.').reduce((obj, key) => obj?.[key], oldStats)
            : oldStats[field.key];
        const newVal = field.key.includes('.')
            ? field.key.split('.').reduce((obj, key) => obj?.[key], newStats)
            : newStats[field.key];
        
        const match = Math.abs(oldVal - newVal) < 0.01;
        const icon = match ? '✓' : '✗';
        
        if (!match) differences++;
        
        console.log(`${icon} ${field.label}: ${oldVal} → ${newVal}`);
    }
    
    console.log(`\n${differences === 0 ? '✓ All fields match!' : `✗ ${differences} differences found`}`);
}
