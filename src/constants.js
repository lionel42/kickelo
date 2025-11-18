// src/constants.js

// Game configuration
export const MAX_GOALS = 5;

// ELO rating system configuration
export const STARTING_ELO = 1500;
export const ELO_K_FACTOR = 40;  // K-factor determines how much ratings change per game
export const ELO_RATING_SCALE = 400;  // Scale factor in the ELO formula (standard is 400)

// Player activity threshold (in days)
export const INACTIVE_THRESHOLD_DAYS = 14;  // Players inactive for 2 weeks
