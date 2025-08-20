import { initializeApp } from 'firebase/app';
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    getFirestore,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    connectFirestoreEmulator,
    onSnapshot,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';


const firebaseConfig = {
  apiKey: "AIzaSyBHGbErkiS33J_h5Xoanzhl6rC7yWo1R08",
  authDomain: "kickelo.firebaseapp.com",
  projectId: "kickelo",
  storageBucket: "kickelo.firebasestorage.app",
  messagingSenderId: "1075750769009",
  appId: "1:1075750769009:web:8a8b02540be5c9522be6d0"
};

const app = initializeApp(firebaseConfig);
// Use multi-tab IndexedDb persistence.
initializeFirestore(app,
  {localCache:
    persistentLocalCache(/*settings*/{tabManager: persistentMultipleTabManager()})
  }
);

const db = getFirestore(app);

export const auth = getAuth(app);

if (import.meta.env.DEV) {
  // Firestore emulator
  connectFirestoreEmulator(db, '127.0.0.1', 7070);
  // Auth emulator (currently not used)
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
}

// Sign the user in anonymously when the app loads
signInAnonymously(auth)
  .then(() => {
    console.log("User signed in anonymously.");
    // You can use onAuthStateChanged to see user details if needed
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, see docs for a list of available properties
        // https://firebase.google.com/docs/reference/js/firebase.User
        const uid = user.uid;
        console.log("Anonymous User ID:", uid);
      } else {
        // User is signed out
        console.log("User is signed out.");
      }
    });
  })
  .catch((error) => {
    console.error("Anonymous sign-in failed:", error);
  });

// Export db and all necessary Firestore functions
export {
    db,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
};