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
    if (!stats || !stats.eloTrajectory) {
        return { wins: 0, losses: 0, totalGames: 0 };
    }
    
    // Total games is the length of eloTrajectory (each match = 1 entry)
    const totalGames = stats.eloTrajectory.length;
    
    // We can derive wins from winLossRatios, but we need to be careful:
    // In a 2v2 match, winLossRatios counts once per opponent (so 2x per match)
    // We need to count unique matches instead
    let wins = 0;
    let losses = 0;
    
    if (stats.winLossRatios) {
        // Count wins/losses per opponent, then divide by number of opponents per match
        // Assuming 2v2 matches (2 opponents per match)
        const opponentsPerMatch = 2;
        let totalWinEntries = 0;
        let totalLossEntries = 0;
        
        for (const opponent in stats.winLossRatios) {
            totalWinEntries += stats.winLossRatios[opponent].wins;
            totalLossEntries += stats.winLossRatios[opponent].losses;
        }
        
        // Each match creates entries for each opponent, so divide by opponents per match
        wins = totalWinEntries / opponentsPerMatch;
        losses = totalLossEntries / opponentsPerMatch;
    }
    
    return { wins, losses, totalGames };
}

/**
 * Get the value to sort by for a player
 */
function getSortValue(player, stats, sortBy) {
    switch (sortBy) {
        case 'elo':
            return player.elo || 0;
        case 'winRate': {
            if (!stats) return 0;
            const { wins, totalGames } = computeWinsAndLosses(stats);
            return totalGames > 0 ? wins / totalGames : 0;
        }
        case 'dailyChange': {
            if (!stats) return 0;
            return stats.dailyEloChange || 0;
        }
        case 'highestElo': {
            if (!stats) return 0;
            return stats.highestElo || 0;
        }
        case 'goldenRatio': {
            if (!stats) return 0;
            return stats.goldenRatio || 0;
        }
        case 'comebackRate': {
            if (!stats) return 0;
            return stats.comebackPercentage || 0;
        }
        case 'avgTimeTeam': {
            if (!stats || !stats.avgTimeBetweenGoals) return 0;
            // Lower is better, so we negate it for sorting
            return -(stats.avgTimeBetweenGoals.avgTimePerTeamGoal || 0);
        }
        case 'avgTimeOpponent': {
            if (!stats || !stats.avgTimeBetweenGoals) return 0;
            // Higher is better, so we don't negate it
            return stats.avgTimeBetweenGoals.avgTimePerOpponentGoal || 0;
        }
        case 'streakiness': {
            if (!stats || !stats.streakyness) return 0;
            return stats.streakyness.score || 0;
        }
        case 'longestWinStreak': {
            if (!stats || !stats.longestStreaks) return 0;
            return stats.longestStreaks.longestWinStreak || 0;
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
        case 'winRate': {
            if (!stats) return '0%';
            const { wins, totalGames } = computeWinsAndLosses(stats);
            if (totalGames === 0) return '0%';
            const winRate = (wins / totalGames * 100).toFixed(1);
            return `${winRate}%`;
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
        case 'goldenRatio': {
            if (!stats) return '0.00';
            return (stats.goldenRatio || 0).toFixed(2);
        }
        case 'comebackRate': {
            if (!stats) return '0%';
            return `${((stats.comebackPercentage || 0) * 100).toFixed(0)}%`;
        }
        case 'avgTimeTeam': {
            if (!stats || !stats.avgTimeBetweenGoals || !stats.avgTimeBetweenGoals.avgTimePerTeamGoal) return 'N/A';
            return `${(stats.avgTimeBetweenGoals.avgTimePerTeamGoal / 1000).toFixed(1)}s`;
        }
        case 'avgTimeOpponent': {
            if (!stats || !stats.avgTimeBetweenGoals || !stats.avgTimeBetweenGoals.avgTimePerOpponentGoal) return 'N/A';
            return `${(stats.avgTimeBetweenGoals.avgTimePerOpponentGoal / 1000).toFixed(1)}s`;
        }
        case 'streakiness': {
            if (!stats || !stats.streakyness) return '0.00';
            return (stats.streakyness.score || 0).toFixed(2);
        }
        case 'longestWinStreak': {
            if (!stats || !stats.longestStreaks) return '0';
            return stats.longestStreaks.longestWinStreak || 0;
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
    let filteredPlayers = showInactivePlayers 
        ? sortedPlayers 
        : sortedPlayers.filter(player => {
            const stats = allStats[player.name];
            return !stats || stats.isActive;  // Show if no stats or if active
        });

    // When sorting by daily change, also filter out players with 0 change
    if (sortBy === 'dailyChange') {
        filteredPlayers = filteredPlayers.filter(player => {
            const stats = allStats[player.name];
            return stats && stats.dailyEloChange && stats.dailyEloChange !== 0;
        });
    }

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

    // Set up the inactive players toggle (now a button)
    const toggleButton = document.getElementById('showInactiveToggle');
    if (toggleButton) {
        // Update button appearance based on state
        const updateButtonAppearance = () => {
            if (showInactivePlayers) {
                toggleButton.textContent = 'Hide inactive players';
                toggleButton.style.backgroundColor = 'var(--hover-color)';
                toggleButton.style.color = 'var(--text-color-primary)';
                toggleButton.style.borderColor = 'var(--gray-light)';
            } else {
                toggleButton.textContent = 'Show inactive players';
                toggleButton.style.backgroundColor = 'var(--card-background-color)';
                toggleButton.style.color = 'var(--text-color-secondary)';
                toggleButton.style.borderColor = 'var(--border-color)';
            }
        };
        
        updateButtonAppearance();
        
        toggleButton.addEventListener('click', () => {
            setShowInactivePlayers(!showInactivePlayers);
            updateButtonAppearance();
        });
    }

    // Then, listen for the custom events to re-render
    window.addEventListener('matches-updated', updateLeaderboardDisplay);
    window.addEventListener('players-updated', updateLeaderboardDisplay);
    window.addEventListener('stats-cache-updated', updateLeaderboardDisplay);

    // Perform an initial render in case data is already available from cache
    updateLeaderboardDisplay();
}
