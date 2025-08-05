// src/player-stats-component.js

import {
    getEloTrajectory,
    getWinLossRatios,
    getWinLossRatiosWithTeammates,
    getEloGainsAndLosses,
    getLongestStreaks
} from './player-stats-service.js';
import Chart from "chart.js/auto";

// Define the HTML template for the component using a template literal
const template = document.createElement('template');
template.innerHTML = `
    <style>
        
        /* Component-specific styles to keep things encapsulated */
        .modal-content {
            background-color: var(--background-color-dark);
            padding: 0px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            width: 800px;
            max-width: 90%;
            height: 90vh;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            z-index: 1000;
        }
        
        :host-context(#playerStatsBackdrop.visible) .modal-content {
            opacity: 1;
            transform: translateY(0);
        }

        .modal-header {
            border-top-left-radius: 10px;
            border-top-right-radius: 10px;
            padding: 25px;
            padding-top: 10px;
            padding-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            z-index: 1001;
            position: sticky;
            top: 0;
            background-color: var(--background-color);
        }

        .modal-header h2 {
            margin: 0;
            font-size: 1.8em;
            color: var(--text-color-primary);
        }

        .close-btn {
            background: none;
            border: none;
            font-size: 2.5em;
            cursor: pointer;
            color: var(--text-color-secondary);
            line-height: 1;
            padding: 0 5px;
            transition: color 0.2s ease;
        }

        .close-btn:hover {
            color: var(--accent-color);
        }

        .modal-body-scrollable {
            flex-grow: 1;
            overflow-y: auto;
            padding: 10px;
        }

        .stats-section {
            margin-bottom: 25px;
            background-color: var(--card-background-color);
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .stats-section h3 {
            color: var(--text-color-primary);
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 1.4em;
            border-bottom: 1px dashed var(--border-color);
            padding-bottom: 10px;
        }

        .chart-container {
            position: relative;
            height: 300px;
            width: 100%;
            background-color: var(--background-color-primary);
            border-radius: 5px;
            padding: 10px;
            box-sizing: border-box;
        }

        .pie-charts-container {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            justify-content: center;
        }

        .pie-chart-wrapper {
            flex: 1 1 250px; /* Allow charts to grow, shrink, and wrap */
            max-width: 400px; /* Prevent a single chart from becoming too large */
            margin: 0 auto;
        }

        .pie-chart-wrapper h4 {
            text-align: center;
            margin-bottom: 10px;
            color: var(--text-color-secondary);
        }

        .streaks-container {
            display: flex;
            justify-content: space-around;
            text-align: center;
        }

        .streak-item h4 {
            font-size: 2.5em;
            margin: 0;
            color: var(--text-color-primary);
        }

        .streak-item p {
            margin: 0;
            font-size: 0.9em;
            color: var(--text-color-secondary);
        }

        /* Generic table style */
        .stats-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 0.95em;
        }

        .stats-table th,
        .stats-table td {
            border: 1px solid var(--border-color);
            padding: 4px 6px;
            text-align: left;
        }
        
        .stats-table th {
            background-color: var(--background-color-dark);
            color: var(--text-color-primary);
            font-weight: bold;cursor: pointer;
            position: relative;
        }

        .stats-table th.sort-asc::after,
        .stats-table th.sort-desc::after {
            content: '';
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            border: 4px solid transparent;
        }

        .stats-table th.sort-asc::after {
            border-bottom-color: var(--text-color-primary);
        }
        
        .stats-table th.sort-desc::after {
            border-top-color: var(--text-color-primary);
        }
        
        .stats-table tbody tr:nth-child(even) {
            background-color: var(--background-color-primary);
        }
        
        .stats-table tbody tr:hover {
            background-color: var(--hover-color);
        }

    </style>
    <div class="modal-content">
        <div class="modal-header">
            <h2 id="playerStatsName"></h2>
            <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body-scrollable">
            <div id="loading" style="text-align: center; padding: 20px;">
                <p>Loading player statistics...</p>
            </div>
            <div id="stats-content" style="display: none;">
                <div class="stats-section">
                    <h3>ELO Trajectory</h3>
                    <div class="chart-container">
                        <canvas id="eloChart"></canvas>
                    </div>
                </div>
                
                <!-- Streaks Section -->
                <div class="stats-section">
                    <h3>Longest Streaks</h3>
                    <div id="streaksContainer" class="streaks-container">
                        <!-- Content will be rendered here -->
                    </div>
                </div>

                <!-- ELO Flow Section -->
                <div class="stats-section">
                    <h3>ELO Flow</h3>
                    <div id="eloFlowContainer" class="pie-charts-container">
                        <!-- Pie charts will be rendered here -->
                    </div>
                </div>

                <!-- Opponent Stats Table Section -->
                <div id="winLossTableContainer" class="stats-section">
                    <h3>Win/Loss vs. Opponents</h3>
                </div>

                <!-- Teammate Stats Table Section -->
                <div id="teammateWinLossTableContainer" class="stats-section">
                    <h3>Win/Loss with Teammates</h3>
                </div>
            </div>
        </div>
    </div>
`;


class PlayerStatsComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.chartInstances = [];

        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.close());
    }

    connectedCallback() {
        this.playerName = this.getAttribute('player-name');
        if (!this.playerName) {
            console.error("Player name attribute is missing!");
            return;
        }
        this.loadPlayerStats();
    }

    async loadPlayerStats() {
        if (!this.playerName) return;

        const loadingEl = this.shadowRoot.getElementById('loading');
        const statsContentEl = this.shadowRoot.getElementById('stats-content');
        loadingEl.style.display = 'block';
        statsContentEl.style.display = 'none';

        this.shadowRoot.getElementById('playerStatsName').textContent = this.playerName;

        try {
            const [
                eloTrajectory,
                winLossRatios,
                teammateRatios,
                eloGainsLosses,
                longestStreaks
            ] = await Promise.all([
                getEloTrajectory(this.playerName),
                getWinLossRatios(this.playerName),
                getWinLossRatiosWithTeammates(this.playerName),
                getEloGainsAndLosses(this.playerName),
                getLongestStreaks(this.playerName)
            ]);

            this.renderEloGraph(eloTrajectory);
            this.renderWinLossTable(winLossRatios);
            this.renderTeammateWinLossTable(teammateRatios);
            this.renderEloFlowCharts(eloGainsLosses);
            this.renderStreaks(longestStreaks);

            loadingEl.style.display = 'none';
            statsContentEl.style.display = 'block';

        } catch (error) {
            console.error("Error loading player stats:", error);
            this.shadowRoot.getElementById('playerStatsName').textContent = `${this.playerName} (Error loading stats)`;
            loadingEl.style.display = 'none';
            statsContentEl.innerHTML = `<p style="color: red; text-align: center;">Failed to load player statistics.</p>`;
        }
    }

    renderEloGraph(trajectoryData) {
        const canvas = this.shadowRoot.getElementById('eloChart');
        if (!canvas) return;

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: trajectoryData.map(p => new Date(p.timestamp).toLocaleDateString()),
                datasets: [{
                    label: 'ELO',
                    data: trajectoryData.map(p => p.elo),
                    borderColor: '#6cabc2',
                    backgroundColor: '#6cabc2',
                    pointRadius: 0,
                    borderWidth: 3,
                    tension: 0,
                    pointHitRadius: 20,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { color: '#ccc' }, grid: { color: 'rgba(170, 170, 170, 0.2)' } },
                    x: { ticks: { color: '#ccc' }, grid: { color: 'rgba(170, 170, 170, 0.2)' } }
                },
                plugins: { legend: { display: false } },
            }
        });
        this.chartInstances.push(chart);
    }

    renderWinLossTable(ratios) {
        const container = this.shadowRoot.getElementById('winLossTableContainer');
        if (!container) return;
        container.innerHTML = '<h3>Win/Loss vs. Opponents</h3>';
        const table = this.createRatioTable(ratios, 'Opponent');
        container.appendChild(table);
        this.makeTableSortable(table);
    }

    renderTeammateWinLossTable(ratios) {
        const container = this.shadowRoot.getElementById('teammateWinLossTableContainer');
        if (!container) return;
        container.innerHTML = '<h3>Win/Loss with Teammates</h3>';
        const table = this.createRatioTable(ratios, 'Teammate');
        container.appendChild(table);
        this.makeTableSortable(table);
    }

    createRatioTable(ratios, entityHeader) {
        const table = document.createElement('table');
        table.className = 'stats-table';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        // Add data-sort-type to headers for our custom sorter
        const headers = [
            { text: '#', type: 'string' },
            { text: 'W', type: 'number' },
            { text: 'L', type: 'number' },
            { text: 'Ratio', type: 'number' }
        ];

        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header.text === '#' ? entityHeader : header.text;
            th.dataset.sortType = header.type;
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();
        const names = Object.keys(ratios).sort();

        if (names.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = `No matches with ${entityHeader.toLowerCase()}s recorded.`;
            cell.style.textAlign = "center";
        } else {
            names.forEach(name => {
                const stats = ratios[name];
                const totalGames = stats.wins + stats.losses;
                const ratio = totalGames > 0 ? (stats.wins / totalGames * 100).toFixed(1) : 0;
                const row = tbody.insertRow();
                row.insertCell().textContent = name;
                row.insertCell().textContent = stats.wins;
                row.insertCell().textContent = stats.losses;
                row.insertCell().textContent = `${ratio}%`;
            });
        }
        return table;
    }

    makeTableSortable(table) {
        const headers = table.querySelectorAll('th');
        headers.forEach((header, index) => {
            header.addEventListener('click', () => {
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const sortType = header.dataset.sortType;
                const isAsc = header.classList.contains('sort-asc');

                // Reset other headers
                headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));

                const direction = isAsc ? 'desc' : 'asc';
                header.classList.add(`sort-${direction}`);

                const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

                rows.sort((rowA, rowB) => {
                    const cellA = rowA.cells[index].textContent.trim();
                    const cellB = rowB.cells[index].textContent.trim();

                    let valA, valB;

                    if (sortType === 'number') {
                        valA = parseFloat(cellA.replace('%', ''));
                        valB = parseFloat(cellB.replace('%', ''));
                    } else { // string
                        valA = cellA;
                        valB = cellB;
                    }

                    const modifier = direction === 'asc' ? 1 : -1;

                    if (sortType === 'number') {
                        if (valA < valB) return -1 * modifier;
                        if (valA > valB) return 1 * modifier;
                        return 0;
                    } else {
                        return collator.compare(valA, valB) * modifier;
                    }
                });

                tbody.append(...rows);
            });
        });
    }

    renderEloFlowCharts(eloGainsLosses) {
        const container = this.shadowRoot.getElementById('eloFlowContainer');
        if (!container) return;
        container.innerHTML = '';

        const gains = Object.entries(eloGainsLosses).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        const losses = Object.entries(eloGainsLosses).filter(([_, v]) => v < 0).map(([k, v]) => [k, -v]).sort((a, b) => b[1] - a[1]);

        const chartOptions = {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#ccc' } }
            }
        };

        if (gains.length > 0) {
            const gainsWrapper = document.createElement('div');
            gainsWrapper.className = 'pie-chart-wrapper';
            gainsWrapper.innerHTML = '<h4>ELO Gained From</h4><canvas></canvas>';
            container.appendChild(gainsWrapper);
            const chart = new Chart(gainsWrapper.querySelector('canvas').getContext('2d'), {
                type: 'pie',
                data: {
                    labels: gains.map(([name, elo]) => `${name} (${Math.round(elo)})`),
                    datasets: [{ data: gains.map(([_, elo]) => elo), backgroundColor: ['#4CAF50', '#8BC34A', '#CDDC39', '#009688', '#4DB6AC'] }]
                },
                options: chartOptions
            });
            this.chartInstances.push(chart);
        }

        if (losses.length > 0) {
            const lossesWrapper = document.createElement('div');
            lossesWrapper.className = 'pie-chart-wrapper';
            lossesWrapper.innerHTML = '<h4>ELO Lost To</h4><canvas></canvas>';
            container.appendChild(lossesWrapper);
            const chart = new Chart(lossesWrapper.querySelector('canvas').getContext('2d'), {
                type: 'pie',
                data: {
                    labels: losses.map(([name, elo]) => `${name} (${Math.round(elo)})`),
                    datasets: [{ data: losses.map(([_, elo]) => elo), backgroundColor: ['#F44336', '#E91E63', '#9C27B0', '#FF5722', '#D32F2F'] }]
                },
                options: chartOptions
            });
            this.chartInstances.push(chart);
        }

        if (gains.length === 0 && losses.length === 0) {
            container.innerHTML = `<p style="text-align: center; width: 100%;">No ELO changes recorded.</p>`;
        }
    }

    renderStreaks(streaks) {
        const container = this.shadowRoot.getElementById('streaksContainer');
        if (!container) return;
        container.innerHTML = `
            <div class="streak-item">
                <h4>${streaks.longestWinStreak}</h4>
                <p>Longest Win Streak</p>
            </div>
            <div class="streak-item">
                <h4>${streaks.longestLossStreak}</h4>
                <p>Longest Loss Streak</p>
            </div>
        `;
    }

    close() {
        this.parentNode.classList.remove('visible');
        this.parentNode.innerHTML = '';
        this.chartInstances.forEach(chart => chart.destroy());
        this.chartInstances = [];
        if (history.state?.modal === 'playerStatsModalOpen') {
            history.back();
        }
    }
}

// Define the custom element
customElements.define('player-stats-component', PlayerStatsComponent);

// The export and popstate listener remain the same
export function showPlayerStats(playerName) {
    const backdrop = document.getElementById('playerStatsBackdrop');
    if (!backdrop) {
        console.error("playerStatsBackdrop not found.");
        return;
    }

    const component = document.createElement('player-stats-component');
    component.setAttribute('player-name', playerName);
    backdrop.innerHTML = ''; // Clear previous component
    backdrop.appendChild(component);
    backdrop.classList.add('visible');

    if (history.state?.modal !== 'playerStatsModalOpen') {
        history.pushState({ modal: 'playerStatsModalOpen' }, '');
    }
}

window.addEventListener('popstate', (event) => {
    const backdrop = document.getElementById('playerStatsBackdrop');
    const component = backdrop?.querySelector('player-stats-component');
    if (component && (!event.state || event.state.modal !== 'playerStatsModalOpen')) {
        component.close();
    }
});
