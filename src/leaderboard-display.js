import { db, collection, query, orderBy, getDocs } from './firebase-service.js';
import { leaderboardList } from './dom-elements.js';

// Define a placeholder for the player click handler, to be set by main.js
let onPlayerClickCallback = null;

export function setOnPlayerClick(callback) {
    onPlayerClickCallback = callback;
}

export async function showLeaderboard() {
    leaderboardList.innerHTML = "";
    const playersColRef = collection(db, 'players');
    const q = query(playersColRef, orderBy("elo", "desc"));
    const snapshot = await getDocs(q);
    let index = 0;

    snapshot.forEach((doc) => {
        const player = doc.data(); // Get all player data
        const li = document.createElement("li");
        li.textContent = `${player.name}: ${player.elo}`;
        li.style.cursor = "pointer";
        li.addEventListener("click", () => {
            if (onPlayerClickCallback) {
                onPlayerClickCallback(player.name); // Pass the player name
            }
        });

        if (index === 0) li.classList.add("gold");
        else if (index === 1) li.classList.add("silver");
        else if (index === 2) li.classList.add("bronze");
        index += 1;

        leaderboardList.appendChild(li);
    });
}