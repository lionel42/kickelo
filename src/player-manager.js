// Import from the data service and for write/check operations
import { ensurePlayer } from './api-service.js';
import { allPlayers } from './player-data-service.js';
import { teamA1Select, teamA2Select, teamB1Select, teamB2Select } from './dom-elements.js';

/**
 * Checks if a player exists and creates them if they don't.
 * This function still needs to interact with Firestore for certainty and for write operations.
 * @param {string} name - The name of the player.
 * @returns {Promise<object>} The player's data.
 */
export async function getOrCreatePlayer(name) {
    // First, check the local cache for efficiency.
    const existingPlayer = allPlayers.find(p => p.id === name);
    if (existingPlayer) {
        return existingPlayer;
    }

    const created = await ensurePlayer(name);
    return { id: created.id, name: created.name, games: created.games };
}

/**
 * Populates the player selection dropdowns from the local 'allPlayers' array.
 */
function updatePlayerDropdowns() {
    const playerSelects = [teamA1Select, teamA2Select, teamB1Select, teamB2Select];
    
    // Sort players from the local array alphabetically by their ID (name).
    const players = allPlayers.map(p => p.id).sort();
    console.log("Updating player dropdowns from local data...");

    for (const select of playerSelects) {
        if (!select) continue;

        const previousValue = select.value;
        select.innerHTML = ""; // Clear old options

        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        const color = select.id.startsWith("teamA") ? "Red" : "Blue";
        const role = select.id.endsWith("1") ? "defense" : "offense";
        defaultOpt.textContent = `${color} ${role}`;
        select.appendChild(defaultOpt);

        for (const name of players) {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        }

        const newOpt = document.createElement("option");
        newOpt.value = "__add_new__";
        newOpt.textContent = "Add new player…";
        select.appendChild(newOpt);

        // Restore previous selection if it's still a valid player
        if (previousValue && players.includes(previousValue)) {
            select.value = previousValue;
        }
    }
}

/**
 * Handles the 'Add new player…' option in the dropdowns.
 * @param {Event} e - The change event from the select element.
 */
async function handlePlayerDropdownChange(e) {
    if (e.target.value === "__add_new__") {
        const newName = prompt("Enter new player name:");
        
        if (newName) {
            const trimmedName = newName.trim();
            if (!trimmedName) {
                alert("Player name cannot be empty.");
                e.target.value = "";
                return;
            }
            const validNamePattern = /^[a-zA-Z0-9_]+$/;
            if (!validNamePattern.test(trimmedName)) {
                alert("Player name can only contain alphanumeric characters and underscores.");
                e.target.value = "";
                return;
            }

            // Check for existence using the local cache first for speed.
            const playerExists = allPlayers.some(p => p.id === trimmedName);
            if (playerExists) {
                alert(`Player "${trimmedName}" already exists.`);
                e.target.value = "";
                return;
            }
            // The dropdowns will update automatically via the event listener,
            // but we can try to set the value here for a faster UI response.

            const opt = document.createElement("option");
            opt.value = trimmedName;
            opt.textContent = trimmedName;
            e.target.appendChild(opt);
            e.target.value = trimmedName;

            await getOrCreatePlayer(trimmedName);

        } else {
            e.target.value = ""; // Reset dropdown if user cancels prompt
        }
    }
}

/**
 * Initializes the player manager functionality.
 * Call this once when the app starts.
 */
export function initializePlayerManager() {
    // Initial population of dropdowns using whatever data is currently in the cache.
    updatePlayerDropdowns();

    // Listen for updates from the player data service to keep dropdowns in sync.
    window.addEventListener('players-updated', updatePlayerDropdowns);

    // Attach event listeners to dropdowns for the 'Add new player' functionality.
    const playerSelects = [teamA1Select, teamA2Select, teamB1Select, teamB2Select];
    playerSelects.forEach(select => {
        if (select) {
            // Ensure we don't attach the listener multiple times if this is ever re-run.
            select.removeEventListener("change", handlePlayerDropdownChange);
            select.addEventListener("change", handlePlayerDropdownChange);
        }
    });

    console.log("Player manager initialized and listening for 'players-updated' event.");
}
