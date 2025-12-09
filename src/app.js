import './styles.css'; // Global styles

// Import services and display functions
import { showPlayerModal } from './modal-handler.js';
import { initializePlayerManager } from './player-manager.js';
import { setOnPlayerClick, initializeLeaderboardDisplay } from './leaderboard-display.js';
import { initializeRecentMatchesDisplay } from './recent-matches-display.js';
import { suggestPairing } from './pairing-service.js';
import { setupMatchForm } from './match-form-handler.js';
import { showPlayerStats } from './player-stats-component.js';
import { initializeMatchesData, resetMatchDataListener } from './match-data-service.js';
import { PAUSE_DATES, PAUSE_MESSAGE, PAUSE_IMAGE_PATH } from './constants.js';

import { auth } from './firebase-service.js';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {initializePlayersData, resetPlayerDataListener} from "./player-data-service.js";

// --- App State ---
// This will hold the unsubscribe functions for our listeners
let activeListeners = [];
let isAppOnline = false;

/**
 * Checks if today is a pause day.
 * @returns {boolean} True if the app should be paused today
 */
function isPauseDay() {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    return PAUSE_DATES.includes(todayString);
}

/**
 * Shows the pause overlay and hides the main content.
 */
function showPauseScreen() {
    const pauseOverlay = document.getElementById('pauseOverlay');
    const pauseMessageElement = document.getElementById('pauseMessage');
    const pauseImageElement = document.getElementById('pauseImage');
    
    pauseMessageElement.textContent = PAUSE_MESSAGE;
    pauseImageElement.src = PAUSE_IMAGE_PATH;
    pauseOverlay.style.display = 'flex';
    
    // Hide the main content
    document.body.classList.add('paused');
}

/**
 * Hides the pause overlay and shows the main content.
 */
function hidePauseScreen() {
    const pauseOverlay = document.getElementById('pauseOverlay');
    pauseOverlay.style.display = 'none';
    document.body.classList.remove('paused');
}

/**
 * Attaches all Firestore listeners and initializes UI components.
 * This function is called ONLY when we have a valid user.
 */
function goOnline() {
    if (isAppOnline) return; // Prevent running if already online
    console.log("App is going online: attaching listeners.");
    isAppOnline = true;

    // Start the data services and store their unsubscribe functions
    activeListeners.push(initializeMatchesData());
    activeListeners.push(initializePlayersData());

    // Initialize the UI components that depend on that data
    initializeLeaderboardDisplay();
    initializeRecentMatchesDisplay();
    initializePlayerManager();
}

/**
 * Detaches all Firestore listeners.
 * This is called when the user signs out or the connection is lost.
 */
function goOffline() {
    if (!isAppOnline) return;
    console.log("App is going offline: detaching listeners.");
    isAppOnline = false;

    // Call each unsubscribe function
    activeListeners.forEach(unsubscribe => unsubscribe());

    // Clear the array for the next session
    activeListeners = [];

    // Reset data listeners so they can be re-initialized
    resetMatchDataListener();
    resetPlayerDataListener();
}

// --- Main Application Logic ---

// Check if today is a pause day
if (isPauseDay()) {
    console.log("Today is a pause day. Showing pause screen.");
    showPauseScreen();
} else {
    hidePauseScreen();
    
    // onAuthStateChanged is the central controller for the app's online/offline state.
    onAuthStateChanged(auth, user => {
      if (user) {
        // User is signed in or their token was just refreshed.
        // First, clean up any old listeners that might have failed.
        goOffline();
        // Then, start fresh with the new, valid user session.
        goOnline();
      } else {
        // User is signed out.
        goOffline();
        // Attempt to sign in again. If it succeeds, this observer will fire again with a user.
        signInAnonymously(auth).catch(error => {
          console.error("Could not sign in anonymously:", error);
          // You could show a "Retry Connection" button to the user here.
        });
      }
    });

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
}

// Football animation logic
window.onload = async () => {
    // initializePlayerManager();
    // initializeLeaderboardDisplay();
    // initializeRecentMatchesDisplay();
    // console.log("Page loaded and initialized.");

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

// Leaderboard options toggle
document.getElementById('leaderboardOptionsToggle').addEventListener('click', function () {
    const optionsPanel = document.getElementById('leaderboardOptions');
    optionsPanel.classList.toggle('collapsed');
    this.classList.toggle('rotated');
});
