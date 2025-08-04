import { db, collection, query, where, orderBy, getDocs, getDoc, doc } from './firebase-service.js';
import { expectedScore } from './elo-service.js';
import { teamA1Select, teamA2Select, teamB1Select, teamB2Select } from './dom-elements.js';

const SESSION_GAP = 30 * 60 * 1000; // 30 minutes in ms

// Load the complete match history (ordered by timestamp asc)
async function loadAllMatches(timePeriod = 36 * 60 * 60 * 1000) { // Default: last 36 hours
    const cutoffTimestamp = Date.now() - timePeriod;
    const matchesColRef = collection(db, 'matches');
    const q = query(
        matchesColRef,
        where('timestamp', '>=', cutoffTimestamp),
        orderBy('timestamp', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Split into "current session" vs "historic" matches
function splitSession(matches) {
    if (!matches.length) return { session: [], historic: [] };
    const now = Date.now();
    const session = [];
    const historic = [];

    // Find the boundary for the current session
    let sessionStartIdx = matches.length;
    for (let i = matches.length - 1; i >= 0; i--) {
        if (now - matches[i].timestamp > SESSION_GAP) {
            sessionStartIdx = i + 1;
            break;
        }
    }

    // Populate session and historic arrays
    for (let i = 0; i < matches.length; i++) {
        if (i >= sessionStartIdx) {
            session.push(matches[i]);
        } else {
            historic.push(matches[i]);
        }
    }
    return { session, historic };
}


// Count plays per player in a given match set
function countPlaysPerPlayer(matches, activePlayers) {
    const plays = {};
    activePlayers.forEach(p => plays[p] = 0); // Initialize all active players to 0
    matches.forEach(m => {
        m.teamA.forEach(p => { if (p in plays) plays[p]++; });
        m.teamB.forEach(p => { if (p in plays) plays[p]++; });
    });
    return plays;
}

// Build co-play and opposition counts for a given match set
function buildCoAndOppCounts(matches, activePlayers) {
    const counts = {};
    activePlayers.forEach(p => {
        counts[p] = { with: {}, against: {} };
        activePlayers.forEach(p2 => {
            if (p !== p2) {
                counts[p].with[p2] = 0;
                counts[p].against[p2] = 0;
            }
        });
    });

    matches.forEach(m => {
        const allPlayersInMatch = [...m.teamA, ...m.teamB];

        m.teamA.forEach(pa => {
            m.teamA.forEach(pa2 => {
                if (pa !== pa2 && pa in counts && pa2 in counts[pa].with) {
                    counts[pa].with[pa2]++;
                }
            });
            m.teamB.forEach(pb => {
                if (pa in counts && pb in counts[pa].against) {
                    counts[pa].against[pb]++;
                }
            });
        });

        m.teamB.forEach(pb => {
            m.teamB.forEach(pb2 => {
                if (pb !== pb2 && pb in counts && pb2 in counts[pb].with) {
                    counts[pb].with[pb2]++;
                }
            });
            m.teamA.forEach(pa => {
                if (pb in counts && pa in counts[pb].against) {
                    counts[pb].against[pa]++;
                }
            });
        });
    });
    return counts;
}

// Generate all possible 2v2 pairings from a list of players
function generatePairings(players) {
    const pairings = [];
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            const teamA = [players[i], players[j]].sort(); // Sort for consistent order

            const remainingPlayers = players.filter(p => p !== players[i] && p !== players[j]);
            if (remainingPlayers.length >= 2) {
                for (let k = 0; k < remainingPlayers.length; k++) {
                    for (let l = k + 1; l < remainingPlayers.length; l++) {
                        const teamB = [remainingPlayers[k], remainingPlayers[l]].sort();
                        pairings.push({ teamA, teamB });
                    }
                }
            }
        }
    }
    return pairings;
}

// Score a single pairing based on various criteria
function scorePairing(pairing, data) {
    const { activePlayers, sessionMatches, historicMatches, playsCount, countsSession, countsHistoric, eloMap } = data;
    const { teamA, teamB } = pairing;
    const allPlayersInPairing = [...teamA, ...teamB];

    let score = 0;

    // 1. Avoid recently played (session)
    allPlayersInPairing.forEach(p => {
        score -= (playsCount[p] || 0) * 10; // Penalize players who played a lot recently
    });

    // 2. Avoid recent co-plays
    teamA.forEach(p => teamA.forEach(p2 => {
        if (p !== p2) score -= (countsSession[p]?.with[p2] || 0) * 50;
    }));
    teamB.forEach(p => teamB.forEach(p2 => {
        if (p !== p2) score -= (countsSession[p]?.with[p2] || 0) * 50;
    }));

    // 3. Avoid recent opposition
    teamA.forEach(p => teamB.forEach(p2 => {
        score -= (countsSession[p]?.against[p2] || 0) * 30;
    }));
    teamB.forEach(p => teamA.forEach(p2 => {
        score -= (countsSession[p]?.against[p2] || 0) * 30;
    }));

    // 4. Balance Elo ratings (teams should be evenly matched)
    const eloA = (eloMap[teamA[0]] + eloMap[teamA[1]]) / 2;
    const eloB = (eloMap[teamB[0]] + eloMap[teamB[1]]) / 2;
    score -= Math.abs(eloA - eloB) * 0.5; // Penalize large ELO differences

    // 5. Encourage playing with diverse teammates (historic)
    teamA.forEach(p => teamA.forEach(p2 => {
        if (p !== p2) score += (countsHistoric[p]?.with[p2] === 0 ? 5 : 0); // Bonus for new co-plays
    }));
    teamB.forEach(p => teamB.forEach(p2 => {
        if (p !== p2) score += (countsHistoric[p]?.with[p2] === 0 ? 5 : 0);
    }));

    // 6. Encourage playing against diverse opponents (historic)
    teamA.forEach(p => teamB.forEach(p2 => {
        score += (countsHistoric[p]?.against[p2] === 0 ? 3 : 0); // Bonus for new opposition
    }));
    teamB.forEach(p => teamA.forEach(p2 => {
        score += (countsHistoric[p]?.against[p2] === 0 ? 3 : 0);
    }));

    // 7. Balance sides (who plays offense vs defense) - (This part is currently handled outside this function)
    // You would pass side counts if you wanted to integrate this into the pairing score
    // For now, it's done after pairing selection

    return score;
}

// Build side-counts from all matches for balancing offense/defense
function buildSideCounts(allMatches) {
    const countA = {}, countB = {}; // countA = red side, countB = blue side
    allMatches.forEach(m => {
        m.teamA.forEach(p => {
            countA[p] = (countA[p] || 0) + 1;
            if (!(p in countB)) countB[p] = 0;
        });
        m.teamB.forEach(p => {
            countB[p] = (countB[p] || 0) + 1;
            if (!(p in countA)) countA[p] = 0;
        });
    });
    return { countA, countB };
}

// Cost of giving player p a red slot now:
function redCost(p, countA, countB) {
    const a = countA[p] || 0;
    const b = countB[p] || 0;
    const newPctA = (a + 1) / (a + b + 1);
    return Math.abs(newPctA - 0.5);
}

// Cost for blue slot now:
function blueCost(p, countA, countB) {
    const a = countA[p] || 0;
    const b = countB[p] || 0;
    const newPctA = a / (a + b + 1);
    return Math.abs(newPctA - 0.5);
}


// Main function to suggest and display pairing
export async function suggestPairing() {
    // fetch active players
    const sessionDocRef = doc(db, 'meta', 'session');
    const sessDocSnap = await getDoc(sessionDocRef);
    const activePlayers = (sessDocSnap.exists() && sessDocSnap.data().activePlayers) || [];
    console.log('Active players:', activePlayers);

    if (activePlayers.length < 4) {
        alert("Please select at least 4 active players to suggest a pairing.");
        return;
    }

    const allMatches = await loadAllMatches();
    console.log('Total matches:', allMatches.length);

    const { session: sessionMatches, historic: historicMatches } = splitSession(allMatches);
    console.log('Session matches:', sessionMatches.length, 'Historic:', historicMatches.length);

    const playsCount = countPlaysPerPlayer(sessionMatches, activePlayers);
    console.log('Plays/session:', playsCount);

    const countsSession = buildCoAndOppCounts(sessionMatches, activePlayers);
    const countsHistoric = buildCoAndOppCounts(historicMatches, activePlayers);
    console.log('Session with/against:', countsSession);
    console.log('Historic with/against:', countsHistoric);

    const data = {
        activePlayers,
        allMatches,
        sessionMatches,
        historicMatches,
        playsCount,
        countsSession,
        countsHistoric
    };

    // Load Elo ratings
    const eloMap = {};
    const playersColRef = collection(db, 'players');
    // For 'in' queries, max 10 values in the array. Handle larger arrays if needed.
    // For simplicity, assuming activePlayers <= 10 or using multiple queries for larger sets.
    const qElo = query(
        playersColRef,
        where('__name__', 'in', activePlayers)
    );
    const snaps = await getDocs(qElo);
    snaps.forEach(d => eloMap[d.id] = d.data().elo);
    data.eloMap = eloMap;


    const candidates = generatePairings(data.activePlayers);
    console.log(`Generated ${candidates.length} pairings`);

    if (candidates.length === 0) {
        alert("Could not generate any pairings with the selected active players. Try adding more active players.");
        return;
    }

    const scored = candidates.map(p => ({
        pairing: p,
        score: scorePairing(p, data)
    }));

    scored.sort((a, b) => b.score - a.score);

    console.log('Top 5 pairings:');
    scored.slice(0, 5).forEach((s, i) => {
        console.log(
            `#${i+1} [${s.pairing.teamA.join('&')} vs ${s.pairing.teamB.join('&')}] ` +
            `score=${s.score.toFixed(2)}`
        );
    });

    const best = scored[0].pairing;

    // Decide best assignment for red/blue based on historical side balance
    const { countA, countB } = buildSideCounts(data.allMatches);
    const { teamA, teamB } = best;

    let cost1 = 0; // Cost if teamA -> red, teamB -> blue
    teamA.forEach(p => cost1 += redCost(p, countA, countB));
    teamB.forEach(p => cost1 += blueCost(p, countA, countB));

    let cost2 = 0; // Cost if teamA -> blue, teamB -> red
    teamA.forEach(p => cost2 += blueCost(p, countA, countB));
    teamB.forEach(p => cost2 += redCost(p, countA, countB));

    let redTeam, blueTeam;
    if (cost1 <= cost2) {
        redTeam  = teamA;
        blueTeam = teamB;
    } else {
        redTeam  = teamB;
        blueTeam = teamA;
    }

    // Fill the dropdowns
    teamA1Select.value = redTeam[0];
    teamA2Select.value = redTeam[1];
    teamB1Select.value = blueTeam[0];
    teamB2Select.value = blueTeam[1];
}