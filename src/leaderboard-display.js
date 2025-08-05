import { db, collection, query, orderBy, onSnapshot } from './firebase-service.js'; // Import onSnapshot
import { leaderboardList } from './dom-elements.js';

let onPlayerClickCallback = null;
let unsubscribeLeaderboard = null; // To store the unsubscribe function

export function setOnPlayerClick(callback) {
    onPlayerClickCallback = callback;
}

export function startLeaderboardListener() {
    // If there's an existing listener, unsubscribe it first
    if (unsubscribeLeaderboard) {
        unsubscribeLeaderboard();
        console.log("Unsubscribed from previous leaderboard listener.");
    }

    const playersColRef = collection(db, 'players');
    const q = query(playersColRef, orderBy("elo", "desc"));

    console.log("Starting leaderboard listener...");
    unsubscribeLeaderboard = onSnapshot(q, (snapshot) => {
        leaderboardList.innerHTML = "";
        let index = 0;

        if (snapshot.empty) {
            leaderboardList.innerHTML = "<li>No players found.</li>";
            console.log("Leaderboard is empty.");
            return;
        }

        snapshot.forEach((doc) => {
            const player = doc.data();
            const li = document.createElement("li");
            li.textContent = `${player.name}: ${player.elo}`;
            li.style.cursor = "pointer";
            li.addEventListener("click", () => {
                if (onPlayerClickCallback) {
                    onPlayerClickCallback(player.name);
                }
            });

            if (index === 0) li.classList.add("gold");
            else if (index === 1) li.classList.add("silver");
            else if (index === 2) li.classList.add("bronze");
            index += 1;

            leaderboardList.appendChild(li);
        });
        console.log("Leaderboard updated from Firestore snapshot.");
    }, (error) => {
        console.error("Error listening to leaderboard changes:", error);
    });

    // Return the unsubscribe function so it can be used externally if needed
    return unsubscribeLeaderboard;
}

// Optionally, export a function to stop the listener explicitly
export function stopLeaderboardListener() {
    if (unsubscribeLeaderboard) {
        unsubscribeLeaderboard();
        unsubscribeLeaderboard = null;
        console.log("Leaderboard listener stopped.");
    }
}