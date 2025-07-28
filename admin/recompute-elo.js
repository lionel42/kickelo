const admin = require("firebase-admin");
const fs = require("fs");

// Load your service account
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ELO logic
const K = 40;
const DEFAULT_ELO = 1500;

function expected(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function updateRatings(team1, team2, winnerIndex, eloMap) {
  const avg1 = team1.reduce((sum, p) => sum + eloMap[p].elo, 0) / team1.length;
  const avg2 = team2.reduce((sum, p) => sum + eloMap[p].elo, 0) / team2.length;

  const scoreA = winnerIndex === "A" ? 1 : 0;

  const expectedA = expected(avg1, avg2);

  const delta = Math.round(K * (scoreA - expectedA));

  team1.forEach(p => {
    eloMap[p].elo += delta;
    eloMap[p].games += 1;
  });
  team2.forEach(p => {
    eloMap[p].elo -= delta;
    eloMap[p].games += 1;
  });

  return Math.abs(delta);
}

async function recomputeElo() {
  const elo = {}; // name -> {rating, games}
  // TODO: store a history of ratings
  // const elo_history = {}; // name -> [{rating, games}]

  const matchesSnapshot = await db.collection("matches").orderBy("timestamp").get();

  const matches = matchesSnapshot.docs.map(doc => {
    const data = doc.data();
    return { ...data, id: doc.id }; // Include the document ID
  });

  console.log(`Found ${matches.length} matches`);

  for (const match of matches) {
    // const { team1, team2, winner } = match;
    const team1 = match.teamA;
    const team2 = match.teamB;
    const winner = match.winner;
    if (!Array.isArray(team1) || !Array.isArray(team2) || (winner !== "A" && winner !== "B")) {
      console.warn("Skipping invalid match:", match);
      continue;
    }
    elo[team1[0]] = elo[team1[0]] || { elo: DEFAULT_ELO, games: 0 };
    [...team1, ...team2].forEach(player => {
      if (!elo[player]) elo[player] = { elo: DEFAULT_ELO, games: 0 };
    });
    // console.log(elo)
    const eloDelta = updateRatings(team1, team2, winner, elo);

    // Update match document with Elo delta
    const matchRef = db.collection("matches").doc(match.id);
    await matchRef.update({ eloDelta: eloDelta });
  }

  console.log("ELO recompute complete. Writing back to Firestore...");

  const batch = db.batch();
  const playersRef = db.collection("players");

  for (const [name, data] of Object.entries(elo)) {
    const docRef = playersRef.doc(name);
    batch.set(docRef, data, { merge: true });
    // only log for now
    // console.log(`Updating player ${name}:`, data);
  }
  console.log(elo)
  await batch.commit();
  console.log("All player ratings updated successfully!");
}

recomputeElo().catch(err => {
  console.error("Error running ELO recompute:", err);
});
