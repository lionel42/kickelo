import { db, collection, doc, getDoc, setDoc, query, orderBy, getDocs } from './firebase-service.js';
import { backdrop, modal, modalBody, activeTitle, showInactiveToggleModal, btnSave, btnCancel } from './dom-elements.js';
import { getRecentActivePlayers } from './match-data-service.js';

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

function renderPlayerTiles(players, selectedPlayers, recentActivePlayers, onSelectionChange) {
    modalBody.innerHTML = '';

    const activeSet = new Set(recentActivePlayers);
    const visiblePlayers = showInactivePlayersInModal
        ? players
        : players.filter((name) => {
            return activeSet.has(name);
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

    const setTileSelected = (tile, isSelected) => {
        tile.classList.toggle('selected', isSelected);
        tile.setAttribute('aria-pressed', String(isSelected));
    };

    const toggleSelected = (name, tile) => {
        if (selectedPlayers.has(name)) {
            selectedPlayers.delete(name);
            setTileSelected(tile, false);
        } else {
            selectedPlayers.add(name);
            setTileSelected(tile, true);
        }
        onSelectionChange();
    };

    visiblePlayers.forEach(name => {
        const row = document.createElement('div');
        row.className = 'player-tile-row';

        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'player-tile';
        tile.textContent = name;
        tile.setAttribute('data-player', name);
        tile.classList.toggle('inactive', !activeSet.has(name));
        tile.setAttribute('role', 'button');
        tile.setAttribute('tabindex', '0');
        setTileSelected(tile, selectedPlayers.has(name));

        let startX = 0;
        let startY = 0;
        let pointerActive = false;
        let didSwipe = false;

        tile.addEventListener('pointerdown', (event) => {
            pointerActive = true;
            didSwipe = false;
            startX = event.clientX;
            startY = event.clientY;
            tile.setPointerCapture?.(event.pointerId);
        });

        tile.addEventListener('pointermove', (event) => {
            if (!pointerActive) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) {
                if (dx > 24 && !selectedPlayers.has(name)) {
                    selectedPlayers.add(name);
                    setTileSelected(tile, true);
                    onSelectionChange();
                }
                didSwipe = true;
                event.preventDefault();
            }
        });

        const endPointer = (event) => {
            if (!pointerActive) return;
            pointerActive = false;
            if (!didSwipe) {
                toggleSelected(name, tile);
            }
            try {
                tile.releasePointerCapture?.(event.pointerId);
            } catch (err) {
            }
        };

        tile.addEventListener('pointerup', endPointer);
        tile.addEventListener('pointercancel', endPointer);

        tile.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleSelected(name, tile);
            }
        });

        row.appendChild(tile);
        modalBody.appendChild(row);
    });
}

// Function to open modal and load checkboxes
export async function showPlayerModal(triggerPairingCallback = null) {
    backdrop.style.display = 'flex';
    modal.style.display = 'none'; // Hide modal body for now to prevent flickering
    modalBody.innerHTML = ''; // Clear previous content

    const updateActiveCount = () => {
        if (!activeTitle) return;
        activeTitle.textContent = `Select Players (${selectedPlayers.size})`;
    };

    const getSelectedPlayers = () => {
        return Array.from(selectedPlayers);
    };

    // Load all players
    const playersColRef = collection(db, 'players');
    const snapshot = await getDocs(query(playersColRef, orderBy('name')));
    const players = snapshot.docs.map(d => d.data().name);

    // Load saved active list
    const docSnap = await getDoc(sessionDocRef);
    const active = docSnap.exists() && docSnap.data().activePlayers || [];
    const selectedPlayers = new Set(active);
    const recentActivePlayers = getRecentActivePlayers();

    const renderWithSelection = () => {
        renderPlayerTiles(players, selectedPlayers, recentActivePlayers, updateActiveCount);
        updateActiveCount();
    };

    renderWithSelection();

    if (showInactiveToggleModal) {
        updateInactiveToggleAppearance();
        showInactiveToggleModal.onclick = () => {
            showInactivePlayersInModal = !showInactivePlayersInModal;
            updateInactiveToggleAppearance();
            renderWithSelection();
        };
    }

    // Attach handler
    btnSave.onclick = async () => {
        const checked = getSelectedPlayers();
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