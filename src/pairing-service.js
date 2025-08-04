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


// 3. Count how many times each active player played in session
function countPlaysPerPlayer(sessionMatches, activePlayers) {
  const count = {};
  activePlayers.forEach(n => count[n] = 0);
  sessionMatches.forEach(m => {
    [...m.teamA, ...m.teamB]
      .filter(p => activePlayers.includes(p))
      .forEach(p => count[p]++);
  });
  return count;
}

// 4. Co‑play and opposition counts
function buildCoAndOppCounts(matches, activePlayers) {
  // init maps
  const withCount = {}, againstCount = {};
  activePlayers.forEach(a => {
    withCount[a] = {};    // withCount[a][b] = times a & b were team‑mates
    againstCount[a] = {}; // againstCount[a][b] = times a played opposite b
    activePlayers.forEach(b => {
      if (a !== b) {
        withCount[a][b] = 0;
        againstCount[a][b] = 0;
      }
    });
  });

  matches.forEach(m => {
    const A = m.teamA, B = m.teamB;
    // team‑mates
    [A, B].forEach(team => {
      team.forEach(p1 => team.forEach(p2 => {
        if (p1 !== p2 && withCount[p1] && withCount[p2]) {
          withCount[p1][p2]++;
        }
      }));
    });
    // opponents
    A.forEach(pA => B.forEach(pB => {
      if (againstCount[pA] && againstCount[pB]) {
        againstCount[pA][pB]++;
        againstCount[pB][pA]++;
      }
    }));
  });

  return { withCount, againstCount };
}

// 5. Generate all possible unique 2‑vs‑2 pairings
function generatePairings(activePlayers) {
  const pairings = [];
  const n = activePlayers.length;
  // choose 4 distinct players i<j<k<l
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        for (let d = c + 1; d < n; d++) {
          const quad = [activePlayers[a], activePlayers[b], activePlayers[c], activePlayers[d]];
          // split quad into two teams of two
          const teams = [
            [[quad[0], quad[1]], [quad[2], quad[3]]],
            [[quad[0], quad[2]], [quad[1], quad[3]]],
            [[quad[0], quad[3]], [quad[1], quad[2]]],
          ];
          teams.forEach(t => pairings.push({ teamA: t[0], teamB: t[1] }));
        }
      }
    }
  }
  return pairings;
}

// 6. Scoring function
function scorePairing(p, data) {
  const {
    playsCount,
    countsSession,
    countsHistoric,
    sessionMatches,
    historicMatches,
    eloMap // build a map of latest Elo: name->rating
  } = data;

  // weights (adjust as you like)
  const w = {
    sessionPlays: 1000.0,
    sessionTeammateRepeat: 100.0, // typical value 0-2
    historicTeammateRepeat: 20.0, // typical value 0-6
    sessionOpponentRepeat: 40.0,  // typical value 0-4
    historicOpponentRepeat: 8.0,  // typical value 0-12
    intraTeamEloDiff: 0.1, // typical value 0-300
    interTeamEloDiff: 0.3, // typical value 0-300
  };

  const { teamA, teamB } = p;
  // 3. sum of plays in this session
  const playsSess = playsCount[teamA[0]] + playsCount[teamA[1]] +
                    playsCount[teamB[0]] + playsCount[teamB[1]];

  // 4. teammate repeats
  const repSessA = countsSession.withCount[teamA[0]][teamA[1]];
  const repSessB = countsSession.withCount[teamB[0]][teamB[1]];
  const repSess = repSessA + repSessB;
  // 4a. historic teammate repeats
  const repHistA = countsHistoric.withCount[teamA[0]][teamA[1]];
  const repHistB = countsHistoric.withCount[teamB[0]][teamB[1]];
  const repHist = repHistA + repHistB;

  // 5. opponent repeats (sum over all cross‑pairs)
  let oppRepSess = 0;
  teamA.forEach(a => teamB.forEach(b => {
    oppRepSess += countsSession.againstCount[a][b];
  }));
  // 5a. historic opponent repeats, normalized by total plays
  let oppRepHist = 0;
  teamA.forEach(a => teamB.forEach(b => {
    oppRepHist += countsSession.againstCount[a][b];
  }));

  // 6. intra‑team Elo difference
  const eloA0 = eloMap[teamA[0]], eloA1 = eloMap[teamA[1]];
  const eloB0 = eloMap[teamB[0]], eloB1 = eloMap[teamB[1]];
  const diffA = Math.abs(eloA0 - eloA1);
  const diffB = Math.abs(eloB0 - eloB1);
  const intraDiff = diffA + diffB;

  // 7. inter‑team Elo difference (match balance)
  const avgA = (eloA0 + eloA1) / 2;
  const avgB = (eloB0 + eloB1) / 2;
  const interDiff = Math.abs(avgA - avgB);

  // weighted sum (we negate factors we want to minimize)
  return 0
    - w.sessionPlays           * playsSess
    - w.sessionTeammateRepeat  * repSess
    - w.historicTeammateRepeat * repHist
    - w.sessionOpponentRepeat  * oppRepSess
    - w.historicOpponentRepeat * oppRepHist
    - w.intraTeamEloDiff       * intraDiff
    - w.interTeamEloDiff       * interDiff;
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