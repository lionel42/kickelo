import { db, collection, query, orderBy, onSnapshot } from './firebase-service.js';
import { leaderboardList } from './dom-elements.js';
import { getCurrentStreak, getDailyEloChanges } from './player-stats-service.js';

let onPlayerClickCallback = null;
let unsubscribeLeaderboard = null;

export function setOnPlayerClick(callback) {
    onPlayerClickCallback = callback;
}

export function startLeaderboardListener() {
    if (unsubscribeLeaderboard) {
        unsubscribeLeaderboard();
    }

    const playersColRef = collection(db, 'players');
    const q = query(playersColRef, orderBy("elo", "desc"));

    unsubscribeLeaderboard = onSnapshot(q, async (snapshot) => {
        leaderboardList.innerHTML = "";
        let index = 0;

        if (snapshot.empty) {
            leaderboardList.innerHTML = "<li>No players found.</li>";
            return;
        }

        // Fetch all daily changes once to be efficient
        const dailyChanges = await getDailyEloChanges();

        snapshot.forEach((doc) => {
            const player = doc.data();
            const li = document.createElement("li");

            // Main player info (name and ELO)
            const playerInfoSpan = document.createElement('span');
            playerInfoSpan.textContent = `${player.name}: ${player.elo}`;

            // Container for the new indicators on the right
            const indicatorsContainer = document.createElement('span');
            indicatorsContainer.style.display = 'flex';
            indicatorsContainer.style.alignItems = 'center';
            indicatorsContainer.style.gap = '15px'; // Adjust spacing between indicators

            // 1. Streak Indicator
            const streak = getCurrentStreak(player.name);
            if (streak.type === 'win' && streak.length >= 3) {
                const streakSpan = document.createElement('span');
                streakSpan.textContent = `🔥 ${streak.length}`;
                streakSpan.style.color = '#ffac33'; // Orange color for fire
                indicatorsContainer.appendChild(streakSpan);
            }

            // 2. Daily ELO Change Indicator
            const dailyChange = dailyChanges[player.name];
            if (dailyChange) { // Only show if there was a change
                const changeSpan = document.createElement('span');
                if (dailyChange > 0) {
                    changeSpan.textContent = `▲ ${Math.round(dailyChange)}`;
                    changeSpan.style.color = '#86e086'; // Lighter green
                } else if (dailyChange < 0) {
                    changeSpan.textContent = `▼ ${Math.round(Math.abs(dailyChange))}`;
                    changeSpan.style.color = '#ff7b7b'; // Lighter red
                }

                if (changeSpan.textContent) {
                    indicatorsContainer.appendChild(changeSpan);
                }
            }

            // Assemble the list item
            li.appendChild(playerInfoSpan);
            li.appendChild(indicatorsContainer);

            // Styling for the list item
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.cursor = "pointer";

            li.addEventListener("click", () => {
                if (onPlayerClickCallback) {
                    onPlayerClickCallback(player.name);
                }
            });

            // Add medal classes
            if (index === 0) li.classList.add("gold");
            else if (index === 1) li.classList.add("silver");
            else if (index === 2) li.classList.add("bronze");
            index += 1;

            leaderboardList.appendChild(li);
        });
    }, (error) => {
        console.error("Error listening to leaderboard changes:", error);
    });

    return unsubscribeLeaderboard;
}

export function stopLeaderboardListener() {
    if (unsubscribeLeaderboard) {
        unsubscribeLeaderboard();
        unsubscribeLeaderboard = null;
    }
}
