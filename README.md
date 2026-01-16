# Kickelo

Kickelo is a web app for tracking foosball matches with Elo (overall + role‑based offense/defense) and OpenSkill ratings. It supports live and manual match entry, 1v1 and 2v2 play, rich stats, and real‑time updates via Firestore.

## Features

- Live match mode with goal timeline and match duration
- 1v1 and 2v2 matches across all stats and history views
- Role‑based Elo (offense/defense) when positions are confirmed
- Leaderboards, streaks, badges, and player stats charts
- 2v2 pairing suggestions with waiting‑karma logic
- Season selection with optional K‑factor overrides
- Optional vibration log uploads to Firebase Storage

## Tech Stack

- **Frontend:** Vanilla JS (ES modules) + Vite
- **Charts:** Chart.js
- **Ratings:** Elo + OpenSkill
- **Backend:** Firebase Firestore/Auth/Storage
- **Hosting:** Firebase Hosting (`dist` output)

## Getting Started

### Prerequisites

- Node.js (project uses Vite; Firebase Functions package targets Node 22)
- Firebase project access if you plan to run against production data

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Build & preview

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test
```

Or run individual suites:

```bash
npm run test:stats
npm run test:cache
```

## Firebase Emulators

`firebase.json` defines emulator ports for Firestore/Auth/Storage/Hosting. The emulator connection code is present but commented out in `src/firebase-service.js`. To use the emulators:

1. Uncomment the `connectFirestoreEmulator`, `connectAuthEmulator`, and `connectStorageEmulator` block in `src/firebase-service.js`.
2. Start the emulators:

```bash
firebase emulators:start
```

## Admin Scripts

One‑off admin scripts live in `admin/` and use `firebase-admin`. They require service account credentials provided via environment (for example, `GOOGLE_APPLICATION_CREDENTIALS`). Do not commit keys or backups to the repository. Run these scripts carefully against the correct project.

## Public Release Checklist

- Remove any service account keys and local Firestore backups before publishing.
- Ensure `firestore.rules` and `storage.rules` prevent public read/write.
- Rotate any credentials that were ever committed.
- Keep admin scripts credential‑free (use environment variables).
- Review logs/backups for sensitive data before sharing.

## Project Docs

- `overview.md`: Current architecture and feature overview
- `BATCH_STATS.md`: Batch stats computation details
- `PAUSE_FEATURE.md`, `vibration_tracking.md`, `waiting_karma.md`: Feature docs

## License

Private project (no license specified).
