# Kickelo Project Overview

## Purpose and Current Status

Kickelo is a web application for tracking foosball (table soccer) matches using an Elo rating system. It allows users to:
- Record matches (with live mode and manual entry)
- Track player statistics and leaderboards
- Suggest fair pairings for games
- View recent matches and detailed player stats

The app is currently functional, with real-time updates via Firestore, a modern modular JavaScript codebase, and a responsive UI. It supports both live and manual match entry, and provides rich player and match analytics.

## Technical Overview

- **Frontend:** Vanilla JavaScript (ES modules), HTML, CSS (custom properties for theming)
- **Backend/Database:** Firebase Firestore (real-time listeners, offline persistence)
- **Authentication:** Firebase Auth (anonymous sign-in)
- **State Management:** Centralized in-memory arrays (allPlayers, allMatches) synced with Firestore
- **UI:** DOM manipulation, custom modals, Chart.js for stats
- **Data Flow:**
  - On login, listeners attach to Firestore for players and matches
  - Data is cached in arrays, and custom events trigger UI updates
  - All user actions (match submission, player creation, etc.) update Firestore, which then updates the UI via listeners

## File-by-File Functionality

### Core App Logic
- **app.js**: Main entry point. Handles authentication, attaches/detaches Firestore listeners, initializes UI components, and sets up global event handlers.
- **constants.js**: Shared constants (e.g., MAX_GOALS).
- **styles.css**: Global and component-level styles, including color theming and responsive layout.

### Data Services
- **firebase-service.js**: Firebase initialization, exports Firestore and Auth utilities, supports emulator for development.
- **player-data-service.js**: Real-time listener for players collection. Maintains allPlayers array and dispatches 'players-updated' events.
- **match-data-service.js**: Real-time listener for matches collection. Maintains allMatches array and dispatches 'matches-updated' events.

### UI and DOM
- **dom-elements.js**: Centralized references to all key DOM elements (inputs, buttons, modals, etc.).
- **modal-handler.js**: Handles player selection modal, including loading players, saving active players, and triggering pairing suggestions.
- **player-manager.js**: Ensures player existence in Firestore, populates player dropdowns, and handles new player creation.
- **match-form-handler.js**: Handles match form submission (manual and live), validates input, updates player ratings, and records matches in Firestore.
- **leaderboard-display.js**: Renders the leaderboard from allPlayers, shows streaks and daily Elo changes, and handles player click events.
- **recent-matches-display.js**: Renders a list of recent matches, including goal timelines if available.
- **player-stats-component.js**: Custom modal/component for detailed player stats (Elo trajectory, win/loss ratios, streaks, etc.), uses Chart.js.
- **match-timeline.js**: Utilities for rendering SVG timelines of match goal logs.

### Analytics and Pairing
- **player-stats-service.js**: Computes player stats (Elo history, win/loss ratios, streaks, etc.) from cached data.
- **pairing-service.js**: Suggests fair pairings based on recent play history, session logic, and co/opp counts.
- **elo-service.js**: Elo rating calculation utilities (expected score, rating update).

## Data Model
- **Players**: `{ id, name, elo, games }`
- **Matches**: `{ id, teamA, teamB, winner, goalsA, goalsB, eloDelta, timestamp, goalLog?, matchDuration?, vibrationLogPath? }`

## UI Features
- SVG foosball table with overlayed player selectors
- Live mode with goal logging and timer
- Modal for selecting active players
- Leaderboard with streak and Elo change indicators
- Recent matches with timelines
- Player stats modal with charts and tables

## Extensibility
- Modular codebase: Each feature is in its own file
- Centralized data/state management
- Easily supports new analytics, UI components, or data sources

---

This document should be updated as the codebase evolves, especially when refactoring or adding major features.
