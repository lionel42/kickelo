// 🔥 Firebase config:
const firebaseConfig = {
  apiKey: "AIzaSyBHGbErkiS33J_h5Xoanzhl6rC7yWo1R08",
  authDomain: "kickelo.firebaseapp.com",
  projectId: "kickelo",
  storageBucket: "kickelo.firebasestorage.app",
  messagingSenderId: "1075750769009",
  appId: "1:1075750769009:web:8a8b02540be5c9522be6d0"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const K = 40;  // K-factor for ELO rating

const MS = 1000;                    // milliseconds
const SESSION_GAP = 20 * 60 * MS;   // 20 minutes in ms

// Modal elements
// const btnSet = document.getElementById('btnSetActive');
const backdrop = document.getElementById('modalBackdrop');
const modal= document.getElementById('activeModal');
const modalBody = document.getElementById('modalBody');
const btnSave = document.getElementById('saveActive');
const btnCancel = document.getElementById('cancelActive');

// Firestore references
const sessionRef = db.collection('meta').doc('session');

// Open modal and load checkboxes
// btnSet.addEventListener('click', openModal);

// 1. Load the complete match history (ordered by timestamp asc)
async function loadRecentMatches(timePeriod = 36 * 60 * 60 * 1000) { // Default: last 36 hours
  const cutoffTimestamp = Date.now() - timePeriod;
  const snap = await db.collection('matches')
    .where('timestamp', '>=', cutoffTimestamp)
    .orderBy('timestamp', 'asc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// 2. Split out the “current session” by looking for gaps >20min
function splitSession(matches) {
  if (!matches.length) return { session: [], historic: [] };
  const now = Date.now();
  // find where recent play stops (gap >20min between successive)
  let cutoffIndex = matches.length;
  for (let i = matches.length - 1; i >= 0; i--) {
    const prevTs = i > 0 ? matches[i - 1].timestamp : matches[0].timestamp;
    const gap = matches[i].timestamp - prevTs;
    // if last match itself older than 20m ago, no session
    if (i === matches.length - 1 && now - matches[i].timestamp > SESSION_GAP) {
      cutoffIndex = matches.length;
      break;
    }
    if (gap > SESSION_GAP) {
      cutoffIndex = i;
      break;
    }
  }
  const session = matches.slice(cutoffIndex);
  const historic = matches.slice(0, cutoffIndex);
  return { session, historic };
}

// 3. Count how many times each active player played in session
function countPlaysPerPlayer(sessionMatches, activePlayers) {
  const count = {};
  activePlayers.forEach(n => count[n] = 0);
  sessionMatches.forEach(m => {
    [...m.teamA, ...m.teamB]
      .filter(p => activePlayers.includes(p))
      .forEach(p => count[p]++);
  });
  return count;
}

// 4. Co‑play and opposition counts
function buildCoAndOppCounts(matches, activePlayers) {
  // init maps
  const withCount = {}, againstCount = {};
  activePlayers.forEach(a => {
    withCount[a] = {};    // withCount[a][b] = times a & b were team‑mates
    againstCount[a] = {}; // againstCount[a][b] = times a played opposite b
    activePlayers.forEach(b => {
      if (a !== b) {
        withCount[a][b] = 0;
        againstCount[a][b] = 0;
      }
    });
  });

  matches.forEach(m => {
    const A = m.teamA, B = m.teamB;
    // team‑mates
    [A, B].forEach(team => {
      team.forEach(p1 => team.forEach(p2 => {
        if (p1 !== p2 && withCount[p1] && withCount[p2]) {
          withCount[p1][p2]++;
        }
      }));
    });
    // opponents
    A.forEach(pA => B.forEach(pB => {
      if (againstCount[pA] && againstCount[pB]) {
        againstCount[pA][pB]++;
        againstCount[pB][pA]++;
      }
    }));
  });

  return { withCount, againstCount };
}

// 5. Generate all possible unique 2‑vs‑2 pairings
function generatePairings(activePlayers) {
  const pairings = [];
  const n = activePlayers.length;
  // choose 4 distinct players i<j<k<l
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        for (let d = c + 1; d < n; d++) {
          const quad = [activePlayers[a], activePlayers[b], activePlayers[c], activePlayers[d]];
          // split quad into two teams of two
          const teams = [
            [[quad[0], quad[1]], [quad[2], quad[3]]],
            [[quad[0], quad[2]], [quad[1], quad[3]]],
            [[quad[0], quad[3]], [quad[1], quad[2]]],
          ];
          teams.forEach(t => pairings.push({ teamA: t[0], teamB: t[1] }));
        }
      }
    }
  }
  return pairings;
}

// 6. Scoring function
function scorePairing(p, data) {
  const {
    playsCount,
    countsSession,
    countsHistoric,
    sessionMatches,
    historicMatches,
    eloMap // build a map of latest Elo: name->rating
  } = data;

  // weights (adjust as you like)
  const w = {
    sessionPlays: 1000.0,
    sessionTeammateRepeat: 100.0, // typical value 0-2
    historicTeammateRepeat: 20.0, // typical value 0-6
    sessionOpponentRepeat: 40.0,  // typical value 0-4
    historicOpponentRepeat: 8.0,  // typical value 0-12
    intraTeamEloDiff: 0.1, // typical value 0-300
    interTeamEloDiff: 0.3, // typical value 0-300
  };

  const { teamA, teamB } = p;
  // 3. sum of plays in this session
  const playsSess = playsCount[teamA[0]] + playsCount[teamA[1]] +
                    playsCount[teamB[0]] + playsCount[teamB[1]];

  // 4. teammate repeats
  const repSessA = countsSession.withCount[teamA[0]][teamA[1]];
  const repSessB = countsSession.withCount[teamB[0]][teamB[1]];
  const repSess = repSessA + repSessB;
  // 4a. historic teammate repeats
  const repHistA = countsHistoric.withCount[teamA[0]][teamA[1]];
  const repHistB = countsHistoric.withCount[teamB[0]][teamB[1]];
  const repHist = repHistA + repHistB;

  // 5. opponent repeats (sum over all cross‑pairs)
  let oppRepSess = 0;
  teamA.forEach(a => teamB.forEach(b => {
    oppRepSess += countsSession.againstCount[a][b];
  }));
  // 5a. historic opponent repeats, normalized by total plays
  let oppRepHist = 0;
  teamA.forEach(a => teamB.forEach(b => {
    oppRepHist += countsSession.againstCount[a][b];
  }));

  // 6. intra‑team Elo difference
  const eloA0 = eloMap[teamA[0]], eloA1 = eloMap[teamA[1]];
  const eloB0 = eloMap[teamB[0]], eloB1 = eloMap[teamB[1]];
  const diffA = Math.abs(eloA0 - eloA1);
  const diffB = Math.abs(eloB0 - eloB1);
  const intraDiff = diffA + diffB;

  // 7. inter‑team Elo difference (match balance)
  const avgA = (eloA0 + eloA1) / 2;
  const avgB = (eloB0 + eloB1) / 2;
  const interDiff = Math.abs(avgA - avgB);

  // weighted sum (we negate factors we want to minimize)
  return 0
    - w.sessionPlays           * playsSess
    - w.sessionTeammateRepeat  * repSess
    - w.historicTeammateRepeat * repHist
    - w.sessionOpponentRepeat  * oppRepSess
    - w.historicOpponentRepeat * oppRepHist
    - w.intraTeamEloDiff       * intraDiff
    - w.interTeamEloDiff       * interDiff;
}

// Inject Elo map from Firestore players
async function loadEloMap(activePlayers) {
  const eloMap = {};
  const snaps = await db.collection('players')
    .where('__name__', 'in', activePlayers)
    .get();
  snaps.forEach(doc => eloMap[doc.id] = doc.data().elo);
  return eloMap;
}

// Main handler
document.getElementById('btnSuggest').onclick = () => {
  showPlayerModal(true); // open modal in "pairing" mode
};

async function suggestPairing() {
  // fetch active players
  const sessDoc = await db.collection('meta').doc('session').get();
  const activePlayers = (sessDoc.exists && sessDoc.data().activePlayers) || [];
  console.log('Active players:', activePlayers);

  // 1. load all matches in the last 36 hours
  const allMatches = await loadRecentMatches();
  console.log('Total matches:', allMatches.length);

  // 2. split into session vs historic
  const { session: sessionMatches, historic: historicMatches } = splitSession(allMatches);
  console.log('Session matches:', sessionMatches.length, 'Historic:', historicMatches.length);

  // 3. count plays per player in this session
  const playsCount = countPlaysPerPlayer(sessionMatches, activePlayers);
  console.log('Plays/session:', playsCount);

  // 4. co‑play & opposition counts
  const countsSession = buildCoAndOppCounts(sessionMatches, activePlayers);
  const countsHistoric = buildCoAndOppCounts(historicMatches, activePlayers);
  console.log('Session with/against:', countsSession);
  console.log('Historic with/against:', countsHistoric);

  // expose for debugging
  window.__pairingData = {
    activePlayers,
    allMatches,
    sessionMatches,
    historicMatches,
    playsCount,
    countsSession,
    countsHistoric
  };

  const data = window.__pairingData;
  // load Elo ratings
  data.eloMap = await loadEloMap(data.activePlayers);

  // 1. generate
  const candidates = generatePairings(data.activePlayers);
  console.log(`Generated ${candidates.length} pairings`);

  // 2. score
  const scored = candidates.map(p => ({
    pairing: p,
    score: scorePairing(p, data)
  }));

  // 3. sort descending (highest = best)
  scored.sort((a, b) => b.score - a.score);

  // 4. log top 5
  console.log('Top 5 pairings:');
  scored.slice(0, 5).forEach((s, i) => {
    console.log(
      `#${i+1} [${s.pairing.teamA.join('&')} vs ${s.pairing.teamB.join('&')}] ` +
      `score=${s.score.toFixed(2)}`
    );
  });

  // store for next steps
  window.__pairingData.candidates = scored;

  const best = scored[0].pairing;

  //Build side‑counts from all matches
  function buildSideCounts(allMatches) {
    const countA = {}, countB = {};
    allMatches.forEach(m => {
      m.teamA.forEach(p => {
        countA[p] = (countA[p] || 0) + 1;
        if (!(p in countB)) countB[p] = 0;
      });
      m.teamB.forEach(p => {
        countB[p] = (countB[p] || 0) + 1;
        if (!(p in countA)) countA[p] = 0;
      });
    });
    return { countA, countB };
  }

  // Cost of giving player p a red slot now:
  function redCost(p, countA, countB) {
    const a = countA[p] || 0;
    const b = countB[p] || 0;
    const newPctA = (a + 1) / (a + b + 1);
    return Math.abs(newPctA - 0.5);
  }

  // Cost for blue slot now:
  function blueCost(p, countA, countB) {
    const a = countA[p] || 0;
    const b = countB[p] || 0;
    const newPctA = a / (a + b + 1);
    return Math.abs(newPctA - 0.5);
  }

  // Decide best assignment
  const { countA, countB } = buildSideCounts(data.allMatches);
  const { teamA, teamB } = best;

  // Option 1: as is (teamA→red, teamB→blue)
  let cost1 = 0;
  teamA.forEach(p => cost1 += redCost(p, countA, countB));
  teamB.forEach(p => cost1 += blueCost(p, countA, countB));

  // Option 2: swap sides
  let cost2 = 0;
  teamA.forEach(p => cost2 += blueCost(p, countA, countB));
  teamB.forEach(p => cost2 += redCost(p, countA, countB));

  // Apply the lower‑cost option
  let redTeam, blueTeam;
  if (cost1 <= cost2) {
    redTeam  = teamA;
    blueTeam = teamB;
  } else {
    redTeam  = teamB;
    blueTeam = teamA;
  }

  // Fill the dropdowns
  document.getElementById('teamA1').value = redTeam[0];
  document.getElementById('teamA2').value = redTeam[1];
  document.getElementById('teamB1').value = blueTeam[0];
  document.getElementById('teamB2').value = blueTeam[1];
}


// Modal backdrop and body elements
async function showPlayerModal(triggerPairing = false) {
  backdrop.style.display = 'flex';
  // hide modal body for now
  modal.style.display = 'none';

  modalBody.innerHTML = '';

  // Load all players
  const snapshot = await db.collection('players').orderBy('name').get();
  const players = snapshot.docs.map(d => d.data().name);

  // Load saved active list
  const doc = await sessionRef.get();
  const active = doc.exists && doc.data().activePlayers || [];

  // Build checkboxes
  players.forEach(name => {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = name;
    if (active.includes(name)) cb.checked = true;
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(name));
    modalBody.appendChild(lbl);
  });

  // Attach handler
  btnSave.onclick = async () => {
    const checked = [...modalBody.querySelectorAll('input[type=checkbox]:checked')]
    .map(cb => cb.value);
    await sessionRef.set({ activePlayers: checked });
    backdrop.style.display = 'none';
      if (triggerPairing) {
        await suggestPairing();
      }
    }
  // Show modal body
  modal.style.display = '';
}

// function showPlayerModal(triggerPairing = false) {
//   const modal = document.getElementById('playerModal');
//   const list = document.getElementById('playerList');
//   const saveBtn = document.getElementById('savePlayersBtn');
//
//   // Clear existing list
//   list.innerHTML = '';
//
//   // Load player names
//   getPlayerNames().then(playerNames => {
//     getActivePlayers().then(active => {
//       playerNames.sort();
//       playerNames.forEach(name => {
//         const label = document.createElement('label');
//         label.innerHTML = `
//           <input type="checkbox" value="${name}" ${active.includes(name) ? 'checked' : ''}>
//           ${name}
//         `;
//         list.appendChild(label);
//       });
//
//       // Show modal
//       modal.style.display = 'block';
//
//       // Attach handler
//       saveBtn.onclick = () => {
//         const checkboxes = list.querySelectorAll('input[type=checkbox]');
//         const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
//         saveActivePlayers(selected).then(() => {
//           modal.style.display = 'none';
//           if (triggerPairing) {
//             suggestPairing();
//           }
//         });
//       };
//     });
//   });
// }


// btnSave.addEventListener('click', async () => {
//   const checked = [...modalBody.querySelectorAll('input[type=checkbox]:checked')]
//     .map(cb => cb.value);
//   await sessionRef.set({ activePlayers: checked });
//   backdrop.style.display = 'none';
// });

btnCancel.addEventListener('click', () => {
  backdrop.style.display = 'none';
});


async function getOrCreatePlayer(name) {
  const docRef = db.collection("players").doc(name);
  const doc = await docRef.get();
  if (!doc.exists) {
    await docRef.set({ name: name, elo: 1500 });
    return { name, elo: 1500 };
  } else {
    return doc.data();
  }
}

function expectedScore(r1, r2) {
  return 1 / (1 + Math.pow(10, (r2 - r1) / 400));
}

function updateRating(old, expected, score) {
  return Math.round(old + K * (score - expected));
}

async function loadPlayerDropdowns() {
  const playerSelectIds = ["teamA1", "teamA2", "teamB1", "teamB2"];
  try {
    console.log("Fetching players from Firestore...");
    const snapshot = await db.collection("players").get();
    const players = snapshot.docs.map(doc => doc.id); // IDs = player names
    console.log("Fetched players:", players);

    if (players.length === 0) {
      console.warn("No players found in the database.");
    }

    for (const id of playerSelectIds) {
      const select = document.getElementById(id);
      if (!select) {
        console.error(`Dropdown with id '${id}' not found.`);
        continue;
      }

      // If the dropdowns were already populated, save the currently selected value to restore it later
      const previousValue = select.value;

      select.innerHTML = ""; // Clear old options

      // Create default option
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "Select player";
      select.appendChild(defaultOpt);

      // Add player options
      for (const name of players) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      }

      // Add "+ Add new player…" option
      const newOpt = document.createElement("option");
      newOpt.value = "__add_new__";
      newOpt.textContent = "Add new player…";
      select.appendChild(newOpt);

      // Restore the previously selected value if it exists in the new options
      if (previousValue && players.includes(previousValue)) {
        select.value = previousValue; // Restore previous selection
      }

      // Listen for add-new
      select.addEventListener("change", async (e) => {
        if (e.target.value === "__add_new__") {
          const newName = prompt("Enter new player name:");
          if (newName) {
            // Check if the name is already taken
            const existingDoc = await db.collection("players").doc(newName).get();
            if (existingDoc.exists) {
              // Player already exists, alert the user
              alert(`Player "${newName}" already exists. Please choose a different name.`);
              e.target.value = ""; // Reset selection
              return;
            }
            // Validate new name
            if (!newName.trim()) {
              alert("Player name cannot be empty.");
              e.target.value = ""; // Reset selection
              return;
            }
            // Check for invalid characters. For simplicity, let's allow alphanumeric characters and underscores only.
            const validNamePattern = /^[a-zA-Z0-9_]+$/;
            if (!validNamePattern.test(newName)) {
              alert("Player name can only contain alphanumeric characters and underscores.");
              e.target.value = ""; // Reset selection
              return;
            }

            // Add new player to Firestore
            console.log(`Adding new player: ${newName}`);
            await db.collection("players").doc(newName).set({
              name: newName,
              elo: 1500,
              games: 0
            });
            await loadPlayerDropdowns(); // Refresh all dropdowns
            e.target.value = newName; // Select new player
          } else {
            console.log("Add new player canceled.");
            e.target.value = ""; // Reset if canceled
          }
        }
      });
    }
  } catch (error) {
    console.error("Error loading player dropdowns:", error);
  }
}

document.getElementById("swapTeams").addEventListener("click", () => {
  const tA1 = document.getElementById("teamA1");
  const tA2 = document.getElementById("teamA2");
  const tB1 = document.getElementById("teamB1");
  const tB2 = document.getElementById("teamB2");

  // Swap values
  [tA1.value, tB1.value] = [tB1.value, tA1.value];
  [tA2.value, tB2.value] = [tB2.value, tA2.value];
})

document.getElementById("submitMatchBtn").addEventListener("click", async (e) => {

  e.preventDefault();
  const tA1 = document.getElementById("teamA1").value.trim();
  const tA2 = document.getElementById("teamA2").value.trim();
  const tB1 = document.getElementById("teamB1").value.trim();
  const tB2 = document.getElementById("teamB2").value.trim();
  const winner = document.getElementById("winner").value;

  // Validate inputs
  // Check if a winner is selected
  if (!winner) return alert("You must select a winner");
  // Check if all players are selected
  if (!tA1 || !tA2 || !tB1 || !tB2) return alert("Enter all player names");
  // Check if all players are different
  if (new Set([tA1, tA2, tB1, tB2]).size < 4) {
      return alert("All players must be different");
  }

  const [pA1, pA2, pB1, pB2] = await Promise.all([
    getOrCreatePlayer(tA1),
    getOrCreatePlayer(tA2),
    getOrCreatePlayer(tB1),
    getOrCreatePlayer(tB2),
  ]);

  const teamARating = (pA1.elo + pA2.elo) / 2;
  const teamBRating = (pB1.elo + pB2.elo) / 2;

  const expectedA = expectedScore(teamARating, teamBRating);
  const scoreA = winner === "A" ? 1 : 0;
  const delta = Math.round(K * (scoreA - expectedA));


  // Ask user for confirmation to submit the match, printing a sentence of who won and who lost, as well as the elo change
  const winnerName = winner === "A" ? `${pA1.name} & ${pA2.name}` : `${pB1.name} & ${pB2.name}`;
  const loserName = winner === "A" ? `${pB1.name} & ${pB2.name}` : `${pA1.name} & ${pA2.name}`;
  const eloChange = Math.abs(delta);
  const message = `Confirm match submission:\n\nWinners: ${winnerName}\nLosers: ${loserName}\nElo change: ${eloChange}\n\nDo you want to submit this match?`;
  if (!confirm(message)) {
      return;
  }

  // Update players
  await Promise.all([
    db.collection("players").doc(tA1).update({ elo: pA1.elo + delta }),
    db.collection("players").doc(tA2).update({ elo: pA2.elo + delta }),
    db.collection("players").doc(tB1).update({ elo: pB1.elo - delta }),
    db.collection("players").doc(tB2).update({ elo: pB2.elo - delta }),
  ]);

  // Add match log
  await db.collection("matches").add({
    teamA: [tA1, tA2],
    teamB: [tB1, tB2],
    winner: winner,
    eloDelta: Math.abs(delta),
    timestamp: Date.now(),
  });

  alert("Match submitted!");

  // Refresh player dropdowns and leaderboard
  document.getElementById("matchForm").reset(); // Reset form fields
  await showLeaderboard();
  await updateMatchDisplay();
});

async function showLeaderboard() {
  const list = document.getElementById("leaderboard");
  list.innerHTML = "";
  const snapshot = await db.collection("players").orderBy("elo", "desc").get();
  let index = 0; // Initialize index for styling
  snapshot.forEach((doc) => {
    const { name, elo } = doc.data();
    const li = document.createElement("li");
    li.textContent = `${name}: ${elo}`;
    li.style.cursor = "pointer"; // Indicate clickable
    li.addEventListener("click", () => clickPlayer(name)); // Add click event

    // Apply styles for the top three spots
    if (index === 0) li.classList.add("gold");
    else if (index === 1) li.classList.add("silver");
    else if (index === 2) li.classList.add("bronze");
    index += 1; // Increment index for next player

    list.appendChild(li);
  });
}

function createMatchListItem(match, highlighted_player = null) {
  const li = document.createElement("li");

  let teamAPlayers = match.teamA.map(player => `<span style="color: #E6B6B2;">${player}</span>`).join(` <span style="color: #E6B6B2;">&</span> `);
  let teamBPlayers = match.teamB.map(player => `<span style="color: #9ac3c7;">${player}</span>`).join(` <span style="color: #9ac3c7;">&</span> `);

  let winner = match.winner === "A" ? teamAPlayers : teamBPlayers;
  let loser = match.winner === "A" ? teamBPlayers : teamAPlayers;

  if (highlighted_player) {
    const isInTeamA = match.teamA.includes(highlighted_player);
    const isInTeamB = match.teamB.includes(highlighted_player);

    if (!isInTeamA && !isInTeamB) {
      console.warn(`Player ${highlighted_player} not found in either team.`);
      console.log(`Match details:`, match);
    }
    console.log(`Highlighting player: ${highlighted_player}`);

    if (isInTeamA) {
      teamAPlayers = `<span style="color: #E6B6B2">${highlighted_player}</span>` +
        (match.teamA.length > 1 ? ` <span style="color: #E6B6B2;">&</span> ` + match.teamA.filter(p => p !== highlighted_player).map(player => `<span style="color: #E6B6B2;">${player}</span>`).join(` <span style="color: #E6B6B2;">&</span> `): "");
    } else if (isInTeamB) {
      teamBPlayers = `<span style="color: #9ac3c7">${highlighted_player}</span>` +
        (match.teamB.length > 1 ? ` <span style="color: #9ac3c7;">&</span> ` + match.teamB.filter(p => p !== highlighted_player).map(player => `<span style="color: #9ac3c7;">${player}</span>`).join(` <span style="color: #9ac3c7;">&</span> `): "");
    }
    // Update winner and loser based on highlighted player
    if (match.winner === "B") {
      if (isInTeamA) {
        li.innerHTML = `${teamAPlayers} lost to ${teamBPlayers} <span style="font-size: 0.9em; color: gray;">(Elo Δ: ${match.eloDelta || 0})</span>`;
      } else if (isInTeamB) {
        li.innerHTML = `${teamBPlayers} won against ${teamAPlayers} <span style="font-size: 0.9em; color: gray;">(Elo Δ: ${match.eloDelta || 0})</span>`;
      }
      return li;
    } else if (match.winner === "A") {
      if (isInTeamA) {
        li.innerHTML = `${teamAPlayers} won against ${teamBPlayers} <span style="font-size: 0.9em; color: gray;">(Elo Δ: ${match.eloDelta || 0})</span>`;
      } else if (isInTeamB) {
        li.innerHTML = `${teamBPlayers} lost to ${teamAPlayers} <span style="font-size: 0.9em; color: gray;">(Elo Δ: ${match.eloDelta || 0})</span>`;
      }
      return li;
    }
  }

  li.innerHTML = `${winner} won against ${loser} <span style="font-size: 0.9em; color: gray;">(Elo Δ: ${match.eloDelta || 0})</span>`;
  return li;
}

async function showRecentMatches() {
  const list = document.getElementById("recentMatches");
  const heading = document.getElementById("recentMatchesHeading");

  // Fade out the heading and list
  heading.classList.add("hidden");
  list.classList.add("hidden");

  // Wait for the fade-out transition to complete
  setTimeout(() => {
    // Reset the heading text
    heading.textContent = "Recent Matches";
    heading.classList.remove("hidden"); // Fade in the heading

    list.innerHTML = ""; // Clear the list

    db.collection("matches")
      .orderBy("timestamp", "desc")
      .limit(10)
      .get()
      .then((matches) => {
        matches.forEach((doc) => {
          const match = doc.data();
          const li = createMatchListItem(match);
          list.appendChild(li);
        });

        // Fade in the list
        list.classList.remove("hidden");
      })
      .catch((error) => {
        console.error("Error fetching recent matches:", error);
      });
  }, 150); // Match the duration of the CSS transition
}


async function clickPlayer(playerName) {
    // This function is called when a player is clicked in the leaderboard
    // If the player is already selected, deselect them
    const list = document.getElementById("leaderboard");
    const items = list.getElementsByTagName("li");
    for (let item of items) {
        if (item.textContent.startsWith(playerName + ":")) {
            if (item.classList.contains("selected-player")) {
                item.classList.remove("selected-player"); // Deselect player
                await showRecentMatches();
            } else {
                selectPlayer(playerName); // Select player
            }
            return; // Exit after handling the click
        }
    }
}


async function selectPlayer(playerName) {
    // This function is called when a player is selected from the leaderboard
    // Mark the selected player in the leaderboard

    const list = document.getElementById("leaderboard");
    const items = list.getElementsByTagName("li");
    for (let item of items) {
        if (item.textContent.startsWith(playerName + ":")) {
            // Highlight selected player
            item.classList.add("selected-player");
        } else {
            // Reset others
            item.classList.remove("selected-player");
        }
    }
    // Show the player's matches
    await showPlayerMatches(playerName);
}

async function showPlayerMatches(playerName) {
  const list = document.getElementById("recentMatches");
  const heading = document.getElementById("recentMatchesHeading");

  // Fade out the heading
  heading.classList.add("hidden");

  // Add the 'hidden' class to fade out the list
  list.classList.add("hidden");

  try {
    const n_matches = 10
    const snapshot = await db.collection("matches")
      .where("teamA", "array-contains", playerName)
      .orderBy("timestamp", "desc")
      .limit(n_matches)
      .get();

    const snapshotB = await db.collection("matches")
      .where("teamB", "array-contains", playerName)
      .orderBy("timestamp", "desc")
      .limit(n_matches)
      .get();

    const matches = [...snapshot.docs, ...snapshotB.docs];
    matches.sort((a, b) => b.data().timestamp - a.data().timestamp); // Sort by timestamp

    // take only the most recent n_matches
    matches.splice(n_matches);

    // Wait for the fade-out transition to complete
    setTimeout(() => {
      // Update the heading text
      heading.textContent = `Recent Matches of ${playerName}`;
      heading.classList.remove("hidden"); // Fade in the heading

      list.innerHTML = ""; // Clear the list
      matches.forEach(doc => {
        const match = doc.data();
        const li = createMatchListItem(match, playerName);
        list.appendChild(li);
      });

      // Remove the 'hidden' class to fade in the list
      list.classList.remove("hidden");
    }, 150); // Match the duration of the CSS transition
  } catch (error) {
    console.error("Error fetching matches for player:", error);
  }
}

async function updateMatchDisplay() {
  const selectedPlayer = document.querySelector(".selected-player");
  if (selectedPlayer) {
    const playerName = selectedPlayer.textContent.split(":")[0];
    await showPlayerMatches(playerName);
  } else {
    await showRecentMatches(); // Show recent matches if no player is selected
  }
}

// On load: if no session doc, prompt once
window.onload = async () => {
  await loadPlayerDropdowns();
  await showLeaderboard();
  await showRecentMatches();
  console.log("Page loaded and initialized.");
};