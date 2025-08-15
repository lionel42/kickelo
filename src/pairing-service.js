// src/pairing-service.js

import { db, getDoc, doc } from './firebase-service.js'; // Only need db access for the session doc
import { allMatches } from './match-data-service.js';
import { allPlayers } from './player-data-service.js';
import { teamA1Select, teamA2Select, teamB1Select, teamB2Select } from './dom-elements.js';
import {updateTeamArrowState} from "./match-form-handler.js";

const SESSION_GAP = 30 * 60 * 1000; // 30 minutes in ms

function splitSession(matches) {
    if (!matches.length) return { session: [], historic: [] };
    const now = Date.now();
    const session = [];
    const historic = [];

    let sessionStartIdx = matches.length;
    for (let i = matches.length - 1; i >= 0; i--) {
        // Use the timestamp from the match data
        if (now - matches[i].timestamp > SESSION_GAP) {
            sessionStartIdx = i + 1;
            break;
        }
    }

    for (let i = 0; i < matches.length; i++) {
        if (i >= sessionStartIdx) {
            session.push(matches[i]);
        } else {
            historic.push(matches[i]);
        }
    }
    return { session, historic };
}

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

function buildCoAndOppCounts(matches, activePlayers) {
  const withCount = {}, againstCount = {};
  activePlayers.forEach(a => {
    withCount[a] = {};
    againstCount[a] = {};
    activePlayers.forEach(b => {
      if (a !== b) {
        withCount[a][b] = 0;
        againstCount[a][b] = 0;
      }
    });
  });

  matches.forEach(m => {
    const A = m.teamA, B = m.teamB;
    [A, B].forEach(team => {
      team.forEach(p1 => team.forEach(p2 => {
        if (p1 !== p2 && withCount[p1] && withCount[p2]) {
          withCount[p1][p2]++;
        }
      }));
    });
    A.forEach(pA => B.forEach(pB => {
      if (againstCount[pA] && againstCount[pB]) {
        againstCount[pA][pB]++;
        againstCount[pB][pA]++;
      }
    }));
  });

  return { withCount, againstCount };
}

function generatePairings(activePlayers) {
  const pairings = [];
  const n = activePlayers.length;
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        for (let d = c + 1; d < n; d++) {
          const quad = [activePlayers[a], activePlayers[b], activePlayers[c], activePlayers[d]];
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

function scorePairing(p, data) {
  const {
    playsCount,
    countsSession,
    countsHistoric,
    eloMap
  } = data;

  const w = {
    sessionPlays: 1000.0,
    sessionTeammateRepeat: 100.0,
    historicTeammateRepeat: 20.0,
    sessionOpponentRepeat: 40.0,
    historicOpponentRepeat: 8.0,
    intraTeamEloDiff: 0.1,
    interTeamEloDiff: 0.3,
  };

  const { teamA, teamB } = p;
  const playsSess = playsCount[teamA[0]] + playsCount[teamA[1]] +
                    playsCount[teamB[0]] + playsCount[teamB[1]];

  const repSess = countsSession.withCount[teamA[0]][teamA[1]] + countsSession.withCount[teamB[0]][teamB[1]];
  const repHist = countsHistoric.withCount[teamA[0]][teamA[1]] + countsHistoric.withCount[teamB[0]][teamB[1]];

  let oppRepSess = 0;
  teamA.forEach(a => teamB.forEach(b => { oppRepSess += countsSession.againstCount[a][b]; }));
  let oppRepHist = 0;
  teamA.forEach(a => teamB.forEach(b => { oppRepHist += countsHistoric.againstCount[a][b]; }));

  const eloA0 = eloMap[teamA[0]], eloA1 = eloMap[teamA[1]];
  const eloB0 = eloMap[teamB[0]], eloB1 = eloMap[teamB[1]];
  const intraDiff = Math.abs(eloA0 - eloA1) + Math.abs(eloB0 - eloB1);
  const interDiff = Math.abs((eloA0 + eloA1) / 2 - (eloB0 + eloB1) / 2);

  return -w.sessionPlays * playsSess - w.sessionTeammateRepeat * repSess - w.historicTeammateRepeat * repHist
         - w.sessionOpponentRepeat * oppRepSess - w.historicOpponentRepeat * oppRepHist
         - w.intraTeamEloDiff * intraDiff - w.interTeamEloDiff * interDiff;
}

function buildSideCounts(matches) {
    const countA = {}, countB = {};
    matches.forEach(m => {
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

function redCost(p, countA, countB) { return Math.abs(((countA[p] || 0) + 1) / ((countA[p] || 0) + (countB[p] || 0) + 1) - 0.5); }
function blueCost(p, countA, countB) { return Math.abs((countA[p] || 0) / ((countA[p] || 0) + (countB[p] || 0) + 1) - 0.5); }


// Main function to suggest and display pairing
export async function suggestPairing() {
    // Fetch active players (this remains a direct Firestore call as it's session-specific)
    const sessionDocRef = doc(db, 'meta', 'session');
    const sessDocSnap = await getDoc(sessionDocRef);
    const activePlayers = (sessDocSnap.exists() && sessDocSnap.data().activePlayers) || [];
    
    if (activePlayers.length < 4) {
        alert("Please select at least 4 active players to suggest a pairing.");
        return;
    }

    // The match data is already sorted by timestamp descending, so we reverse for chronological order.
    const chronologicalMatches = [...allMatches].reverse();
    const { session: sessionMatches, historic: historicMatches } = splitSession(chronologicalMatches);

    const playsCount = countPlaysPerPlayer(sessionMatches, activePlayers);
    const countsSession = buildCoAndOppCounts(sessionMatches, activePlayers);
    const countsHistoric = buildCoAndOppCounts(historicMatches, activePlayers);

    const eloMap = {};
    allPlayers.forEach(p => {
        if (activePlayers.includes(p.id)) {
            eloMap[p.id] = p.elo;
        }
    });

    const data = {
        playsCount,
        countsSession,
        countsHistoric,
        eloMap
    };

    const candidates = generatePairings(activePlayers);
    if (candidates.length === 0) {
        alert("Could not generate any pairings with the selected active players.");
        return;
    }

    const scored = candidates.map(p => ({
        pairing: p,
        score: scorePairing(p, data)
    }));
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0].pairing;
    const { countA, countB } = buildSideCounts(chronologicalMatches);
    const { teamA, teamB } = best;

    const cost1 = teamA.reduce((sum, p) => sum + redCost(p, countA, countB), 0) + teamB.reduce((sum, p) => sum + blueCost(p, countA, countB), 0);
    const cost2 = teamA.reduce((sum, p) => sum + blueCost(p, countA, countB), 0) + teamB.reduce((sum, p) => sum + redCost(p, countA, countB), 0);

    const [redTeam, blueTeam] = (cost1 <= cost2) ? [teamA, teamB] : [teamB, teamA];

    teamA1Select.value = redTeam[0];
    teamA2Select.value = redTeam[1];
    teamB1Select.value = blueTeam[0];
    teamB2Select.value = blueTeam[1];

    updateTeamArrowState('A');
    updateTeamArrowState('B');
}
