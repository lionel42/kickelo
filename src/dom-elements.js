const backdrop = document.getElementById('modalBackdrop');
const modal = document.getElementById('activeModal');
const modalBody = document.getElementById('modalBody');
const activeCount = document.getElementById('activeCount');
const showInactiveToggleModal = document.getElementById('showInactiveToggleModal');
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

const toggleLiveMode = document.getElementById("toggleLiveMode");
const liveMatchPanel = document.getElementById("liveMatchPanel");
const btnBlueScored = document.getElementById("btnBlueScored");
const btnRedScored = document.getElementById("btnRedScored");
const goalTimeline = document.getElementById("goalTimeline");
const liveModeStatus = document.getElementById("liveModeStatus");
const vibrationSeismograph = document.getElementById('vibrationSeismograph');
const uploadIndicator = document.getElementById('uploadIndicator');
const positionConfirmationContainer = document.getElementById('positionConfirmationContainer');
const positionsConfirmedCheckbox = document.getElementById('positionsConfirmedCheckbox');


export {
    backdrop,
    modal,
    modalBody,
    activeCount,
    showInactiveToggleModal,
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
    matchForm,
    toggleLiveMode,
    liveMatchPanel,
    btnBlueScored,
    btnRedScored,
    goalTimeline,
    liveModeStatus,
    vibrationSeismograph,
    uploadIndicator,
    positionConfirmationContainer,
    positionsConfirmedCheckbox
};

// export const playerStatsBackdrop = document.getElementById('playerStatsBackdrop');
// export const playerStatsModal = document.getElementById('playerStatsModal');
// export const playerStatsName = document.getElementById('playerStatsName');
// export const playerStatsCloseBtn = document.getElementById('playerStatsCloseBtn');
// export const eloChartCanvas = document.getElementById('eloChart');
// export const winLossTableBody = document.querySelector('#winLossTable tbody'); // Select the tbody specifically
