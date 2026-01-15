import { db, collection, doc, getDoc, setDoc, query, orderBy, getDocs } from './firebase-service.js';
import { backdrop, modal, modalBody, activeTitle, showInactiveToggleModal, btnSave, btnCancel } from './dom-elements.js';
import { getAllCachedStats } from './stats-cache-service.js';

const sessionDocRef = doc(db, 'meta', 'session'); // This ref should probably be here
let showInactivePlayersInModal = false;

function updateInactiveToggleAppearance() {
    if (!showInactiveToggleModal) return;
    if (showInactivePlayersInModal) {
        showInactiveToggleModal.textContent = 'Hide inactive';
        showInactiveToggleModal.style.backgroundColor = 'var(--hover-color)';
        showInactiveToggleModal.style.color = 'var(--text-color-primary)';
        showInactiveToggleModal.style.borderColor = 'var(--gray-light)';
    } else {
        showInactiveToggleModal.textContent = 'Show inactive';
        showInactiveToggleModal.style.backgroundColor = 'var(--card-background-color)';
        showInactiveToggleModal.style.color = 'var(--text-color-secondary)';
        showInactiveToggleModal.style.borderColor = 'var(--border-color)';
    }
}

function renderPlayerCheckboxes(players, selectedPlayers, allStats) {
    modalBody.innerHTML = '';

    const visiblePlayers = showInactivePlayersInModal
        ? players
        : players.filter((name) => {
            const stats = allStats[name];
            return !stats || stats.isActive;
        });

    if (visiblePlayers.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.textContent = showInactivePlayersInModal
            ? 'No players found.'
            : 'No active players found.';
        emptyState.style.color = 'var(--text-color-secondary)';
        modalBody.appendChild(emptyState);
        return;
    }

    visiblePlayers.forEach(name => {
        const lbl = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = name;
        if (selectedPlayers.includes(name)) cb.checked = true;
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(name));
        modalBody.appendChild(lbl);
    });
}

// Function to open modal and load checkboxes
export async function showPlayerModal(triggerPairingCallback = null) {
    backdrop.style.display = 'flex';
    modal.style.display = 'none'; // Hide modal body for now to prevent flickering
    modalBody.innerHTML = ''; // Clear previous content

    const updateActiveCount = () => {
        if (!activeTitle) return;
        const selectedCount = modalBody.querySelectorAll('input[type=checkbox]:checked').length;
        activeTitle.textContent = `Select Players (${selectedCount})`;
    };

    const getSelectedPlayers = () => {
        return [...modalBody.querySelectorAll('input[type=checkbox]:checked')]
            .map(cb => cb.value);
    };

    // Load all players
    const playersColRef = collection(db, 'players');
    const snapshot = await getDocs(query(playersColRef, orderBy('name')));
    const players = snapshot.docs.map(d => d.data().name);

    // Load saved active list
    const docSnap = await getDoc(sessionDocRef);
    const active = docSnap.exists() && docSnap.data().activePlayers || [];
    const allStats = getAllCachedStats();

    const renderWithSelection = (selectedPlayers) => {
        renderPlayerCheckboxes(players, selectedPlayers, allStats);
        updateActiveCount();
    };

    renderWithSelection(active);

    if (showInactiveToggleModal) {
        updateInactiveToggleAppearance();
        showInactiveToggleModal.onclick = () => {
            const selectedPlayers = getSelectedPlayers();
            showInactivePlayersInModal = !showInactivePlayersInModal;
            updateInactiveToggleAppearance();
            renderWithSelection(selectedPlayers);
        };
    }

    modalBody.onchange = updateActiveCount;

    // Attach handler
    btnSave.onclick = async () => {
        const checked = [...modalBody.querySelectorAll('input[type=checkbox]:checked')]
            .map(cb => cb.value);
        await setDoc(sessionDocRef, { activePlayers: checked });
        backdrop.style.display = 'none';
        if (triggerPairingCallback) {
            await triggerPairingCallback(); // Call the callback after saving
        }
    };

    btnCancel.addEventListener('click', () => {
        backdrop.style.display = 'none';
    });

    // Show modal body after content is loaded
    modal.style.display = '';
}