// Import from the new player data service instead of firebase
import { allPlayers, initializePlayersData } from './player-data-service.js';
import { leaderboardList } from './dom-elements.js';
import { getCurrentStreak, getDailyEloChanges } from './player-stats-service.js';

let onPlayerClickCallback = null;

export function setOnPlayerClick(callback) {
    onPlayerClickCallback = callback;
}

// The main function to render the leaderboard from the local 'allPlayers' array
async function updateLeaderboardDisplay() {
    leaderboardList.innerHTML = "";
    let index = 0;

    if (allPlayers.length === 0) {
        leaderboardList.innerHTML = "<li>No players found.</li>";
        return;
    }

    // Sort players by ELO from the local array
    const sortedPlayers = [...allPlayers].sort((a, b) => b.elo - a.elo);

    // Fetch all daily changes once to be efficient
    const dailyChanges = await getDailyEloChanges();

    sortedPlayers.forEach((player) => {
        const li = document.createElement("li");

        const playerInfoSpan = document.createElement('span');
        playerInfoSpan.textContent = `${player.name}: ${player.elo}`;

        const indicatorsContainer = document.createElement('span');
        indicatorsContainer.style.display = 'flex';
        indicatorsContainer.style.alignItems = 'center';
        indicatorsContainer.style.gap = '15px';

        // Streak Indicator
        const streak = getCurrentStreak(player.name);
        if (streak.type === 'win' && streak.length >= 3) {
            const streakSpan = document.createElement('span');
            streakSpan.textContent = `🔥 ${streak.length}`;
            streakSpan.style.color = '#ffac33';
            indicatorsContainer.appendChild(streakSpan);
        }

        // Daily ELO Change Indicator
        const dailyChange = dailyChanges[player.name];
        if (dailyChange) {
            const changeSpan = document.createElement('span');
            if (dailyChange > 0) {
                changeSpan.textContent = `▲ ${Math.round(dailyChange)}`;
                changeSpan.style.color = '#86e086';
            } else if (dailyChange < 0) {
                changeSpan.textContent = `▼ ${Math.round(Math.abs(dailyChange))}`;
                changeSpan.style.color = '#ff7b7b';
            }
            if (changeSpan.textContent) {
                indicatorsContainer.appendChild(changeSpan);
            }
        }

        li.appendChild(playerInfoSpan);
        li.appendChild(indicatorsContainer);

        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
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
    console.log("Leaderboard display updated from local data.");
}

/**
 * Initializes the leaderboard. Call this once when the app starts.
 */
export function initializeLeaderboardDisplay() {
    // First, initialize the data fetching service
    initializePlayersData();

    // Then, listen for the custom event to re-render
    window.addEventListener('matches-updated', updateLeaderboardDisplay);

    // Perform an initial render in case data is already available from cache
    updateLeaderboardDisplay();
}
