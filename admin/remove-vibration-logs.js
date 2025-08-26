const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function removeVibrationLogs() {
  const matchesRef = db.collection("matches");
  const snapshot = await matchesRef.get();
  let updatedCount = 0;
  let checkedCount = 0;

  for (const doc of snapshot.docs) {
    checkedCount++;
    const data = doc.data();
    if (data.hasOwnProperty("vibrationLog")) {
      await doc.ref.update({ vibrationLog: FieldValue.delete() });
      console.log(`Removed vibrationLog from match: ${doc.id}`);
      updatedCount++;
    }
  }

  console.log(`\nChecked ${checkedCount} matches. Removed vibrationLog from ${updatedCount} matches.`);
}

removeVibrationLogs().catch((err) => {
  console.error("Error removing vibration logs:", err);
});

