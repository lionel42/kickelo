import { db, collection, onSnapshot } from './firebase-service.js';
import { updateStatsCache } from './stats-cache-service.js';

// This array will hold all match data, kept in sync by the listener.
let allMatches = [];
// This flag indicates if the initial data has been loaded.
let isDataReady = false;
// This flag prevents the listener from being attached more than once.
let dataInitialized = false;

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

    const matchesColRef = collection(db, 'matches');

    // onSnapshot listens for any changes in the 'matches' collection
    return onSnapshot(matchesColRef, (snapshot) => {
        console.log("Match data updated from Firestore.");
        const matchesData = [];
        snapshot.forEach((doc) => {
            matchesData.push({ id: doc.id, ...doc.data() });
        });

        // convert Firestore timestamps to milliseconds
        matchesData.forEach(match => {
            if (match.timestamp && typeof match.timestamp.toMillis === 'function') {
                match.timestamp = match.timestamp.toMillis();
            }
        });

        // Sort all matches by timestamp, newest first.
        // It's more efficient to do this once here, rather than in every function.
        matchesData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        allMatches = matchesData;
        isDataReady = true;

        // Update the stats cache with all player statistics
        // This computes all stats in a single efficient pass
        updateStatsCache(allMatches);

        // Dispatch a custom event to let your UI components know
        // that new data is available and they should re-render.
        window.dispatchEvent(new CustomEvent('matches-updated'));

    }, (error) => {
        console.error("Error listening to matches collection:", error);
    });
}

/**
 * Resets the match data listener so it can be re-initialized after going offline.
 */
export function resetMatchDataListener() {
    dataInitialized = false;
}

export { allMatches, isDataReady };
