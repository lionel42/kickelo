import { fetchPlayers } from './api-service.js';

// This array will hold all player data, kept in sync by the listener.
export let allPlayers = [];
let isDataReady = false;
let dataInitialized = false;
let debounceTimer;
let pollTimer = null;
let lastPlayersHash = '';

/**
 * Initializes the real-time listener for all player data.
 * Call this once when your application starts.
 */
export function initializePlayersData() {
    if (dataInitialized) {
        return;
    }
    dataInitialized = true;

    const syncPlayers = async () => {
        try {
            const playersData = await fetchPlayers();
            const sortedPlayers = playersData
                .map(player => ({ id: player.id, name: player.name, games: player.games }))
                .sort((a, b) => a.id.localeCompare(b.id));

            const nextHash = JSON.stringify(sortedPlayers);
            if (nextHash === lastPlayersHash) {
                return;
            }

            lastPlayersHash = nextHash;
            allPlayers = sortedPlayers;
            isDataReady = true;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                window.dispatchEvent(new CustomEvent('players-updated'));
            }, 250);
        } catch (error) {
            console.error('Error syncing players from API:', error);
        }
    };

    syncPlayers();
    pollTimer = window.setInterval(syncPlayers, 2000);

    return () => {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    };
}

/**
 * Resets the player data listener so it can be re-initialized after going offline.
 */
export function resetPlayerDataListener() {
    dataInitialized = false;
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}
