# Pause Feature Documentation

## Overview
The pause feature allows you to completely disable the website on specific days, showing only a background with a custom message and image.

## How to Use

### 1. Configure Pause Dates
Edit the `PAUSE_DATES` array in `src/constants.js`:

```javascript
export const PAUSE_DATES = [
    '2025-12-25',  // Christmas Day
    '2025-12-26',  // Boxing Day
    '2025-01-01',  // New Year's Day
    // Add more dates as needed
];
```

**Date Format:** Use `YYYY-MM-DD` format (e.g., `'2025-12-25'` for December 25, 2025)

### 2. Customize the Message
Edit the `PAUSE_MESSAGE` constant in `src/constants.js`:

```javascript
export const PAUSE_MESSAGE = "The ELO system is taking a break today!";
```

### 3. Add Your Pause Image
1. Place your image file in the `public/assets/` directory
2. Update the `PAUSE_IMAGE_PATH` constant in `src/constants.js`:

```javascript
export const PAUSE_IMAGE_PATH = "assets/your-image-name.png";
```

**Supported formats:** PNG, JPG, GIF, SVG, etc.

## How It Works

When a user visits the website on a date listed in `PAUSE_DATES`:
1. The app checks the current date on page load
2. If it's a pause day, the main content is hidden
3. A full-screen overlay displays with:
   - Your custom message
   - Your custom image
4. All Firebase connections and app functionality are disabled

When it's NOT a pause day:
- The app functions normally
- The pause overlay is hidden

## Technical Details

### Files Modified
- `src/constants.js` - Configuration for pause dates, message, and image path
- `src/app.js` - Logic to check pause status and show/hide overlay
- `index.html` - Added pause overlay HTML structure
- `src/styles.css` - Styling for the pause screen

### Styling
The pause screen uses:
- Full-screen overlay (z-index: 10000)
- Gradient background (#1a1a1a to #2d2d2d)
- Centered content with responsive image sizing
- Automatic hiding of all main content when paused

You can customize the styling in `src/styles.css` under the `/* Pause Overlay */` section.

## Example Configuration

```javascript
// In src/constants.js
export const PAUSE_DATES = [
    '2025-12-24',  // Christmas Eve
    '2025-12-25',  // Christmas Day
    '2025-12-31',  // New Year's Eve
    '2026-01-01',  // New Year's Day
];

export const PAUSE_MESSAGE = "🎄 Happy Holidays! The foosball table is closed today. 🎄";
export const PAUSE_IMAGE_PATH = "assets/holiday-celebration.png";
```

## Notes

- The date check uses the user's local timezone
- Dates must be in ISO format (YYYY-MM-DD)
- The feature automatically reactivates on non-pause days
- No database changes are made during pause days
