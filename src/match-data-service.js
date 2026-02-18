import { fetchMatches } from './api-service.js';
import { updateStatsCache } from './stats-cache-service.js';
import { INACTIVE_THRESHOLD_DAYS } from './constants.js';
import { filterMatchesBySeason, getSelectedSeason } from './season-service.js';

function filterRankedMatches(matches) {
    return matches.filter((match) => match?.ranked !== false);
}

// This array will hold all match data, kept in sync by the listener.
let allMatches = [];
// This flag indicates if the initial data has been loaded.
let isDataReady = false;
// This flag prevents the listener from being attached more than once.
let dataInitialized = false;
let recentActivePlayersCache = [];
let recentActivePlayersLookbackDays = INACTIVE_THRESHOLD_DAYS;
let pollTimer = null;
let lastMatchesHash = '';

function computeRecentActivePlayers(matches, lookbackDays = INACTIVE_THRESHOLD_DAYS) {
    if (!Array.isArray(matches) || matches.length === 0) {
        return [];
    }
    const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - lookbackMs;
    const activeSet = new Set();

    for (const match of matches) {
        if (typeof match.timestamp !== 'number') {
            continue;
        }
        if (match.timestamp < cutoff) {
            break;
        }
        if (Array.isArray(match.teamA)) {
            match.teamA.forEach(player => activeSet.add(player));
        }
        if (Array.isArray(match.teamB)) {
            match.teamB.forEach(player => activeSet.add(player));
        }
    }

    return Array.from(activeSet);
}

/**
 * Initializes the real-time listener for all match data.
 * Call this once when your application starts.
 * It enables offline persistence to avoid re-fetching all data on every page load.
 */
export function initializeMatchesData() {
    // Prevent re-initializing
    if (dataInitialized) {
        console.log("Match data listener is already initialized.");
        return;
    }
    dataInitialized = true;

    const syncMatches = async () => {
        try {
            const matchesData = await fetchMatches();
            matchesData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            const nextHash = JSON.stringify(matchesData);
            if (nextHash === lastMatchesHash) {
                return;
            }

            lastMatchesHash = nextHash;
            allMatches = matchesData;
            isDataReady = true;
            recentActivePlayersLookbackDays = INACTIVE_THRESHOLD_DAYS;
            recentActivePlayersCache = computeRecentActivePlayers(allMatches, recentActivePlayersLookbackDays);

            const season = getSelectedSeason();
            const seasonMatches = filterMatchesBySeason(allMatches, season);
            updateStatsCache(filterRankedMatches(seasonMatches), { season });

            window.dispatchEvent(new CustomEvent('matches-updated'));
        } catch (error) {
            console.error('Error syncing matches from API:', error);
        }
    };

    syncMatches();
    pollTimer = window.setInterval(syncMatches, 2000);

    return () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };
}

/**
 * Resets the match data listener so it can be re-initialized after going offline.
 */
export function resetMatchDataListener() {
    dataInitialized = false;
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

export function refreshSeasonStats(season = getSelectedSeason()) {
    const seasonMatches = filterMatchesBySeason(allMatches, season);
    updateStatsCache(filterRankedMatches(seasonMatches), { season });
}

export function getRecentActivePlayers(lookbackDays = INACTIVE_THRESHOLD_DAYS) {
    if (!Array.isArray(allMatches) || allMatches.length === 0) {
        return [];
    }
    if (lookbackDays !== recentActivePlayersLookbackDays || recentActivePlayersCache.length === 0) {
        recentActivePlayersLookbackDays = lookbackDays;
        recentActivePlayersCache = computeRecentActivePlayers(allMatches, lookbackDays);
    }
    return recentActivePlayersCache;
}

export { allMatches, isDataReady };
