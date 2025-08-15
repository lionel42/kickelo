import './styles.css'; // Global styles

// Import services and display functions
import { showPlayerModal } from './modal-handler.js';
import { initializePlayerManager } from './player-manager.js';
import { setOnPlayerClick, initializeLeaderboardDisplay } from './leaderboard-display.js';
import { initializeRecentMatchesDisplay } from './recent-matches-display.js';
import { suggestPairing } from './pairing-service.js';
import { setupMatchForm } from './match-form-handler.js';
import { showPlayerStats } from './player-stats-component.js';
import { initializeMatchesData } from './match-data-service.js';

initializeMatchesData()

// Setup event listeners for global actions
document.getElementById('btnSuggest').onclick = () => {
    showPlayerModal(suggestPairing); // Pass the suggestPairing function as a callback
};


// Player click handler for the leaderboard
const clickPlayer = (playerName) => {
    console.log(`Player clicked: ${playerName}`);
    showPlayerStats(playerName);
};
setOnPlayerClick(clickPlayer);

// Setup match form submission
setupMatchForm();

// Football animation logic
window.onload = async () => {
    initializePlayerManager();
    initializeLeaderboardDisplay();
    initializeRecentMatchesDisplay();
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
