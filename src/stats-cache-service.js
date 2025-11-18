/**
 * Batch Stats Cache Service
 * 
 * This service maintains a cache of all player statistics computed in batch.
 * It automatically recomputes when matches are updated and provides fast access.
 */

import { computeAllPlayerStats } from './player-stats-batch.js';

// Cache for all player stats
let statsCache = {};
let isCacheValid = false;
let lastComputeTime = 0;

/**
 * Initialize the cache by computing stats from matches.
 * This should be called when matches are updated.
 * @param {Array<Object>} matches - Array of match objects sorted by timestamp descending
 */
export function updateStatsCache(matches) {
    const startTime = performance.now();
    
    if (!matches || matches.length === 0) {
        statsCache = {};
        isCacheValid = true;
        return;
    }
    
    statsCache = computeAllPlayerStats(matches);
    isCacheValid = true;
    lastComputeTime = performance.now() - startTime;
    
    console.log(`Stats cache updated: ${Object.keys(statsCache).length} players in ${lastComputeTime.toFixed(2)}ms`);
    
    // Dispatch event for UI components that may want to refresh (if in browser)
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('stats-cache-updated', { 
            detail: { playerCount: Object.keys(statsCache).length, computeTime: lastComputeTime }
        }));
    }
}

/**
 * Get all cached stats for a player.
 * @param {string} playerName - The player ID/name
 * @returns {Object|null} The player's stats or null if not found
 */
export function getCachedStats(playerName) {
    if (!isCacheValid) {
        console.warn('Stats cache not initialized. Call updateStatsCache first.');
        return null;
    }
    
    return statsCache[playerName] || null;
}

/**
 * Get a specific stat for a player from the cache.
 * @param {string} playerName - The player ID/name
 * @param {string} statKey - The stat property to retrieve (e.g., 'eloTrajectory', 'currentStreak')
 * @returns {*} The requested stat value or null if not found
 */
export function getCachedStat(playerName, statKey) {
    const stats = getCachedStats(playerName);
    return stats ? stats[statKey] : null;
}

/**
 * Get stats for multiple players at once.
 * @param {Array<string>} playerNames - Array of player IDs/names
 * @returns {Object<string, Object>} Mapping of player names to their stats
 */
export function getCachedStatsForPlayers(playerNames) {
    const result = {};
    for (const playerName of playerNames) {
        const stats = getCachedStats(playerName);
        if (stats) {
            result[playerName] = stats;
        }
    }
    return result;
}

/**
 * Get all cached stats (for all players).
 * @returns {Object<string, Object>} All cached player stats
 */
export function getAllCachedStats() {
    if (!isCacheValid) {
        console.warn('Stats cache not initialized. Call updateStatsCache first.');
        return {};
    }
    return statsCache;
}

/**
 * Check if the cache is valid/initialized.
 * @returns {boolean} True if cache is valid
 */
export function isCacheReady() {
    return isCacheValid;
}

/**
 * Invalidate the cache (for testing or manual refresh).
 */
export function invalidateCache() {
    isCacheValid = false;
    statsCache = {};
}

/**
 * Get cache statistics/metadata.
 * @returns {Object} Cache metadata
 */
export function getCacheInfo() {
    return {
        isValid: isCacheValid,
        playerCount: Object.keys(statsCache).length,
        lastComputeTime: lastComputeTime,
        playerNames: Object.keys(statsCache)
    };
}
