# Test Directory

This directory contains test files for the Kickelo application.

## Running Tests

### Player Stats Batch Test
Tests the `computeAllPlayerStats` function which computes all player statistics in a single pass.

```bash
npm run test:stats
```

Or directly:
```bash
node test/player-stats-batch.test.js
```

## Test Files

- **player-stats-batch.test.js** - Comprehensive test suite for the batch statistics computation
  - Creates mock match data
  - Validates all computed statistics
  - Checks for data integrity and correctness
  - Performs 11+ validation checks per player

## Validation Utilities

The validation utilities are located in `src/utils/player-stats-validator.js` and can be imported for use in production code if needed:

```javascript
import { validateStats, printDetailedStats, compareStats } from '../src/utils/player-stats-validator.js';
```

### Functions

- `validateStats(stats, matches)` - Validates the structure and correctness of computed stats
- `printDetailedStats(stats, playerName)` - Prints a detailed view of a player's stats
- `compareStats(oldStats, newStats, playerName)` - Compares two stat objects (useful for regression testing)

## Adding New Tests

When adding new test files:

1. Create the test file in this directory
2. Name it with `.test.js` suffix (e.g., `my-feature.test.js`)
3. Add a corresponding script to `package.json` if it needs to be run separately
4. Import utilities from `../src/utils/` as needed
5. Import source files from `../src/` as needed
