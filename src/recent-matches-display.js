import { db, collection, query, where, orderBy, limit, getDocs } from './firebase-service.js';
import { recentMatchesList, recentMatchesHeading } from './dom-elements.js';

function createMatchListItem(match, highlightedPlayer = null) {
    const li = document.createElement("li");
    const winnerTeam = match.winner === "A" ? match.teamA : match.teamB;
    const loserTeam = match.winner === "A" ? match.teamB : match.teamA;
    const winnerGoals = match.winner === "A" ? match.goalsA : match.goalsB;
    const loserGoals = match.winner === "A" ? match.goalsB : match.goalsA;

    const teamAText = match.teamA.map(p => {
        if (p === highlightedPlayer) return `<strong>${p}</strong>`;
        return p;
    }).join(' & ');
    const teamBText = match.teamB.map(p => {
        if (p === highlightedPlayer) return `<strong>${p}</strong>`;
        return p;
    }).join(' & ');

    const timestamp = new Date(match.timestamp).toLocaleString();

    li.innerHTML = `
        <span class="match-score">${winnerTeam.join(' & ')} ${winnerGoals}:${loserGoals} ${loserTeam.join(' & ')}</span>
        <span class="match-date">(${timestamp})</span>
    `;
    return li;
}

async function updateRecentMatchDisplay(playerName = null) {
    // Fade out the heading and list
    recentMatchesHeading.classList.add("hidden");
    recentMatchesList.classList.add("hidden");

    // Wait for the fade-out transition to complete
    setTimeout(async () => {
        recentMatchesList.innerHTML = ""; // Clear the list

        try {
            const matchesColRef = collection(db, 'matches');
            let q;

            if (playerName) {
                recentMatchesHeading.textContent = `Recent Matches of ${playerName}`;
                const n_matches = 10; // You can make this configurable

                // Fetch matches where player is in Team A OR Team B
                const qA = query(
                    matchesColRef,
                    where("teamA", "array-contains", playerName),
                    orderBy("timestamp", "desc"),
                    limit(n_matches)
                );
                const snapshotA = await getDocs(qA);

                const qB = query(
                    matchesColRef,
                    where("teamB", "array-contains", playerName),
                    orderBy("timestamp", "desc"),
                    limit(n_matches)
                );
                const snapshotB = await getDocs(qB);

                let matches = [...snapshotA.docs, ...snapshotB.docs];
                // Sort combined results and take the top N
                matches.sort((a, b) => b.data().timestamp - a.data().timestamp);
                matches.splice(n_matches); // Keep only the top N

                matches.forEach(doc => {
                    const match = doc.data();
                    const li = createMatchListItem(match, playerName);
                    recentMatchesList.appendChild(li);
                });

            } else {
                recentMatchesHeading.textContent = "Recent Matches";
                q = query(matchesColRef, orderBy("timestamp", "desc"), limit(10));
                const snapshot = await getDocs(q);
                snapshot.forEach((doc) => {
                    const match = doc.data();
                    const li = createMatchListItem(match);
                    recentMatchesList.appendChild(li);
                });
            }
        } catch (error) {
            console.error("Error fetching recent matches:", error);
        } finally {
            // Fade in the heading and list
            recentMatchesHeading.classList.remove("hidden");
            recentMatchesList.classList.remove("hidden");
        }
    }, 150); // Match the duration of the CSS transition
}

export { updateRecentMatchDisplay };