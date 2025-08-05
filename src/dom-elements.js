const backdrop = document.getElementById('modalBackdrop');
const modal = document.getElementById('activeModal');
const modalBody = document.getElementById('modalBody');
const btnSave = document.getElementById('saveActive');
const btnCancel = document.getElementById('cancelActive');

const leaderboardList = document.getElementById("leaderboard");
const recentMatchesList = document.getElementById("recentMatches");
const recentMatchesHeading = document.getElementById("recentMatchesHeading");

const teamA1Select = document.getElementById("teamA1");
const teamA2Select = document.getElementById("teamA2");
const teamB1Select = document.getElementById("teamB1");
const teamB2Select = document.getElementById("teamB2");

const teamAgoalsInput = document.getElementById("teamAgoals");
const teamBgoalsInput = document.getElementById("teamBgoals");
const submitMatchBtn = document.getElementById("submitMatchBtn");
const matchForm = document.getElementById("matchForm");


export {
    backdrop,
    modal,
    modalBody,
    btnSave,
    btnCancel,
    leaderboardList,
    recentMatchesList,
    recentMatchesHeading,
    teamA1Select,
    teamA2Select,
    teamB1Select,
    teamB2Select,
    teamAgoalsInput,
    teamBgoalsInput,
    submitMatchBtn,
    matchForm
};

// export const playerStatsBackdrop = document.getElementById('playerStatsBackdrop');
// export const playerStatsModal = document.getElementById('playerStatsModal');
// export const playerStatsName = document.getElementById('playerStatsName');
// export const playerStatsCloseBtn = document.getElementById('playerStatsCloseBtn');
// export const eloChartCanvas = document.getElementById('eloChart');
// export const winLossTableBody = document.querySelector('#winLossTable tbody'); // Select the tbody specifically
