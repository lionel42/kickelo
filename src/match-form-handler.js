// src/match-form-handler.js

import { db, doc, addDoc, updateDoc, collection } from './firebase-service.js';
import { serverTimestamp } from "firebase/firestore";
import { expectedScore, updateRating } from './elo-service.js';
import { getOrCreatePlayer } from './player-manager.js';
import {
    teamA1Select, teamA2Select, teamB1Select, teamB2Select,
    teamAgoalsInput, teamBgoalsInput, submitMatchBtn,
    toggleLiveMode, liveMatchPanel, btnBlueScored, btnRedScored, goalTimeline, liveModeStatus,
    vibrationSeismograph, uploadIndicator,
    positionConfirmationContainer, positionsConfirmedCheckbox
} from './dom-elements.js';
import { MAX_GOALS } from './constants.js';
import { evaluateLastSuggestion, clearLastSuggestion } from './pairing-service.js';

function buildWaitingPlayers(activePlayers = [], teamA = [], teamB = []) {
    if (!Array.isArray(activePlayers) || activePlayers.length === 0) return [];
    const playingSet = new Set([...teamA, ...teamB]);
    return activePlayers.filter(player => !playingSet.has(player));
}

function buildPairingMetadata(teamA, teamB) {
    const evaluation = evaluateLastSuggestion(teamA, teamB);
    if (!evaluation.hasSuggestion) {
        return { source: 'manual' };
    }
    const waitingPlayers = buildWaitingPlayers(evaluation.activePlayers, teamA, teamB);
    if (evaluation.pairingMatched) {
        return {
            source: 'suggested',
            suggestedAt: evaluation.suggestedAt,
            waitingPlayers
        };
    }
    if (evaluation.isFresh) {
        return {
            source: 'manual',
            suggestedAt: evaluation.suggestedAt,
            waitingPlayers
        };
    }
    return { source: 'manual' };
}

export function setupMatchForm() {
    submitMatchBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const tA1 = teamA1Select.value.trim();
        const tA2 = teamA2Select.value.trim();
        const tB1 = teamB1Select.value.trim();
        const tB2 = teamB2Select.value.trim();

        let parsedGoalsA, parsedGoalsB;
        if (liveMode) {
            parsedGoalsA = goalLog.filter(g => g.team === 'red').length;
            parsedGoalsB = goalLog.filter(g => g.team === 'blue').length;
        } else {
            const goalsA = teamAgoalsInput.value.trim();
            const goalsB = teamBgoalsInput.value.trim();
            if (!/^[0-9]+$/.test(goalsA) || !/^[0-9]+$/.test(goalsB)) {
                return alert("Goals must be valid numbers.");
            }
            parsedGoalsA = parseInt(goalsA, 10);
            parsedGoalsB = parseInt(goalsB, 10);
        }
        if (parsedGoalsA === parsedGoalsB) {
            return alert("Cannot submit a tie.");
        }
        if (parsedGoalsA > MAX_GOALS || parsedGoalsB > MAX_GOALS) {
            return alert(`Goals cannot exceed ${MAX_GOALS}.`);
        }
        // Enforce that one team has exactly MAX_GOALS and the other less
        if (!(parsedGoalsA === MAX_GOALS && parsedGoalsB < MAX_GOALS) && !(parsedGoalsB === MAX_GOALS && parsedGoalsA < MAX_GOALS)) {
            return alert(`One team must have exactly ${MAX_GOALS} goals, the other less.`);
        }

        // --- Build teams, allow 1v1 or 2v2 ---
        // For each team, if both positions are the same or one is blank, use only one player
        let teamA = [];
        if (tA1 && tA2) {
            if (tA1 === tA2) teamA = [tA1];
            else teamA = [tA1, tA2];
        } else if (tA1) {
            teamA = [tA1];
        } else if (tA2) {
            teamA = [tA2];
        }
        let teamB = [];
        if (tB1 && tB2) {
            if (tB1 === tB2) teamB = [tB1];
            else teamB = [tB1, tB2];
        } else if (tB1) {
            teamB = [tB1];
        } else if (tB2) {
            teamB = [tB2];
        }

        // Validation: at least one player per team
        if (teamA.length === 0 || teamB.length === 0) {
            return alert("Each team must have at least one player.");
        }
        // Validation: no player can be on both teams
        const allPlayers = [...teamA, ...teamB];
        const uniquePlayers = new Set(allPlayers);
        if (uniquePlayers.size < allPlayers.length) {
            return alert("A player cannot play on both teams.");
        }
        // Validation: Ensure equal team sizes
        if (teamA.length !== teamB.length) {
            return alert("Both teams must have the same number of players (1v1 or 2v2).");
        }

        if (requiresPositionConfirmation() && !isPositionConfirmationChecked()) {
            const proceedWithoutPositions = confirm(
                "You haven't confirmed the offense/defense positions. Submit anyway without logging them?\n\n" +
                "If you want them recorded, check the 'Positions confirmed' box below the player selects before submitting."
            );
            if (!proceedWithoutPositions) {
                positionsConfirmedCheckbox?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                positionsConfirmedCheckbox?.focus();
                return;
            }
        }

        const winner = parsedGoalsA > parsedGoalsB ? "A" : "B";

        // Get player documents (getOrCreatePlayer for each unique player)
        const playerNames = Array.from(uniquePlayers);
        const playerDocs = await Promise.all(playerNames.map(getOrCreatePlayer));
        const playerMap = {};
        playerDocs.forEach(p => { playerMap[p.name] = p; });

        // Calculate team ratings (average of team members)
        const teamARating = teamA.reduce((sum, name) => sum + playerMap[name].elo, 0) / teamA.length;
        const teamBRating = teamB.reduce((sum, name) => sum + playerMap[name].elo, 0) / teamB.length;
        const expectedA = expectedScore(teamARating, teamBRating);
        const scoreA = winner === "A" ? 1 : 0;
        const delta = updateRating(0, expectedA, scoreA);

        // Confirmation message
        const winnerNames = winner === "A" ? teamA.join(" & ") : teamB.join(" & ");
        const loserNames = winner === "A" ? teamB.join(" & ") : teamA.join(" & ");
        const eloChange = Math.abs(delta);
        const winnerGoals = winner === "A" ? parsedGoalsA : parsedGoalsB;
        const loserGoals = winner === "A" ? parsedGoalsB : parsedGoalsA;
        const message = `Confirm match submission:\n\nWinners: ${winnerNames}\nLosers: ${loserNames}\nScore: ${winnerGoals}:${loserGoals}\nElo change: ${eloChange}\n\nDo you want to submit this match?`;
        if (!confirm(message)) {
            return;
        }

    const pairingMetadata = buildPairingMetadata(teamA, teamB);
    console.log("Pairing metadata for submitted match:", pairingMetadata);
    const positionsConfirmedState = getPositionConfirmationState();


        // Update players' ELO and games count
        const matchesColRef = collection(db, 'matches');
        const playersColRef = collection(db, 'players');
        // For each player, update ELO and games
        const updatePromises = [];
        teamA.forEach(name => {
            const p = playerMap[name];
            updatePromises.push(updateDoc(doc(playersColRef, name), { elo: p.elo + delta, games: (p.games || 0) + 1 }));
        });
        teamB.forEach(name => {
            const p = playerMap[name];
            updatePromises.push(updateDoc(doc(playersColRef, name), { elo: p.elo - delta, games: (p.games || 0) + 1 }));
        });
        await Promise.all(updatePromises);

        // Add match log
        try {
            // 1. Build match data object
            const matchData = {
                teamA: teamA,
                teamB: teamB,
                winner: winner,
                goalsA: parsedGoalsA,
                goalsB: parsedGoalsB,
                eloDelta: Math.abs(delta),
                timestamp: serverTimestamp(),
                pairingMetadata,
                positionsConfirmed: positionsConfirmedState,
                ...(liveMode && goalLog.length > 0 ? { goalLog: goalLog.slice(), matchDuration: Date.now() - matchStartTime } : {})
            };

            // 2. Add match to Firestore first
            const matchDocRef = await addDoc(matchesColRef, matchData);
            clearLastSuggestion();

            // 3. If vibration tracking enabled, upload log to Storage and update match doc
            if (vibrationTrackingEnabled && vibrationLog.length > 0) {
                try {
                    uploadIndicator.style.display = 'flex';
                    const { storage, storageRef } = await import('./firebase-service.js');
                    const logPath = `vibrationLogs/${matchDocRef.id}.json`;
                    const fileRef = storageRef(storage, logPath);
                    const logBlob = new Blob([JSON.stringify(vibrationLog)], { type: 'application/json' });
                    await (await import('firebase/storage')).uploadBytes(fileRef, logBlob);
                    await updateDoc(matchDocRef, { vibrationLogPath: logPath });
                    // wait for a second to admire the loading animation
                    await new Promise(res => setTimeout(res, 1000));
                    console.log("Vibration log uploaded successfully.");
                } catch (uploadError) {
                    console.log("Vibration log upload failed:", uploadError.message || uploadError);
                    alert("Vibration log upload failed. Match was still submitted, but without vibration log.");
                } finally {
                    uploadIndicator.style.display = 'none';
                    stopVibrationTracking();
                    // wait until uploadIndicator is hidden
                    await new Promise(res => setTimeout(res, 300));
                }
            }

            alert("Match submitted!");
            resetMatchForm();
            setLiveMode(false, true); // Reset to final score mode after submit
            stopLiveMatchTimer(); // Stop timer after submit
        } catch (error) {
            console.error("Error submitting match:", error.message || error);

            alert("Failed to submit match. Check the console for more details.");
        }
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
    stopLiveMatchTimer(); // Also stop timer on reset
    updatePositionConfirmationUI();
}

const swapRedTeamHitbox = document.getElementById("swap_red_team_hitbox")
if (swapRedTeamHitbox) {
    swapRedTeamHitbox.style.pointerEvents = "all";
    swapRedTeamHitbox.addEventListener("click", () => {
        [teamA1Select.value, teamA2Select.value] = [teamA2Select.value, teamA1Select.value];
        triggerArrowAnimation('A');
        flashSelectGroup([teamA1Select, teamA2Select]);
        notifyRolesChanged('A');
    });
}

const swapBlueTeamHitbox = document.getElementById("swap_blue_team_hitbox")
if (swapBlueTeamHitbox) {
    swapBlueTeamHitbox.style.pointerEvents = "all";
    swapBlueTeamHitbox.addEventListener("click", () => {
        [teamB1Select.value, teamB2Select.value] = [teamB2Select.value, teamB1Select.value];
        triggerArrowAnimation('B');
        flashSelectGroup([teamB1Select, teamB2Select]);
        notifyRolesChanged('B');
    });
}


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
    flashSelectGroup([teamA1Select, teamA2Select, teamB1Select, teamB2Select]);
    notifyRolesChanged();
});

// Make it so goals dropdowns are set to MAX_GOALS when one is changed
document.getElementById("teamAgoals").addEventListener("change", function () {
  if (this.value === String(MAX_GOALS)) {
    return;
  }
  const other_goal_dropdown = document.getElementById("teamBgoals");
  other_goal_dropdown.value = String(MAX_GOALS);
});

document.getElementById("teamBgoals").addEventListener("change", function () {
  if (this.value === String(MAX_GOALS)) {
    return;
  }
  const other_goal_dropdown = document.getElementById("teamAgoals");
  other_goal_dropdown.value = String(MAX_GOALS);
});

// --- Experimental Vibration Tracking ---
let vibrationTrackingEnabled = false;
let vibrationLog = [];
let vibrationListener = null;
let vibrationDrawInterval = null;

function promptVibrationTracking() {
    return new Promise((resolve) => {
        const consent = window.confirm(
            'Enable vibration tracking for this match? (Experimental)\n\nThis will record accelerometer data while live mode is active.'
        );
        resolve(consent);
    });
}

function startVibrationTracking() {
    console.log("Starting vibration tracking...");
    vibrationTrackingEnabled = true;
    vibrationLog = [];
    if (!window.DeviceMotionEvent) {
        console.error('DeviceMotion API not supported on this device/browser.');
        alert('DeviceMotion API not supported on this device/browser.');
        vibrationTrackingEnabled = false;
        return;
    }
    vibrationSeismograph.style.display = '';
    // Listen for device motion events
    vibrationListener = function(event) {
        // console.log(event);
        const { x, y, z } = event.acceleration || {};
        if (x == null || y == null || z == null) {
            console.warn('Incomplete accelerometer data received.');
            return;
        }
        vibrationLog.push({
            t: Date.now(),
            x, y, z
        });
    };
    window.addEventListener('devicemotion', vibrationListener);
    // Start drawing the seismograph
    vibrationDrawInterval = setInterval(drawVibrationSeismograph, 50);
}

function stopVibrationTracking() {
    console.log("Stopping vibration tracking...");
    if (vibrationListener) {
        window.removeEventListener('devicemotion', vibrationListener);
        vibrationListener = null;
    }
    if (vibrationDrawInterval) {
        clearInterval(vibrationDrawInterval);
        vibrationDrawInterval = null;
    }
    vibrationSeismograph.style.display = 'none';
    vibrationTrackingEnabled = false;
}

function drawVibrationSeismograph() {
    const ctx = vibrationSeismograph.getContext('2d');
    const width = vibrationSeismograph.width;
    const height = vibrationSeismograph.height;
    ctx.clearRect(0, 0, width, height);
    // Show last 10 seconds
    const now = Date.now();
    const windowMs = 10000;
    const minT = now - windowMs;
    const samples = vibrationLog.filter(d => d.t >= minT);
    if (samples.length < 2) return;
    // Compute magnitude
    const mags = samples.map(d => Math.sqrt(d.x*d.x + d.y*d.y + d.z*d.z));
    // Normalize
    const maxMag = Math.max(1, ...mags);
    ctx.strokeStyle = '#6cabc2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples.length; ++i) {
        const x = (samples[i].t - minT) / windowMs * width;
        const y = height - (mags[i] / maxMag) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
}

// --- Live Mode Integration ---
let liveMode = false;
let goalLog = [];
let matchStartTime = 0;
let liveTimerInterval = null; // Timer interval for live match

// Refactored setLiveMode to handle vibration tracking natively
async function setLiveMode(enabled, skipPrompt = false) {
    if (enabled === liveMode) return;
    if (!enabled && goalLog.length > 0 && !skipPrompt) {
        if (!confirm('Switching to Final Score Mode will discard the live goal log. Continue?')) return;
        goalLog = [];
    }
    if (enabled) {
        // Prompt for vibration tracking
        const consent = await promptVibrationTracking();
        // const consent = false; // Disable vibration tracking for now
        if (consent) {
            startVibrationTracking();
        } else {
            stopVibrationTracking();
        }
    } else {
        stopVibrationTracking();
    }
    liveMode = enabled;
    liveMatchPanel.style.display = enabled ? 'flex' : 'none';
    toggleLiveMode.style.display = enabled ? 'none' : '';
    const cancelBtn = document.getElementById('cancelLiveMode');
    if (cancelBtn) cancelBtn.style.display = enabled ? '' : 'none';
    toggleLiveMode.classList.toggle('active', enabled);
    toggleLiveMode.textContent = enabled ? 'Live Match Mode' : 'Start live mode';
    // Fix: Hide liveModeStatus span when not needed to remove gap
    liveModeStatus.style.display = enabled ? '' : 'none';
    liveModeStatus.textContent = '';
    teamAgoalsInput.disabled = enabled;
    teamBgoalsInput.disabled = enabled;
    if (enabled) {
        matchStartTime = Date.now();
        goalLog = [];
        renderGoalTimeline();
        teamAgoalsInput.value = '0';
        teamBgoalsInput.value = '0';
        startLiveMatchTimer();
        // Fix: Always show timer when live mode starts
        const timerElem = document.getElementById('liveMatchTimer');
        if (timerElem) timerElem.style.display = 'inline-block';
    } else {
        matchStartTime = null;
        goalLog = [];
        renderGoalTimeline();
        stopLiveMatchTimer();
        // Fix: Hide timer when not in live mode
        const timerElem = document.getElementById('liveMatchTimer');
        if (timerElem) timerElem.style.display = 'none';
    }
}

toggleLiveMode.addEventListener('click', () => setLiveMode(!liveMode));


function syncScoreSelectors() {
    // Always update selectors in live mode
    let redGoals = goalLog.filter(g => g.team === 'red').length;
    let blueGoals = goalLog.filter(g => g.team === 'blue').length;
    teamAgoalsInput.value = redGoals;
    teamBgoalsInput.value = blueGoals;
}

// Cancel button logic
const cancelBtn = document.getElementById('cancelLiveMode');
if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        setLiveMode(false);
    });
}

function startLiveMatchTimer() {
    const timerElem = document.getElementById('liveMatchTimer');
    if (!timerElem) return;
    timerElem.style.display = 'inline-block';
    function updateTimer() {
        if (!liveMode || !matchStartTime) return;
        const elapsed = Date.now() - matchStartTime;
        timerElem.textContent = formatMsToMMSS(elapsed);
    }
    updateTimer();
    liveTimerInterval = setInterval(updateTimer, 1000);
}

function stopLiveMatchTimer() {
    const timerElem = document.getElementById('liveMatchTimer');
    if (liveTimerInterval) {
        clearInterval(liveTimerInterval);
        liveTimerInterval = null;
    }
    if (timerElem) {
        timerElem.textContent = '00:00';
        timerElem.style.display = 'none';
    }
}


function formatMsToMMSS(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function renderGoalTimeline() {
    goalTimeline.innerHTML = '';
    let redGoals = 0, blueGoals = 0;
    goalLog.forEach((goal, idx) => {
        if (goal.team === 'red') redGoals++;
        else blueGoals++;
        const div = document.createElement('span');
        div.className = 'goal-log-item ' + goal.team;
        const timeStr = formatMsToMMSS(goal.timestamp);
        div.textContent = `${goal.team === 'red' ? 'Red' : 'Blue'} #${goal.team === 'red' ? redGoals : blueGoals} (${timeStr})`;
        // Add remove button
        const btn = document.createElement('button');
        btn.className = 'goal-remove-btn';
        btn.type = 'button';
        btn.title = 'Remove this goal';
        btn.innerHTML = '&times;';
        btn.onclick = () => {
            if (confirm('Remove this goal from the log?')) {
                goalLog.splice(idx, 1);
                renderGoalTimeline();
                syncScoreSelectors();
                updateScoredButtons();
            }
        };
        div.appendChild(btn);
        goalTimeline.appendChild(div);
    });
    syncScoreSelectors();
    updateScoredButtons();
}

function updateScoredButtons() {
    if (!liveMode) {
        btnRedScored.disabled = false;
        btnBlueScored.disabled = false;
        return;
    }
    const redGoals = goalLog.filter(g => g.team === 'red').length;
    const blueGoals = goalLog.filter(g => g.team === 'blue').length;
    btnRedScored.disabled = redGoals >= MAX_GOALS;
    btnBlueScored.disabled = blueGoals >= MAX_GOALS;
}

btnRedScored.addEventListener('click', () => {
    if (!liveMode) return;
    const redGoals = goalLog.filter(g => g.team === 'red').length;
    if (redGoals >= MAX_GOALS) return;
    goalLog.push({ team: 'red', timestamp: Date.now() - matchStartTime });
    renderGoalTimeline();
    syncScoreSelectors(); // Ensure score display updates
});
btnBlueScored.addEventListener('click', () => {
    if (!liveMode) return;
    const blueGoals = goalLog.filter(g => g.team === 'blue').length;
    if (blueGoals >= MAX_GOALS) return;
    goalLog.push({ team: 'blue', timestamp: Date.now() - matchStartTime });
    renderGoalTimeline();
    syncScoreSelectors(); // Ensure score display updates
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


const redTeamArrow = document.querySelector('#red-swap-arrow');
const blueTeamArrow = document.querySelector('#blue-swap-arrow');

function triggerArrowAnimation(team) {
    const arrow = team === 'A' ? redTeamArrow : blueTeamArrow;
    if (!arrow) return;
    arrow.classList.remove('is-animating');
    arrow.getBoundingClientRect();
    requestAnimationFrame(() => {
        arrow.classList.add('is-animating');
    });
}

function flashSelect(select) {
    if (!select) return;
    select.classList.remove('flash-border');
    select.getBoundingClientRect();
    requestAnimationFrame(() => {
        select.classList.add('flash-border');
        select.addEventListener('animationend', () => {
            select.classList.remove('flash-border');
        }, { once: true });
    });
}

function flashSelectGroup(selects = []) {
    selects.forEach(flashSelect);
}

export function updateTeamArrowState(team, reset = false) {
    const isTeamA = team === 'A';
    const select1 = isTeamA ? teamA1Select : teamB1Select;
    const select2 = isTeamA ? teamA2Select : teamB2Select;
    const arrow = isTeamA ? redTeamArrow : blueTeamArrow;

    if (!arrow) {
        return;
    }

    // Check if reset is set or if both dropdowns have values
    const isComplete = !reset && (select1.value.trim() || select2.value.trim());

    // Update arrow color - using team colors from your existing code
    // const color = isComplete ? (isTeamA ? '#ce848c' : '#6cabc2') : '#00000000';
    const color = isComplete ? (isTeamA ? '#999999' : '#999999') : '#00000000';
    arrow.querySelectorAll('path').forEach(path => {
        path.style.stroke = color;
    });
}

// Add event listeners to all dropdowns
[teamA1Select, teamA2Select].forEach(select => {
    if (!select) return;
    select.addEventListener('change', () => handleRoleSelectionChange('A'));
});

[teamB1Select, teamB2Select].forEach(select => {
    if (!select) return;
    select.addEventListener('change', () => handleRoleSelectionChange('B'));
});

// Initial state update
updateTeamArrowState('A', true);
updateTeamArrowState('B', true);
updatePositionConfirmationUI();

if (positionsConfirmedCheckbox) {
    positionsConfirmedCheckbox.addEventListener('change', () => {
        updateSubmitMatchButtonState();
    });
}

function areAllRolesFilled() {
    const selects = [teamA1Select, teamA2Select, teamB1Select, teamB2Select];
    return selects.every(select => Boolean(getFilledRoleValue(select)));
}

function requiresPositionConfirmation() {
    return positionConfirmationContainer && positionConfirmationContainer.classList.contains('visible');
}

function isPositionConfirmationChecked() {
    return positionsConfirmedCheckbox && positionsConfirmedCheckbox.checked;
}

function updatePositionConfirmationUI() {
    if (!positionConfirmationContainer || !positionsConfirmedCheckbox) return;
    const shouldShow = areAllRolesFilled();
    positionConfirmationContainer.classList.toggle('visible', shouldShow);
    positionConfirmationContainer.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    if (!shouldShow) {
        positionsConfirmedCheckbox.checked = false;
    }
    updateSubmitMatchButtonState();
}

function updateSubmitMatchButtonState() {
    if (!submitMatchBtn) return;
    const needsPositionConfirmation = requiresPositionConfirmation() && !isPositionConfirmationChecked();
    submitMatchBtn.disabled = false;
    submitMatchBtn.title = needsPositionConfirmation
        ? "Positions aren't confirmed yet. Check the box if you want them logged."
        : '';
}

function handleRoleSelectionChange(team) {
    updateTeamArrowState(team);
    if (positionsConfirmedCheckbox && positionsConfirmedCheckbox.checked) {
        positionsConfirmedCheckbox.checked = false;
    }
    updatePositionConfirmationUI();
}

function getFilledRoleValue(select) {
    if (!select) return '';
    const value = (select.value || '').trim();
    if (!value || value === '__add_new__') return '';
    return value;
}

function getPositionConfirmationState() {
    if (!positionConfirmationContainer) return null;
    const isVisible = positionConfirmationContainer.classList.contains('visible');
    if (!isVisible) return null;
    return Boolean(isPositionConfirmationChecked());
}

export function notifyRolesChanged(team = null) {
    if (team === 'A' || team === 'B') {
        handleRoleSelectionChange(team);
        return;
    }
    handleRoleSelectionChange('A');
    handleRoleSelectionChange('B');
}