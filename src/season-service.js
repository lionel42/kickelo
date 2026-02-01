function toStartOfDay(date) {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    return d;
}

function toEndOfDay(date) {
    const d = new Date(date.getTime());
    d.setHours(23, 59, 59, 999);
    return d;
}

function makeLocalDate(year, month, day) {
    return new Date(year, month - 1, day);
}

export class Season {
    constructor({ id, name, start, end, kFactor }) {
        this.id = id;
        this.name = name;
        this.start = toStartOfDay(start);
        this.end = toEndOfDay(end);
        this.kFactor = kFactor;
    }

    includes(timestampMs) {
        return timestampMs >= this.start.getTime() && timestampMs <= this.end.getTime();
    }
}

const SEASONS = [
    new Season({
        id: 'season-1',
        name: 'Season 1 (June 2025 - Dec 2025)',
        start: makeLocalDate(2025, 6, 1),
        end: makeLocalDate(2025, 12, 31)
    }),
    new Season({
        id: 'extended-season-1',
        name: 'Extended season 1 (June 2025 - Jan 2026)',
        start: makeLocalDate(2025, 6, 1),
        end: makeLocalDate(2026, 1, 15)
    }),
    new Season({
        id: 'season-2',
        name: 'Season 2 (Jan 2026 - Jun 2026)',
        start: makeLocalDate(2026, 1, 16),
        end: makeLocalDate(2026, 6, 30),
        // kFactor: 100
    }),
    new Season({
        id: 'season-3',
        name: 'Season 3 (Jul 2026 - Dec 2026)',
        start: makeLocalDate(2026, 7, 1),
        end: makeLocalDate(2026, 12, 31),
        // kFactor: 100
    }),
    new Season({
        id: 'all-time',
        name: 'All time',
        start: makeLocalDate(2025, 1, 1),
        end: makeLocalDate(2100, 12, 31)
    }),
];

let selectedSeasonId = null;

export function getSeasons() {
    return [...SEASONS];
}

export function getSeasonById(id) {
    return SEASONS.find((season) => season.id === id) || null;
}

export function getDefaultSeason() {
    const now = Date.now();
    const candidates = SEASONS.filter((season) => season.includes(now));
    if (candidates.length === 0) {
        return SEASONS[SEASONS.length - 1];
    }
    return candidates.reduce((latest, season) => {
        if (!latest || season.start.getTime() > latest.start.getTime()) {
            return season;
        }
        return latest;
    }, null);
}

export function getSelectedSeason() {
    if (!selectedSeasonId) {
        const defaultSeason = getDefaultSeason();
        selectedSeasonId = defaultSeason?.id || SEASONS[0]?.id || null;
    }
    return getSeasonById(selectedSeasonId);
}

export function setSelectedSeason(seasonId) {
    if (!seasonId || seasonId === selectedSeasonId) return;
    const nextSeason = getSeasonById(seasonId);
    if (!nextSeason) return;
    selectedSeasonId = nextSeason.id;
    window.dispatchEvent(new CustomEvent('season-changed', { detail: { season: nextSeason } }));
}

export function filterMatchesBySeason(matches, season = getSelectedSeason()) {
    if (!season) return matches;
    return matches.filter((match) => {
        if (!match || typeof match.timestamp !== 'number') return false;
        return season.includes(match.timestamp);
    });
}
