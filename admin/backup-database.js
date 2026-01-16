const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function backupCollection(collectionRef) {
  const data = {};
  const snapshot = await collectionRef.get();

  for (const doc of snapshot.docs) {
    const subcollections = await doc.ref.listCollections();
    const subData = {};

    for (const subcollection of subcollections) {
      subData[subcollection.id] = await backupCollection(subcollection);
    }

    data[doc.id] = { ...doc.data(), subcollections: subData };
  }

  return data;
}

async function backupDatabase() {
  const collections = await db.listCollections();
  const backup = {};

  for (const collection of collections) {
    backup[collection.id] = await backupCollection(collection);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(__dirname, `backups/firestore-backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup completed! File saved to ${backupPath}`);
}

backupDatabase().catch((err) => {
  console.error("Error backing up database:", err);
});