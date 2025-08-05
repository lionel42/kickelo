// src/match-form-handler.js

import { db, doc, addDoc, updateDoc, collection } from './firebase-service.js';
import { expectedScore, updateRating } from './elo-service.js';
import { getOrCreatePlayer } from './player-manager.js';
// import { showLeaderboard } from './leaderboard-display.js';
import { stopRecentMatchesListeners } from './recent-matches-display.js';
import {
    teamA1Select, teamA2Select, teamB1Select, teamB2Select,
    teamAgoalsInput, teamBgoalsInput, submitMatchBtn, matchForm
} from './dom-elements.js';

const MAX_GOALS = 5; // Assuming this constant is specific to the form validation

export function setupMatchForm() {
    submitMatchBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const tA1 = teamA1Select.value.trim();
        const tA2 = teamA2Select.value.trim();
        const tB1 = teamB1Select.value.trim();
        const tB2 = teamB2Select.value.trim();

        const goalsA = teamAgoalsInput.value.trim();
        const goalsB = teamBgoalsInput.value.trim();

        // Validate inputs
        if (!/^\d+$/.test(goalsA) || !/^\d+$/.test(goalsB)) {
            return alert("Goals must be valid numbers.");
        }
        const parsedGoalsA = parseInt(goalsA, 10);
        const parsedGoalsB = parseInt(goalsB, 10);
        if (parsedGoalsA === parsedGoalsB) {
            return alert("Cannot submit a tie.");
        }
        if (parsedGoalsA > MAX_GOALS || parsedGoalsB > MAX_GOALS) {
            return alert(`Goals cannot exceed ${MAX_GOALS}.`);
        }
        if (!tA1 || !tA2 || !tB1 || !tB2) return alert("Enter all player names");
        if (new Set([tA1, tA2, tB1, tB2]).size < 4) {
            return alert("All players must be different");
        }

        const winner = parsedGoalsA > parsedGoalsB ? "A" : "B";

        // Get player documents
        const [pA1, pA2, pB1, pB2] = await Promise.all([
            getOrCreatePlayer(tA1),
            getOrCreatePlayer(tA2),
            getOrCreatePlayer(tB1),
            getOrCreatePlayer(tB2),
        ]);

        const teamARating = (pA1.elo + pA2.elo) / 2;
        const teamBRating = (pB1.elo + pB2.elo) / 2; // Corrected pB1.elo to pB2.elo

        const expectedA = expectedScore(teamARating, teamBRating);
        const scoreA = winner === "A" ? 1 : 0;
        const delta = updateRating(0, expectedA, scoreA); // updateRating calculates the change based on score - expected

        const winnerName = winner === "A" ? `${pA1.name} & ${pA2.name}` : `${pB1.name} & ${pB2.name}`;
        const loserName = winner === "A" ? `${pB1.name} & ${pB2.name}` : `${pA1.name} & ${pA2.name}`;
        const eloChange = Math.abs(delta);
        const winnerGoals = winner === "A" ? parsedGoalsA : parsedGoalsB;
        const loserGoals = winner === "A" ? parsedGoalsB : parsedGoalsA;
        const message = `Confirm match submission:\n\nWinners: ${winnerName}\nLosers: ${loserName}\nScore: ${winnerGoals}:${loserGoals}\nElo change: ${eloChange}\n\nDo you want to submit this match?`;
        if (!confirm(message)) {
            return;
        }

        // Update players' ELO and games count
        const matchesColRef = collection(db, 'matches');
        const playersColRef = collection(db, 'players');

        await Promise.all([
            updateDoc(doc(playersColRef, tA1), { elo: pA1.elo + delta, games: pA1.games + 1 }),
            updateDoc(doc(playersColRef, tA2), { elo: pA2.elo + delta, games: pA2.games + 1 }),
            updateDoc(doc(playersColRef, tB1), { elo: pB1.elo - delta, games: pB1.games + 1 }),
            updateDoc(doc(playersColRef, tB2), { elo: pB2.elo - delta, games: pB2.games + 1 }),
        ]);

        // Add match log
        await addDoc(matchesColRef, {
            teamA: [tA1, tA2],
            teamB: [tB1, tB2],
            winner: winner,
            goalsA: parsedGoalsA,
            goalsB: parsedGoalsB,
            eloDelta: Math.abs(delta),
            timestamp: Date.now(),
        });

        alert("Match submitted!");

        // Reset matchRefresh player dropdowns and leaderboard
        resetMatchForm();
        // await showLeaderboard();
        stopRecentMatchesListeners();
    });
}


// Function to reset the match form
export function resetMatchForm() {
    teamA1Select.value = "";
    teamA2Select.value = "";
    teamB1Select.value = "";
    teamB2Select.value = "";
    teamAgoalsInput.value = "0";
    teamBgoalsInput.value = "0";
}

const swapRedTeamHitbox = document.getElementById("swap_red_team_hitbox")
swapRedTeamHitbox.style.pointerEvents = "all";
swapRedTeamHitbox.addEventListener("click", () => {
  const tA1 = document.getElementById("teamA1");
  const tA2 = document.getElementById("teamA2");

  // Swap values
  [tA1.value, tA2.value] = [tA2.value, tA1.value];
})

const swapBlueTeamHitbox = document.getElementById("swap_blue_team_hitbox")
swapBlueTeamHitbox.style.pointerEvents = "all";
swapBlueTeamHitbox.addEventListener("click", () => {
  const tB1 = document.getElementById("teamB1");
  const tB2 = document.getElementById("teamB2");

  // Swap values
  [tB1.value, tB2.value] = [tB2.value, tB1.value];
})


// Swap teams button
document.getElementById('swapTeams').addEventListener('click', () => {
    const tempA1 = teamA1Select.value;
    const tempA2 = teamA2Select.value;
    const tempB1 = teamB1Select.value;
    const tempB2 = teamB2Select.value;

    teamA1Select.value = tempB1;
    teamA2Select.value = tempB2;
    teamB1Select.value = tempA1;
    teamB2Select.value = tempA2;
});

// Make it so goals dropdowns are set to MAX_GOALS when one is changed
document.getElementById("teamAgoals").addEventListener("change", function (e) {
  if (this.value === String(MAX_GOALS)) {
    return;
  }
  const other_goal_dropdown = document.getElementById("teamBgoals");
  other_goal_dropdown.value = String(MAX_GOALS);
});

document.getElementById("teamBgoals").addEventListener("change", function (e) {
  if (this.value === String(MAX_GOALS)) {
    return;
  }
  const other_goal_dropdown = document.getElementById("teamAgoals");
  other_goal_dropdown.value = String(MAX_GOALS);
});

// Initialize drag functionality for foosball rods (remains in app.js for now, or move to a separate `foosball-table-interactions.js`)
function makeRodDraggable(rod, options = {}) {
  let isDragging = false;
  let startX;
  let initialMatrix;
  let initialX; // saved once at load
  let currentDX = 0; // tracks current offset from initialX

  const {
    speed = 0.4,
    maxLeft = -15,
    maxRight = 15
  } = options;

  // Parse initial transform once at setup
  const tf = rod.getAttribute("transform");
  const match = tf.match(/matrix\(([^)]+)\)/);
  initialMatrix = match
    ? match[1].split(',').map(parseFloat)
    : [1, 0, 0, 1, 0, 0];
  initialX = initialMatrix[4];

  rod.addEventListener("mousedown", startDrag);
  rod.addEventListener("touchstart", startDrag, { passive: false });

  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;

    window.addEventListener("mousemove", drag);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", drag, { passive: false });
    window.addEventListener("touchend", endDrag);
  }

  function drag(e) {
    if (!isDragging) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = (clientX - startX) * speed;
    let newDX = currentDX + dx;

    // Clamp relative to initialX
    newDX = Math.max(maxLeft, Math.min(maxRight, newDX));

    const newMatrix = [...initialMatrix];
    newMatrix[4] = initialX + newDX;
    rod.setAttribute("transform", `matrix(${newMatrix.join(',')})`);
  }

  function endDrag(e) {
    isDragging = false;

    // Update currentDX so we accumulate properly
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const delta = (clientX - startX) * speed;
    currentDX = Math.max(maxLeft, Math.min(maxRight, currentDX + delta));

    window.removeEventListener("mousemove", drag);
    window.removeEventListener("mouseup", endDrag);
    window.removeEventListener("touchmove", drag);
    window.removeEventListener("touchend", endDrag);
  }
}

makeRodDraggable(document.getElementById("red-defense-rod"), {maxLeft: -7, maxRight: 5});
makeRodDraggable(document.getElementById("red-offense-rod"), {maxLeft: -9, maxRight: 5});
makeRodDraggable(document.getElementById("blue-defense-rod"), {maxLeft: -5, maxRight: 7});
makeRodDraggable(document.getElementById("blue-offense-rod"), {maxLeft: -5, maxRight: 9});
