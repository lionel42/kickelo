import {collection, db, onSnapshot} from './firebase-service.js';

// This array will hold all player data, kept in sync by the listener.
export let allPlayers = [];
let isDataReady = false;
let dataInitialized = false;
let debounceTimer;

/**
 * Initializes the real-time listener for all player data.
 * Call this once when your application starts.
 */
export function initializePlayersData() {
    if (dataInitialized) {
        return;
    }
    dataInitialized = true;

    const playersColRef = collection(db, 'players');

    return onSnapshot(playersColRef, (snapshot) => {
        console.log("Player data updated from Firestore.");
        const playersData = [];
        snapshot.forEach((doc) => {
            playersData.push({id: doc.id, ...doc.data()});
        });

        allPlayers = playersData;
        isDataReady = true;

        // Debounce the update event. This is the key to fixing the multiple-render bug.
        // It waits 250ms after the last update before notifying the rest of the app.
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            window.dispatchEvent(new CustomEvent('players-updated'));
            console.log("Dispatched 'players-updated' event.");
        }, 250);
    }, (error) => {
        console.error("Error listening to players collection:", error);
    });
}

/**
 * Resets the player data listener so it can be re-initialized after going offline.
 */
export function resetPlayerDataListener() {
    dataInitialized = false;
}
