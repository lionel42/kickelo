const K = 40; // K-factor for ELO rating

function expectedScore(r1, r2) {
    return 1 / (1 + Math.pow(10, (r2 - r1) / 400));
}

function updateRating(old, expected, score) {
    return Math.round(old + K * (score - expected));
}

export {
    K, // You might still need K externally, so export it
    expectedScore,
    updateRating
};