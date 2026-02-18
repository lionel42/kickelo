const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function buildUrl(path) {
    if (!path.startsWith('/')) {
        return `${API_BASE_URL}/${path}`;
    }
    return `${API_BASE_URL}${path}`;
}

async function request(path, options = {}) {
    const response = await fetch(buildUrl(path), {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export function fetchPlayers() {
    return request('/api/players');
}

export function ensurePlayer(name) {
    return request('/api/players/ensure', {
        method: 'POST',
        body: JSON.stringify({ name })
    });
}

export function incrementPlayerGames(names) {
    return request('/api/players/increment-games', {
        method: 'POST',
        body: JSON.stringify({ names })
    });
}

export function fetchMatches() {
    return request('/api/matches');
}

export function createMatch(matchData) {
    return request('/api/matches', {
        method: 'POST',
        body: JSON.stringify(matchData)
    });
}

export function getSessionState() {
    return request('/api/session');
}

export function updateSessionState(activePlayers) {
    return request('/api/session', {
        method: 'PUT',
        body: JSON.stringify({ activePlayers })
    });
}
