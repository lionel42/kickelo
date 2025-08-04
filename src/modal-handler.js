import { db, collection, doc, getDoc, setDoc, query, orderBy, getDocs } from './firebase-service.js';
import { backdrop, modal, modalBody, btnSave, btnCancel } from './dom-elements.js';

const sessionDocRef = doc(db, 'meta', 'session'); // This ref should probably be here

// Function to open modal and load checkboxes
export async function showPlayerModal(triggerPairingCallback = null) {
    backdrop.style.display = 'flex';
    modal.style.display = 'none'; // Hide modal body for now to prevent flickering
    modalBody.innerHTML = ''; // Clear previous content

    // Load all players
    const playersColRef = collection(db, 'players');
    const snapshot = await getDocs(query(playersColRef, orderBy('name')));
    const players = snapshot.docs.map(d => d.data().name);

    // Load saved active list
    const docSnap = await getDoc(sessionDocRef);
    const active = docSnap.exists() && docSnap.data().activePlayers || [];

    // Build checkboxes
    players.forEach(name => {
        const lbl = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = name;
        if (active.includes(name)) cb.checked = true;
        lbl.appendChild(cb);
        lbl.appendChild(document.createTextNode(name));
        modalBody.appendChild(lbl);
    });

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