import './styles.css';

import { showPlayerModal } from './modal-handler.js';
import { initializePlayerManager } from './player-manager.js';
import { setOnPlayerClick, initializeLeaderboardDisplay } from './leaderboard-display.js';
import { initializeRecentMatchesDisplay } from './recent-matches-display.js';
import { suggestPairing } from './pairing-service.js';
import { setupMatchForm } from './match-form-handler.js';
import { showPlayerStats } from './player-stats-component.js';
import { initializeMatchesData, resetMatchDataListener, refreshSeasonStats } from './match-data-service.js';
import { PAUSE_DATES, PAUSE_MESSAGE, PAUSE_IMAGE_PATH, MAX_GOALS } from './constants.js';
import { getSelectedSeason } from './season-service.js';
import { initializeNotifications } from './notification-service.js';
import { initializePlayersData, resetPlayerDataListener } from './player-data-service.js';

let activeListeners = [];
let isAppOnline = false;

function isPauseDay() {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    return PAUSE_DATES.includes(todayString);
}

function showPauseScreen() {
    const pauseOverlay = document.getElementById('pauseOverlay');
    const pauseMessageElement = document.getElementById('pauseMessage');
    const pauseImageElement = document.getElementById('pauseImage');

    pauseMessageElement.textContent = PAUSE_MESSAGE;
    pauseImageElement.src = PAUSE_IMAGE_PATH;
    pauseOverlay.style.display = 'flex';
    document.body.classList.add('paused');
}

function hidePauseScreen() {
    const pauseOverlay = document.getElementById('pauseOverlay');
    pauseOverlay.style.display = 'none';
    document.body.classList.remove('paused');
}

function populateGoalDropdowns() {
    const teamAgoals = document.getElementById('teamAgoals');
    const teamBgoals = document.getElementById('teamBgoals');
    
    [teamAgoals, teamBgoals].forEach(dropdown => {
        dropdown.innerHTML = '';
        for (let i = 0; i <= MAX_GOALS; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            dropdown.appendChild(option);
        }
    });
}

function goOnline() {
    if (isAppOnline) return;
    isAppOnline = true;

    populateGoalDropdowns();
    activeListeners.push(initializeMatchesData());
    activeListeners.push(initializePlayersData());

    initializeLeaderboardDisplay();
    initializeRecentMatchesDisplay();
    initializePlayerManager();
    initializeNotifications();
}

function goOffline() {
    if (!isAppOnline) return;
    isAppOnline = false;

    activeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });

    activeListeners = [];
    resetMatchDataListener();
    resetPlayerDataListener();
}

if (isPauseDay()) {
    showPauseScreen();
} else {
    hidePauseScreen();
    goOffline();
    goOnline();

    document.getElementById('btnSuggest').onclick = () => {
        showPlayerModal(suggestPairing);
    };

    setOnPlayerClick((playerName) => {
        showPlayerStats(playerName);
    });

    window.addEventListener('season-changed', (event) => {
        const season = event.detail?.season ?? getSelectedSeason();
        refreshSeasonStats(season);
    });

    setupMatchForm();
}

window.onload = async () => {
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

document.getElementById('leaderboardOptionsToggle').addEventListener('click', function () {
    const optionsPanel = document.getElementById('leaderboardOptions');
    optionsPanel.classList.toggle('collapsed');
    this.classList.toggle('rotated');
});
