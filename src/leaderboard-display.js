// Import from the new player data service instead of firebase
import { allPlayers} from './player-data-service.js';
import { leaderboardList } from './dom-elements.js';
import { getCachedStats, getAllCachedStats } from './stats-cache-service.js';

let onPlayerClickCallback = null;
let showInactivePlayers = false;  // Default: hide inactive players
let sortBy = 'elo';  // Default sort by ELO rating

export function setOnPlayerClick(callback) {
    onPlayerClickCallback = callback;
}

export function setShowInactivePlayers(show) {
    showInactivePlayers = show;
    updateLeaderboardDisplay();
}

export function getShowInactivePlayers() {
    return showInactivePlayers;
}

export function setSortBy(stat) {
    sortBy = stat;
    updateLeaderboardDisplay();
}

export function getSortBy() {
    return sortBy;
}

/**
 * Helper function to compute total wins and losses from player stats
 */
function computeWinsAndLosses(stats) {
    if (!stats || !stats.winLossRatios) {
        return { wins: 0, losses: 0, totalGames: 0 };
    }
    
    let wins = 0;
    let losses = 0;
    
    for (const opponent in stats.winLossRatios) {
        wins += stats.winLossRatios[opponent].wins;
        losses += stats.winLossRatios[opponent].losses;
    }
    
    return { wins, losses, totalGames: wins + losses };
}

/**
 * Get the value to sort by for a player
 */
function getSortValue(player, stats, sortBy) {
    switch (sortBy) {
        case 'elo':
            return player.elo || 0;
        case 'totalGames': {
            if (!stats) return 0;
            return stats.eloTrajectory ? stats.eloTrajectory.length : 0;
        }
        case 'winRate': {
            if (!stats) return 0;
            const { wins, totalGames } = computeWinsAndLosses(stats);
            return totalGames > 0 ? wins / totalGames : 0;
        }
        case 'winStreak': {
            if (!stats || !stats.currentStreak) return 0;
            return stats.currentStreak.type === 'win' ? stats.currentStreak.length : 0;
        }
        case 'dailyChange': {
            if (!stats) return 0;
            return stats.dailyEloChange || 0;
        }
        case 'highestElo': {
            if (!stats) return 0;
            return stats.highestElo || 0;
        }
        default:
            return player.elo || 0;
    }
}

/**
 * Get the display value for the selected stat
 */
function getDisplayValue(player, stats, sortBy) {
    switch (sortBy) {
        case 'elo':
            return player.elo;
        case 'totalGames': {
            if (!stats) return '0 games';
            const games = stats.eloTrajectory ? stats.eloTrajectory.length : 0;
            return `${games} game${games !== 1 ? 's' : ''}`;
        }
        case 'winRate': {
            if (!stats) return '0%';
            const { wins, totalGames } = computeWinsAndLosses(stats);
            if (totalGames === 0) return '0%';
            const winRate = (wins / totalGames * 100).toFixed(1);
            return `${winRate}% (${wins}/${totalGames})`;
        }
        case 'winStreak': {
            if (!stats || !stats.currentStreak) return '0';
            return stats.currentStreak.type === 'win' ? stats.currentStreak.length : 0;
        }
        case 'dailyChange': {
            if (!stats) return '0';
            const change = stats.dailyEloChange || 0;
            return change > 0 ? `+${Math.round(change)}` : Math.round(change);
        }
        case 'highestElo': {
            if (!stats) return '0';
            return Math.round(stats.highestElo || 0);
        }
        default:
            return player.elo;
    }
}

// The main function to render the leaderboard from the local 'allPlayers' array
async function updateLeaderboardDisplay() {
    leaderboardList.innerHTML = "";
    let index = 0;

    if (allPlayers.length === 0) {
        leaderboardList.innerHTML = "<li>No players found.</li>";
        return;
    }

    // Get all cached stats at once - much more efficient
    const allStats = getAllCachedStats();

    // Sort players by the selected statistic
    const sortedPlayers = [...allPlayers].sort((a, b) => {
        const aStats = allStats[a.name];
        const bStats = allStats[b.name];
        const aValue = getSortValue(a, aStats, sortBy);
        const bValue = getSortValue(b, bStats, sortBy);
        return bValue - aValue;  // Descending order
    });

    // Filter out inactive players if needed
    const filteredPlayers = showInactivePlayers 
        ? sortedPlayers 
        : sortedPlayers.filter(player => {
            const stats = allStats[player.name];
            return !stats || stats.isActive;  // Show if no stats or if active
        });

    if (filteredPlayers.length === 0) {
        leaderboardList.innerHTML = showInactivePlayers 
            ? "<li>No players found.</li>"
            : "<li>No active players found.</li>";
        return;
    }

    filteredPlayers.forEach((player) => {
        const li = document.createElement("li");

        const playerInfoSpan = document.createElement('span');
        const playerStats = allStats[player.name];
        const displayValue = getDisplayValue(player, playerStats, sortBy);
        
        // append a heart emoji only if the player name is "Julia"
        if (player.name === "Julia") {
            playerInfoSpan.textContent = `${player.name} ❤️: ${displayValue}`;
        } else {
            playerInfoSpan.textContent = `${player.name}: ${displayValue}`;
        }

        const indicatorsContainer = document.createElement('span');
        indicatorsContainer.style.display = 'flex';
        indicatorsContainer.style.alignItems = 'center';
        indicatorsContainer.style.gap = '15px';
        
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
    // Set up the sort by dropdown
    const sortBySelect = document.getElementById('sortBySelect');
    if (sortBySelect) {
        sortBySelect.value = sortBy;
        sortBySelect.addEventListener('change', (e) => {
            setSortBy(e.target.value);
        });
    }

    // Set up the inactive players toggle
    const toggleCheckbox = document.getElementById('showInactiveToggle');
    if (toggleCheckbox) {
        toggleCheckbox.checked = showInactivePlayers;
        toggleCheckbox.addEventListener('change', (e) => {
            setShowInactivePlayers(e.target.checked);
        });
    }

    // Then, listen for the custom events to re-render
    window.addEventListener('matches-updated', updateLeaderboardDisplay);
    window.addEventListener('players-updated', updateLeaderboardDisplay);
    window.addEventListener('stats-cache-updated', updateLeaderboardDisplay);

    // Perform an initial render in case data is already available from cache
    updateLeaderboardDisplay();
}
