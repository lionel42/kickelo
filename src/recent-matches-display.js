import { db, collection, query, where, orderBy, limit, onSnapshot } from './firebase-service.js';
import { recentMatchesList, recentMatchesHeading } from './dom-elements.js';


function createMatchListItem(match, highlighted_player = null) {
    const li = document.createElement("li");

    let teamAPlayers = match.teamA.map(player => `<span style="color: #ce848c;">${player}</span>`).join(` <span style="color: #ce848c;">&</span> `);
    let teamBPlayers = match.teamB.map(player => `<span style="color: #6cabc2;">${player}</span>`).join(` <span style="color: #6cabc2;">&</span> `);

    let winner = match.winner === "A" ? teamAPlayers : teamBPlayers;
    let loser = match.winner === "A" ? teamBPlayers : teamAPlayers;

    // Try to get goals, default to "-" if not available
    const goalsA = match.goalsA !== undefined ? match.goalsA : "-";
    const goalsB = match.goalsB !== undefined ? match.goalsB : "-";
    const winnerGoals = match.winner === "A" ? goalsA : goalsB;
    const loserGoals = match.winner === "A" ? goalsB : goalsA;

    if (highlighted_player) {
        const isInTeamA = match.teamA.includes(highlighted_player);
        const isInTeamB = match.teamB.includes(highlighted_player);

        if (!isInTeamA && !isInTeamB) {
            console.warn(`Player ${highlighted_player} not found in either team.`);
            console.log(`Match details:`, match);
        }
        console.log(`Highlighting player: ${highlighted_player}`);

        if (isInTeamA) {
            teamAPlayers = `<span style="color: #ce848c">${highlighted_player}</span>` +
                (match.teamA.length > 1 ? ` <span style="color: #ce848c;">&</span> ` + match.teamA.filter(p => p !== highlighted_player).map(player => `<span style="color: #ce848c;">${player}</span>`).join(` <span style="color: #ce848c;">&</span> `) : "");
        } else if (isInTeamB) {
            teamBPlayers = `<span style="color: #6cabc2">${highlighted_player}</span>` +
                (match.teamB.length > 1 ? ` <span style="color: #6cabc2;">&</span> ` + match.teamB.filter(p => p !== highlighted_player).map(player => `<span style="color: #6cabc2;">${player}</span>`).join(` <span style="color: #6cabc2;">&</span> `) : "");
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

    li.innerHTML = `${winner} ${winnerGoals}:${loserGoals} ${loser} <span style="font-size: 0.9em; color: gray;">(Elo Δ: ${match.eloDelta || 0})</span>`;
    return li;
}

// Helper to render matches to the DOM with fade effect
function renderMatchesToDom(matches, highlightedPlayer = null, headingText = "Recent Matches") {
    // Fade out the heading and list
    recentMatchesHeading.classList.add("hidden");
    recentMatchesList.classList.add("hidden");

    setTimeout(() => { // Small delay for fade-out effect
        recentMatchesHeading.textContent = headingText;
        recentMatchesList.innerHTML = ""; // Clear the list

        if (matches.length === 0) {
            recentMatchesList.innerHTML = "<li>No matches found.</li>";
        } else {
            matches.forEach(match => {
                const li = createMatchListItem(match, highlightedPlayer);
                recentMatchesList.appendChild(li);
            });
        }

        // Fade in the heading and list
        recentMatchesHeading.classList.remove("hidden");
        recentMatchesList.classList.remove("hidden");
    }, 150); // Match the duration of the CSS transition
}

let currentUnsubscribes = []; // Array to hold all active unsubscribe functions

/**
 * Starts a real-time listener for recent matches.
 * @param {string | null} playerName - If provided, shows recent matches for this player. Otherwise, shows global recent matches.
 */
export function startRecentMatchesListener(playerName = null) {
    // 1. Unsubscribe from any previously active listeners
    currentUnsubscribes.forEach(unsubscribe => unsubscribe());
    currentUnsubscribes = []; // Clear the array

    const matchesColRef = collection(db, 'matches');
    const n_matches = 10; // Number of matches to display

    if (playerName) {
        // --- Player-specific real-time updates ---
        let teamAMatches = [];
        let teamBMatches = [];

        // Callback function that merges and renders results from both listeners
        const updatePlayerMatchesDisplay = () => {
            // Combine and sort all matches for the player
            let allPlayerMatches = [...teamAMatches, ...teamBMatches];
            // Filter out duplicates if a match appears in both teamA and teamB (unlikely with strict player roles, but good for robustness)
            const uniqueMatchIds = new Set();
            allPlayerMatches = allPlayerMatches.filter(match => {
                if (uniqueMatchIds.has(match.id)) {
                    return false;
                }
                uniqueMatchIds.add(match.id);
                return true;
            });

            // Sort by timestamp (most recent first) and take the top N
            allPlayerMatches.sort((a, b) => b.timestamp - a.timestamp);
            allPlayerMatches.splice(n_matches);

            renderMatchesToDom(allPlayerMatches, playerName, `Recent Matches of ${playerName}`);
            console.log(`Player-specific matches for ${playerName} updated from Firestore snapshots.`);
        };

        // Listener for when player is in Team A
        const qA = query(
            matchesColRef,
            where("teamA", "array-contains", playerName),
            orderBy("timestamp", "desc"),
            limit(n_matches) // Limit on individual query, combined will be sorted later
        );
        const unsubscribeA = onSnapshot(qA, (snapshot) => {
            teamAMatches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            updatePlayerMatchesDisplay(); // Re-render when Team A matches update
        }, (error) => {
            console.error(`Error listening to Team A matches for ${playerName}:`, error);
        });
        currentUnsubscribes.push(unsubscribeA);
        console.log(`Listening for matches where ${playerName} is in Team A.`);

        // Listener for when player is in Team B
        const qB = query(
            matchesColRef,
            where("teamB", "array-contains", playerName),
            orderBy("timestamp", "desc"),
            limit(n_matches) // Limit on individual query, combined will be sorted later
        );
        const unsubscribeB = onSnapshot(qB, (snapshot) => {
            teamBMatches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            updatePlayerMatchesDisplay(); // Re-render when Team B matches update
        }, (error) => {
            console.error(`Error listening to Team B matches for ${playerName}:`, error);
        });
        currentUnsubscribes.push(unsubscribeB);
        console.log(`Listening for matches where ${playerName} is in Team B.`);

    } else {
        // --- Global recent matches real-time updates ---
        const q = query(matchesColRef, orderBy("timestamp", "desc"), limit(n_matches));

        console.log("Starting global recent matches listener...");
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const matches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            renderMatchesToDom(matches, null, "Recent Matches");
            console.log("Global recent matches updated from Firestore snapshot.");
        }, (error) => {
            console.error("Error listening to global recent matches changes:", error);
        });
        currentUnsubscribes.push(unsubscribe); // Store the single unsubscribe function
    }
}

// Export a function to stop all listeners explicitly (e.g., if navigating away)
export function stopRecentMatchesListeners() {
    currentUnsubscribes.forEach(unsubscribe => unsubscribe());
    currentUnsubscribes = [];
    console.log("All recent matches listeners stopped.");
}
