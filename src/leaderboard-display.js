// Import from the new player data service instead of firebase
import { allPlayers} from './player-data-service.js';
import { leaderboardList } from './dom-elements.js';
import { getCachedStats, getAllCachedStats } from './stats-cache-service.js';

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

    // Get all cached stats at once - much more efficient
    const allStats = getAllCachedStats();

    sortedPlayers.forEach((player) => {
        const li = document.createElement("li");

        const playerInfoSpan = document.createElement('span');
        // append a heart emoji only if the player name is "Julia"

        if (player.name === "Julia") {
            playerInfoSpan.textContent = `${player.name} ❤️: ${player.elo}`;
        } else {
            playerInfoSpan.textContent = `${player.name}: ${player.elo}`;
        }

        const indicatorsContainer = document.createElement('span');
        indicatorsContainer.style.display = 'flex';
        indicatorsContainer.style.alignItems = 'center';
        indicatorsContainer.style.gap = '15px';

        // Get player stats from cache
        const playerStats = allStats[player.name];
        
        if (playerStats) {
            // Streak Indicator
            const streak = playerStats.currentStreak;
            if (streak && streak.type === 'win' && streak.length >= 3) {
                const streakSpan = document.createElement('span');
                streakSpan.textContent = `🔥 ${streak.length}`;
                streakSpan.style.color = '#ffac33';
                indicatorsContainer.appendChild(streakSpan);
            }

            // Daily ELO Change Indicator
            const dailyChange = playerStats.dailyEloChange;
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

    // Then, listen for the custom events to re-render
    window.addEventListener('matches-updated', updateLeaderboardDisplay);
    window.addEventListener('players-updated', updateLeaderboardDisplay);

    // Perform an initial render in case data is already available from cache
    updateLeaderboardDisplay();
}
