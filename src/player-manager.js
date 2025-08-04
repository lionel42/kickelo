import { db, collection, doc, getDoc, setDoc, query, orderBy, getDocs } from './firebase-service.js';
import { teamA1Select, teamA2Select, teamB1Select, teamB2Select } from './dom-elements.js';

// Helper to get or create a player document
export async function getOrCreatePlayer(name) {
    const playerDocRef = doc(db, 'players', name);
    const docSnap = await getDoc(playerDocRef);
    if (!docSnap.exists()) {
        await setDoc(playerDocRef, { name: name, elo: 1500, games: 0 });
        return { name, elo: 1500, games: 0 };
    } else {
        return docSnap.data();
    }
}

export async function loadPlayerDropdowns() {
    const playerSelects = [teamA1Select, teamA2Select, teamB1Select, teamB2Select];
    try {
        console.log("Fetching players from Firestore...");
        const playersColRef = collection(db, 'players');
        const snapshot = await getDocs(playersColRef);
        const players = snapshot.docs.map(doc => doc.id).sort(); // Sort players alphabetically
        console.log("Fetched players:", players);

        if (players.length === 0) {
            console.warn("No players found in the database.");
        }

        for (const select of playerSelects) {
            if (!select) {
                console.error(`Dropdown element not found.`); // More generic error as we're passing elements now
                continue;
            }

            const previousValue = select.value;
            select.innerHTML = ""; // Clear old options

            const defaultOpt = document.createElement("option");
            defaultOpt.value = "";
            const color = select.id.startsWith("teamA") ? "Red" : "Blue";
            const role = select.id.endsWith("1") ? "defense" : "offense";
            defaultOpt.textContent = `${color} ${role}`;
            select.appendChild(defaultOpt);

            for (const name of players) {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                select.appendChild(opt);
            }

            const newOpt = document.createElement("option");
            newOpt.value = "__add_new__";
            newOpt.textContent = "Add new player…";
            select.appendChild(newOpt);

            if (previousValue && players.includes(previousValue)) {
                select.value = previousValue;
            }

            // Remove existing listener to prevent duplicates if called multiple times
            select.removeEventListener("change", handlePlayerDropdownChange);
            select.addEventListener("change", handlePlayerDropdownChange);
        }
    } catch (error) {
        console.error("Error loading player dropdowns:", error);
    }
}

// Handler for dropdown change, separated for reusability
async function handlePlayerDropdownChange(e) {
    if (e.target.value === "__add_new__") {
        const newName = prompt("Enter new player name:");
        if (newName) {
            const trimmedName = newName.trim();
            if (!trimmedName) {
                alert("Player name cannot be empty.");
                e.target.value = "";
                return;
            }
            const validNamePattern = /^[a-zA-Z0-9_]+$/;
            if (!validNamePattern.test(trimmedName)) {
                alert("Player name can only contain alphanumeric characters and underscores.");
                e.target.value = "";
                return;
            }

            const playerDocRef = doc(db, 'players', trimmedName);
            const existingDoc = await getDoc(playerDocRef);
            if (existingDoc.exists()) {
                alert(`Player "${trimmedName}" already exists. Please choose a different name.`);
                e.target.value = "";
                return;
            }

            console.log(`Adding new player: ${trimmedName}`);
            await setDoc(playerDocRef, {
                name: trimmedName,
                elo: 1500,
                games: 0
            });
            await loadPlayerDropdowns(); // Reload dropdowns to include the new player
            e.target.value = trimmedName; // Select the newly added player
        } else {
            console.log("Add new player canceled.");
            e.target.value = ""; // Reset dropdown to default
        }
    }
}