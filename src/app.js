// src/app.js (Your main entry point)

import './styles.css'; // Global styles
// No direct Firebase imports here, as it's handled by firebase-service.js

// Import DOM element references
import {submitMatchBtn, matchForm, teamA1Select, teamA2Select, teamB1Select, teamB2Select} from './dom-elements.js';

// Import services and display functions
import { showPlayerModal } from './modal-handler.js';
import { loadPlayerDropdowns } from './player-manager.js';
import { showLeaderboard, setOnPlayerClick } from './leaderboard-display.js';
import { updateRecentMatchDisplay } from './recent-matches-display.js';
import { suggestPairing } from './pairing-service.js';
import { setupMatchForm } from './match-form-handler.js';

// Constants that were global, now perhaps belong here or in specific modules
const MS = 1000;

// Setup event listeners for global actions
document.getElementById('btnSuggest').onclick = () => {
    showPlayerModal(suggestPairing); // Pass the suggestPairing function as a callback
};

// Player click handler for the leaderboard (will trigger player stats in the future)
// const clickPlayer = (playerName) => {
//     console.log(`Player clicked: ${playerName}`);
//     // For now, let's update recent matches display to show player's matches
//     showRecentMatches(playerName);
//     // In the future, this is where you'd call your player-stats-modal.show(playerData)
// };

const clickPlayer = (playerName) => {
    // This function is called when a player is clicked in the leaderboard
    // If the player is already selected, deselect them
    const list = document.getElementById("leaderboard");
    const items = list.getElementsByTagName("li");
    for (let item of items) {
        if (item.textContent.startsWith(playerName + ":")) {
            if (item.classList.contains("selected-player")) {
                item.classList.remove("selected-player"); // Deselect player
                updateRecentMatchDisplay();
            } else {
                selectPlayer(playerName); // Select player
            }
            return; // Exit after handling the click
        }
    }
};

async function selectPlayer(playerName) {
    // This function is called when a player is selected from the leaderboard
    // Mark the selected player in the leaderboard

    const list = document.getElementById("leaderboard");
    const items = list.getElementsByTagName("li");
    for (let item of items) {
        if (item.textContent.startsWith(playerName + ":")) {
            // Highlight selected player
            item.classList.add("selected-player");
        } else {
            // Reset others
            item.classList.remove("selected-player");
        }
    }
    // Show the player's matches
    await updateRecentMatchDisplay(playerName);
}

setOnPlayerClick(clickPlayer); // Set the callback for the leaderboard module


// Setup match form submission
setupMatchForm();

// Football animation logic
window.onload = async () => {
    await loadPlayerDropdowns();
    await showLeaderboard();
    await updateRecentMatchDisplay();
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
