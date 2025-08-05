// src/player-stats-component.js

import { getEloTrajectory, getWinLossRatios } from './player-stats-service.js';
import Chart from "chart.js/auto";

// Define the HTML template for the component using a template literal
const template = document.createElement('template');
template.innerHTML = `
    <style>
        
        /* Component-specific styles to keep things encapsulated */
        .modal-content {
            background-color: var(--background-color-dark);
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            width: 400px;
            max-width: 80%;
            height: 90vh;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            z-index: 1000;
            /*position: relative;*/
        }
        
        :host-context(#playerStatsBackdrop.visible) .modal-content {
            opacity: 1;
            transform: translateY(0);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            /*padding-bottom: 15px;*/
            /*margin-bottom: 20px;*/
            z-index: 1001;
            position: sticky;
            top: 0;
            background-color: var(--background-color-dark);
            padding-top: 0;
            margin-top: 0;
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
            padding-top: 10px;
        }

        .stats-section {
            margin-bottom: 25px;
            background-color: var(--card-background-color);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
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

        #winLossTable {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 0.95em;
        }

        #winLossTable th,
        #winLossTable td {
            border: 1px solid var(--border-color);
            padding: 10px 12px;
            text-align: left;
        }
        
        #winLossTable th {
            background-color: var(--header-background-color);
            color: var(--text-color-primary);
            font-weight: bold;
        }
        
        #winLossTable tbody tr:nth-child(odd) {
            background-color: var(--background-color-light);
        }
        
        #winLossTable tbody tr:hover {
            background-color: var(--hover-color);
        }

        th.tablesort-asc::after { content: ' ▲'; }
        th.tablesort-desc::after { content: ' ▼'; }

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
                <div id="winLossTableContainer" class="stats-section">
                    <h3>Win/Loss vs. Opponents</h3>
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

        this.chartInstance = null;

        // Event listener for close button in the shadow DOM
        const closeBtn = this.shadowRoot.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.close());

        console.log(`PlayerStatsComponent constructor called.`);
    }

    connectedCallback() {
        this.playerName = this.getAttribute('player-name');
        if (!this.playerName) {
            console.error("Player name attribute is missing!");
            return;
        }
        this.loadPlayerStats()
    }

    async loadPlayerStats() {
        if (!this.playerName) return;

        // Show loading state
        const loadingEl = this.shadowRoot.getElementById('loading');
        const statsContentEl = this.shadowRoot.getElementById('stats-content');
        loadingEl.style.display = 'block';
        statsContentEl.style.display = 'none';

        const playerNameEl = this.shadowRoot.getElementById('playerStatsName');
        playerNameEl.textContent = this.playerName;

        try {
            const [eloTrajectory, winLossRatios] = await Promise.all([
                getEloTrajectory(this.playerName),
                getWinLossRatios(this.playerName)
            ]);

            this.renderEloGraph(eloTrajectory);
            this.renderWinLossTable(winLossRatios);

            loadingEl.style.display = 'none';
            statsContentEl.style.display = 'block';

        } catch (error) {
            console.error("Error loading player stats:", error);
            playerNameEl.textContent = `${this.playerName} (Error loading stats)`;
            loadingEl.style.display = 'none';
            statsContentEl.innerHTML = `<p style="color: red; text-align: center;">Failed to load player statistics.</p>`;
        }
    }

    // Moved rendering functions into the component class
        renderEloGraph(trajectoryData) {
        const canvas = this.shadowRoot.getElementById('eloChart');
        if (!canvas) {
            console.error("ELO chart canvas not found in web component.");
            return;
        }

        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        const labels = trajectoryData.map(point => new Date(point.timestamp).toLocaleDateString());
        const data = trajectoryData.map(point => point.elo);

        const ctx = canvas.getContext('2d');
        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'ELO',
                    data: data,
                    borderColor: '#6cabc2',
                    backgroundColor: '#6cabc2',
                    borderWidth: 4,
                    tension: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(170, 170, 170, 0.2)', // Subtle light gray grid lines
                            borderColor: 'rgba(170, 170, 170, 0.5)'
                        },
                        ticks: {
                            color: '#ccc' // Light gray text for ticks
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(170, 170, 170, 0.2)', // Subtle light gray grid lines
                            borderColor: 'rgba(170, 170, 170, 0.5)'
                        },
                        ticks: {
                            color: '#ccc' // Light gray text for ticks
                        }
                    }
                },
                plugins: {
                    legend: {display: false},
                },
            }
        });
    }

    renderWinLossTable(ratios) {
        const container = this.shadowRoot.getElementById('winLossTableContainer');
        if (!container) {
            console.error("Win/Loss table container not found in web component.");
            return;
        }
        container.innerHTML = '<h3>Win/Loss vs. Opponents</h3>'; // Re-create heading

        const winLossTable = document.createElement('table');
        winLossTable.id = 'winLossTable';

        const thead = winLossTable.createTHead();
        const headerRow = thead.insertRow();
        const headers = ['Opponent', 'Wins', 'Losses', 'Ratio'];
        headers.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        const tbody = winLossTable.createTBody();
        const opponentNames = Object.keys(ratios).sort();

        if (opponentNames.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = "No matches against opponents recorded.";
            cell.style.textAlign = "center";
        } else {
            opponentNames.forEach(opponent => {
                const stats = ratios[opponent];
                const totalGames = stats.wins + stats.losses;
                const ratio = totalGames > 0 ? (stats.wins / totalGames * 100).toFixed(1) : 0;
                const row = tbody.insertRow();
                row.insertCell().textContent = opponent;
                row.insertCell().textContent = stats.wins;
                row.insertCell().textContent = stats.losses;
                row.insertCell().textContent = `${ratio}%`;
            });
        }
        winLossTable.appendChild(tbody);
        container.appendChild(winLossTable);

        if (typeof Tablesort !== 'undefined') {
            new Tablesort(winLossTable);
        } else {
            console.warn("Tablesort.js not loaded. Table will not be sortable.");
        }
    }

    close() {
        // Find the backdrop parent and remove itself
        this.parentNode.classList.remove('visible');
        this.parentNode.innerHTML = '';
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
        if (history.state?.modal === 'playerStatsModalOpen') {
            history.back();
        }
    }
}

// Define the custom element
customElements.define('player-stats-component', PlayerStatsComponent);

export function showPlayerStats(playerName) {
    const backdrop = document.getElementById('playerStatsBackdrop');
    if (!backdrop) {
        console.error("playerStatsBackdrop not found.");
        return;
    }

    const component = document.createElement('player-stats-component');
    component.setAttribute('player-name', playerName);
    backdrop.appendChild(component);
    backdrop.classList.add('visible');

    // Handle browser history as before
    if (history.state?.modal !== 'playerStatsModalOpen') {
        history.pushState({ modal: 'playerStatsModalOpen' }, '');
    }
}

window.addEventListener('popstate', (event) => {
    const backdrop = document.getElementById('playerStatsBackdrop');
    const component = backdrop?.querySelector('player-stats-component');
    if (event.state && event.state.modal === 'playerStatsModalOpen') {
        if (component) {
            // Already open and on correct state, do nothing
        } else if (!component) {
            // Modal was closed, but we navigated back to this state. Re-open it.
            // (This logic needs player name, which is hard to get from history state.
            // A better way is to simply close the modal when popstate is called)
            // Let's simplify and just ensure it's hidden.
        }
    } else {
        if (component) {
            component.close();
        }
    }
});