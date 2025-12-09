// src/constants.js

// Game configuration
export const MAX_GOALS = 5;

// ELO rating system configuration
export const STARTING_ELO = 1500;
export const ELO_K_FACTOR = 40;  // K-factor determines how much ratings change per game
export const ELO_RATING_SCALE = 400;  // Scale factor in the ELO formula (standard is 400)

// Player activity threshold (in days)
export const INACTIVE_THRESHOLD_DAYS = 14;  // Players inactive for 2 weeks

// Badge / emoji configuration
export const BADGE_THRESHOLDS = Object.freeze({
	medic: {
		lookbackDays: 7,
		minUniqueTeammates: 3,
		teammateLossStreakLength: 3,
	},
	rollercoaster: {
		minLeadChanges: 3,
	},
	chillComeback: {
		requireFinalScore: '5:4',
	},
	gardener: {
		requiredWeekdays: 5,
	},
	goldenPhi: {
		minWins: 5,
	},
});


// Pause configuration
// Set specific dates when the ELO system should be paused
// Format: 'YYYY-MM-DD' (e.g., '2025-12-25' for Christmas)
export const PAUSE_DATES = [
	'2025-12-09',
];

export const PAUSE_MESSAGE = "The ELO system is taking a break today!";
export const PAUSE_IMAGE_PATH = "assets/pause_image.jpeg";
