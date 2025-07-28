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

const K = 40;

// Modal elements
const btnSet = document.getElementById('btnSetActive');
const backdrop = document.getElementById('modalBackdrop');
const modalBody = document.getElementById('modalBody');
const btnSave = document.getElementById('saveActive');
const btnCancel = document.getElementById('cancelActive');

// Firestore references
const sessionRef = db.collection('meta').doc('session');

// Open modal and load checkboxes
btnSet.addEventListener('click', openModal);
btnSuggest.addEventListener('click', () => {
  // your suggest logic...
});

async function openModal() {
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

  backdrop.style.display = 'flex';
}

btnSave.addEventListener('click', async () => {
  const checked = [...modalBody.querySelectorAll('input[type=checkbox]:checked')]
    .map(cb => cb.value);
  await sessionRef.set({ activePlayers: checked });
  backdrop.style.display = 'none';
});

btnCancel.addEventListener('click', () => {
  backdrop.style.display = 'none';
});

// On load: if no session doc, prompt once
window.onload = async () => {
  const doc = await sessionRef.get();
  if (!doc.exists) openModal();
  loadLeaderboard();
  loadPlayerDropdowns();
};

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
  console.log(snapshot)
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

  let teamAPlayers = match.teamA.map(player => `<span style="color: #d20000;">${player}</span>`).join(" & ");
  let teamBPlayers = match.teamB.map(player => `<span style="color: #0b0bd2;">${player}</span>`).join(" & ");

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
      teamAPlayers = `<span style="color: #d20000">${highlighted_player}</span>` +
        (match.teamA.length > 1 ? " & " + match.teamA.filter(p => p !== highlighted_player).map(player => `<span style="color: #d20000;">${player}</span>`).join(" & ") : "");
    } else if (isInTeamB) {
      teamBPlayers = `<span style="color: #0b0bd2">${highlighted_player}</span>` +
        (match.teamB.length > 1 ? " & " + match.teamB.filter(p => p !== highlighted_player).map(player => `<span style="color: #0b0bd2;">${player}</span>`).join(" & ") : "");
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
    const snapshot = await db.collection("matches")
      .where("teamA", "array-contains", playerName)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    const snapshotB = await db.collection("matches")
      .where("teamB", "array-contains", playerName)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    const matches = [...snapshot.docs, ...snapshotB.docs];
    matches.sort((a, b) => b.data().timestamp - a.data().timestamp); // Sort by timestamp

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

// show leader board and load player dropdowns on page load
window.onload = async () => {
  await loadPlayerDropdowns();
  await showLeaderboard();
  await showRecentMatches();
  console.log("Page loaded and initialized.");
};