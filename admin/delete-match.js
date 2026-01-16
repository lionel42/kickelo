const admin = require("firebase-admin");
const inquirer = require("inquirer");
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

function getArgNumRecent() {
  const arg = process.argv[2];
  const n = parseInt(arg, 10);
  return isNaN(n) ? 10 : n;
}

async function fetchRecentMatches(n) {
  const matchesSnap = await db.collection("matches")
    .orderBy("timestamp", "desc")
    .limit(n)
    .get();
  return matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function fetchPlayerNames(playerIds) {
  const names = {};
  const uniqueIds = [...new Set(playerIds)];
  if (uniqueIds.length === 0) return names;
  const playersSnap = await db.collection("players").where(admin.firestore.FieldPath.documentId(), "in", uniqueIds).get();
  playersSnap.forEach(doc => {
    names[doc.id] = doc.data().name || doc.id;
  });
  return names;
}

function formatMatch(match, playerNames) {
  const teamA = (match.teamA || []).map(id => playerNames[id] || id).join(", ");
  const teamB = (match.teamB || []).map(id => playerNames[id] || id).join(", ");
  const score = `${match.goalsA ?? "?"} : ${match.goalsB ?? "?"}`;
  const date = match.timestamp && match.timestamp.toDate ? match.timestamp.toDate() : (match.timestamp? new Date(match.timestamp) : "?");
  const dateStr = date instanceof Date && !isNaN(date) ? date.toLocaleString() : "?";
  return `${dateStr} | ${teamA} vs ${teamB} | Score: ${score}`;
}

async function main() {
  const numRecent = getArgNumRecent();
  const matches = await fetchRecentMatches(numRecent);
  if (matches.length === 0) {
    console.log("No matches found.");
    return;
  }
  // Collect all player IDs
  const playerIds = matches.flatMap(m => [...(m.teamA || []), ...(m.teamB || [])]);
  const playerNames = await fetchPlayerNames(playerIds);
  const choices = matches.map((m, i) => ({
    name: formatMatch(m, playerNames),
    value: i
  }));
  const { matchIdx } = await inquirer.prompt([
    {
      type: "list",
      name: "matchIdx",
      message: `Select a match to delete (showing ${matches.length} most recent):`,
      choices
    }
  ]);
  const match = matches[matchIdx];
  console.log("\nSelected match:");
  console.log(formatMatch(match, playerNames));
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Are you sure you want to delete this match? This cannot be undone.",
      default: false
    }
  ]);
  if (!confirm) {
    console.log("Aborted. No match deleted.");
    return;
  }
  await db.collection("matches").doc(match.id).delete();
  console.log(`Match ${match.id} deleted.`);
}

main().catch(err => {
  console.error("Error:", err);
});

