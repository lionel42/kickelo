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

const K = 32;

async function getOrCreatePlayer(name) {
  const docRef = db.collection("players").doc(name);
  const doc = await docRef.get();
  if (!doc.exists) {
    await docRef.set({ name: name, elo: 1000 });
    return { name, elo: 1000 };
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
              elo: 1000,
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

document.getElementById("matchForm").addEventListener("submit", async (e) => {

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
    timestamp: Date.now(),
  });

  alert("Match submitted!");

  // Refresh player dropdowns and leaderboard
  document.getElementById("matchForm").reset(); // Reset form fields
  showLeaderboard();
});

async function showLeaderboard() {
  const list = document.getElementById("leaderboard");
  list.innerHTML = "";
  const snapshot = await db.collection("players").orderBy("elo", "desc").get();
  snapshot.forEach(doc => {
    const { name, elo } = doc.data();
    const li = document.createElement("li");
    li.textContent = `${name}: ${elo}`;
    list.appendChild(li);
  });
}

async function showRecentMatches() {
  const list = document.getElementById("recentMatches");
  list.innerHTML = ""; // Clear the list

  try {
    const snapshot = await db.collection("matches")
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    snapshot.forEach(doc => {
      const match = doc.data();
      const li = document.createElement("li");

      // Create colored spans for players
      const teamAPlayers = match.teamA.map(player => `<span style="color: #d20000;">${player}</span>`).join(" & ");
      const teamBPlayers = match.teamB.map(player => `<span style="color: #0b0bd2;">${player}</span>`).join(" & ");

      // Determine winner and loser
      const winner = match.winner === "A" ? teamAPlayers : teamBPlayers;
      const loser = match.winner === "A" ? teamBPlayers : teamAPlayers;

      // Set the list item content
      li.innerHTML = `${winner} won against ${loser}`;
      list.appendChild(li);
    });
  } catch (error) {
    console.error("Error fetching recent matches:", error);
  }
}

// show leader board and load player dropdowns on page load
window.onload = async () => {
  await loadPlayerDropdowns();
  await showLeaderboard();
  await showRecentMatches();
  console.log("Page loaded and initialized.");
};