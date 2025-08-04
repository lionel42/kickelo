import { initializeApp } from 'firebase/app';
import {
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
    connectFirestoreEmulator
} from 'firebase/firestore';
// import { getAuth, connectAuthEmulator } from 'firebase/auth';


const firebaseConfig = {
  apiKey: "AIzaSyBHGbErkiS33J_h5Xoanzhl6rC7yWo1R08",
  authDomain: "kickelo.firebaseapp.com",
  projectId: "kickelo",
  storageBucket: "kickelo.firebasestorage.app",
  messagingSenderId: "1075750769009",
  appId: "1:1075750769009:web:8a8b02540be5c9522be6d0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

if (import.meta.env.DEV) {
  // Firestore emulator
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  // Auth emulator (currently not used)
  // const auth = getAuth(app);
  // connectAuthEmulator(auth, 'http://127.0.0.1:9099');
}

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
};