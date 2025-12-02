# computeAllPlayerStats - Bug Fixes and Usage Guide

## Summary

The `computeAllPlayerStats` function has been debugged and refactored to compute all player statistics in a single pass through the match history. All validation checks now pass.

## Bugs Fixed

### 1. **Critical: Array Index Error (Line 78)**
**Problem:** `s.eloTrajectory[-1]` returns `undefined` in JavaScript (negative indices don't work)
**Fix:** Changed to `s.eloTrajectory[s.eloTrajectory.length - 1]`

### 2. **Critical: Double-Counting Matches**
**Problem:** Original code looped through teams A and B separately, processing each player twice per match
**Fix:** Refactored to iterate through all players in the match once, determining their team dynamically

### 3. **Major: Daily ELO Logic Was Inverted**
**Problem:** When calculating `eloAtStartOfDay`, the logic was backwards
**Fix:** Properly subtract from current ELO to get starting ELO: `eloBeforeThisMatch = currentElo - (playerWasWinner ? eloDelta : -eloDelta)`

### 4. **Major: Daily ELO Final Calculation Wrong**
**Problem:** Used hardcoded `1500 - s.eloAtStartOfDay` instead of actual current ELO
**Fix:** Changed to `currentElo - s.eloAtStartOfDay`

### 5. **Minor: Highest ELO Initialization**
**Problem:** Initialized to 1500, which could be incorrect for players who never reach that
**Fix:** Initialize to 0 and let it be set by the first match

### 6. **Minor: Missing Rounding for Highest ELO**
**Problem:** `highestElo` wasn't rounded when set
**Fix:** Added `Math.round()` when updating highest ELO

### 7. **Enhancement: Removed Optional Players Parameter**
**Problem:** Function required passing a players array
**Fix:** Automatically extracts all unique players from the matches array

### 8. **Enhancement: Added Defensive Checks**
**Problem:** No validation that team arrays exist
**Fix:** Added checks for `Array.isArray(match.teamA)` and `Array.isArray(match.teamB)`

## Function Signature

```javascript
/**
 * Computes all statistics for all players present in a list of matches.
 * Matches must be sorted by timestamp (newest first, as they come from Firestore).
 * @param {Array<Object>} matches - Array of match objects sorted by timestamp descending.
 * @returns {{ players: Object<string, Object>, teams: Object<string, Object> }}
 */
export function computeAllPlayerStats(matches)
```

## Usage

```javascript
import { computeAllPlayerStats } from './player-stats-batch.js';
import { allMatches } from './match-data-service.js';

// Compute stats for all players in the match history
const { players: stats, teams } = computeAllPlayerStats(allMatches);

// Access stats for a specific player
const aliceStats = stats['Alice'];
console.log(aliceStats.highestElo);
console.log(aliceStats.currentStreak);
console.log(aliceStats.streakyness);

// Access stats for a specific duo (team Elo)
const aliceBobKey = ['Alice', 'Bob'].sort().join('::');
const aliceBobTeam = teams[aliceBobKey];
console.log(aliceBobTeam?.rating);
```

## Return Value Structure

Each player's stats object contains:

```javascript
{
  // Elo data
  eloTrajectory: [{elo: number, timestamp: number}, ...],
  highestElo: number,
  dailyEloChange: number,
  
  // Win/Loss records
  winLossRatios: {opponentName: {wins: number, losses: number}, ...},
  winLossRatiosWithTeammates: {teammateName: {wins: number, losses: number}, ...},
  eloGainsAndLosses: {opponentName: number, ...},
  
  // Streaks
  currentStreak: {type: 'win'|'loss'|'none', length: number},
  longestStreaks: {longestWinStreak: number, longestLossStreak: number},
  
  // Performance metrics
  streakyness: {score: number, totalWins: number, totalLosses: number},
  goldenRatio: number|null,  // Ratio of 5-4 wins to all 5-4 games
  comebackPercentage: number|null,  // Win rate when falling behind
  
  // Goal stats
  goalStats: {
    goalsFor: number,
    goalsAgainst: number,
    resultHistogram: {'5:3': count, '4:5': count, ...}
  },
  
  // Timing stats
  avgTimeBetweenGoals: {
    avgTimePerTeamGoal: number|null,
    avgTimePerOpponentGoal: number|null
  },

  // Role-based ratings (offense / defense specific Elo)
  roleElo: {
    offense: number,
    defense: number
  },
  roleEloTrajectory: {
    offense: [{ rating: number, timestamp: number }],
    defense: [{ rating: number, timestamp: number }]
  },
  roleGames: {
    offense: number,
    defense: number
  }
}
```

In addition to per-player data, `computeAllPlayerStats` now returns a `teams` object keyed by a canonical `"PlayerA::PlayerB"` string. Each team entry looks like:

```javascript
{
  key: 'Alice::Bob',
  players: ['Alice', 'Bob'],
  rating: number,
  games: number,
  wins: number,
  losses: number,
  lastPlayed: timestamp,
  trajectory: [{ rating: number, timestamp: number }]
}
```

Teams accumulate Elo updates only when the pair has actually played together (2v2 matches) so the leaderboard can present duos that have at least five games logged.

## Testing & Debugging

Test files are located in the `test/` directory:

### Run Tests
```bash
npm run test:stats
```

Or directly:
```bash
node test/player-stats-batch.test.js
```

### Validate Output
```javascript
import { validateStats, printDetailedStats } from './src/utils/player-stats-validator.js';

const stats = computeAllPlayerStats(matches);
const validation = validateStats(stats, matches);

if (validation.valid) {
  console.log('✅ All checks passed!');
} else {
  console.log('❌ Errors found:', validation.errors);
}

// Print detailed view for a player
printDetailedStats(stats, 'Alice');
```

## Performance

The function includes built-in performance tracking:
- Processes hundreds of matches in milliseconds
- Single-pass algorithm: O(N × M) where N = players, M = matches
- Previous approach: O(N × M × S) where S ≈ 12 separate stat functions

Example output:
```
computeAllPlayerStats: total time taken = 0.001 seconds
```

## Validation Checks

The debug utilities perform comprehensive validation:
- ✓ Elo trajectory timestamps in chronological order
- ✓ All ELO values are valid numbers
- ✓ ELO trajectory length matches total games played
- ✓ Highest ELO is actually the maximum in trajectory
- ✓ Current streak type matches most recent match result
- ✓ Golden ratio and comeback percentage are in valid range [0, 1]
- ✓ Goal stats are non-negative
- ✓ Streakyness score is positive
- ✓ Current streak length ≤ longest streak of that type

## Integration with Existing Code

To integrate with the current codebase:

1. **In `match-data-service.js`**: Uncomment the batch computation
   ```javascript
   window.dispatchEvent(new CustomEvent('matches-updated'));
   
   // Compute all stats in one batch
   const batchStats = computeAllPlayerStats(allMatches);
   // Store or dispatch the results
   ```

2. **Replace individual function calls**: Instead of calling each stat function separately, use the batch results
   ```javascript
   // Old way:
   const elo = getEloTrajectory(playerName);
   const streaks = getLongestStreaks(playerName);
   // ... 10 more calls
   
   // New way:
   const stats = batchStats[playerName];  // Already computed!
   ```

3. **Cache the results**: Store batch stats and recompute only when matches change

## Notes

- Matches **must be sorted newest-first** (as they come from Firestore)
- The function processes matches in **reverse order** (oldest to newest) to correctly build trajectories
- Win/loss ratios count per opponent, so 2v2 matches count each opponent separately
- All helper fields are cleaned up before returning (streakType, winCount, etc.)
