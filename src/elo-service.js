import { ELO_K_FACTOR, ELO_RATING_SCALE } from './constants.js';

// Re-export for backwards compatibility
const K = ELO_K_FACTOR;

function expectedScore(r1, r2) {
    return 1 / (1 + Math.pow(10, (r2 - r1) / ELO_RATING_SCALE));
}

function updateRating(old, expected, score, kFactor = K) {
    return Math.round(old + kFactor * (score - expected));
}

export {
    K, // You might still need K externally, so export it
    expectedScore,
    updateRating
};