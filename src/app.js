import './styles.css'; // Global styles

// Import services and display functions
import { showPlayerModal } from './modal-handler.js';
import { loadPlayerDropdowns } from './player-manager.js';
import { setOnPlayerClick, startLeaderboardListener } from './leaderboard-display.js';
import { startRecentMatchesListener } from './recent-matches-display.js';
import { suggestPairing } from './pairing-service.js';
import { setupMatchForm } from './match-form-handler.js';
import { showPlayerStats } from './player-stats-component.js';
import { initializeMatchesData } from './match-data-service.js';

initializeMatchesData()

// Setup event listeners for global actions
document.getElementById('btnSuggest').onclick = () => {
    showPlayerModal(suggestPairing); // Pass the suggestPairing function as a callback
};


// Player click handler for the leaderboard - MODIFIED
const clickPlayer = (playerName) => {
    console.log(`Player clicked: ${playerName}`);
    // Show player stats when a player is clicked
    showPlayerStats(playerName); // Call the new function
    // Optionally, you might still want to start recent matches listener for that player,
    // but the stats modal covers it, so it might not be immediately visible.
    // If you want the main recent matches list to revert to global after closing stats,
    // you can call startRecentMatchesListener(null) when the stats modal is closed.
};
setOnPlayerClick(clickPlayer);

// const clickPlayer = (playerName) => {
//     // This function is called when a player is clicked in the leaderboard
//     // If the player is already selected, deselect them
//     const list = document.getElementById("leaderboard");
//     const items = list.getElementsByTagName("li");
//     for (let item of items) {
//         if (item.textContent.startsWith(playerName + ":")) {
//             if (item.classList.contains("selected-player")) {
//                 item.classList.remove("selected-player"); // Deselect player
//                 startRecentMatchesListener();
//             } else {
//                 selectPlayer(playerName); // Select player
//             }
//             return; // Exit after handling the click
//         }
//     }
// };
//
// async function selectPlayer(playerName) {
//     // This function is called when a player is selected from the leaderboard
//     // Mark the selected player in the leaderboard
//
//     const list = document.getElementById("leaderboard");
//     const items = list.getElementsByTagName("li");
//     for (let item of items) {
//         if (item.textContent.startsWith(playerName + ":")) {
//             // Highlight selected player
//             item.classList.add("selected-player");
//         } else {
//             // Reset others
//             item.classList.remove("selected-player");
//         }
//     }
//     // Show the player's matches
//     startRecentMatchesListener(playerName);
// }
// setOnPlayerClick(clickPlayer); // Set the callback for the leaderboard module

// Setup match form submission
setupMatchForm();

// Football animation logic
window.onload = async () => {
    await loadPlayerDropdowns();
    startLeaderboardListener();
    startRecentMatchesListener();
    console.log("Page loaded and initialized.");

    const football = document.getElementById('football');
    football.style.animation = 'flyIn 2s ease-out forwards';
    football.addEventListener('animationend', function () {
        football.style.animation = '';
    }, { once: true });
};

document.getElementById('football').addEventListener('click', function () {
    const football = this;
    football.style.animation = 'spin 2s ease-in-out forwards';
    football.addEventListener('animationend', function () {
        football.style.animation = '';
    }, { once: true });
});
