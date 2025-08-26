# Experimental Vibration Tracking Plan

## Goal
Implement experimental vibration tracking during live mode in the foosball tracker app. The phone's accelerometer data will be recorded at full frequency (no subsampling for now) and visualized live as a seismograph above the goal logging buttons. Data will be saved for later analysis.

## Steps

1. **User Consent**
   - When entering live mode, prompt the user with a modal/dialog: "Enable vibration tracking for this match? (Experimental)".
   - Only start recording if the user agrees.

2. **Data Collection**
   - Use the DeviceMotion API to record raw accelerometer data (x, y, z, timestamp) at the device's native frequency.
   - Store all samples in a buffer in memory for the duration of live mode.

3. **Live Visualization**
   - Add a canvas or SVG element above the goal logging buttons.
   - Render a scrolling seismograph-style plot of the most recent N seconds of vibration data (e.g., 10s window).
   - Show the magnitude (sqrt(x^2 + y^2 + z^2)) as the main signal.

4. **Data Storage**
   - On match end, save the vibration log as part of the match document in Firestore (if size allows) or as a file in Firebase Storage (future step).

5. **Extensibility**
   - The code should be modular to allow for future subsampling, event detection, or storage changes.

## Notes
- No subsampling for now; record all data.
- Visualization is for user feedback and debugging.
- Privacy: Only record if user consents at the start of live mode.

---

This plan will be updated as the feature evolves.

