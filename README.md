# Rasengan Lite — Lightweight Webcam AR Experience

A lightweight, purely client-side augmented reality application built with plain HTML, CSS, Vanilla JavaScript, MediaPipe Hand Landmarker, and HTML5 Canvas 2D.

---

## Audio Integration: `assets/audio/rasengan.mp3`

The audio controller (`js/audio.js`) is configured to load and play your MP3 audio file:
* **Audio File Location:** `assets/audio/rasengan.mp3` (Full path: `D:\projects\mini\assets\audio\rasengan.mp3`)
* **Behavior:**
  - Sound is **OFF by default** (toggle with the **Sound: OFF / ON** button).
  - When sound is enabled and an open palm is detected, `rasengan.mp3` plays when the Rasengan activates.
  - **Frame-loop guard:** Will never restart playback on consecutive tracking frames.
  - **Overlap prevention:** Pauses and rewinds cleanly when the hand is lost or when the camera stops.
  - **Missing file handling:** If `rasengan.mp3` is not found, the app continues running smoothly with zero crashes, and displays a friendly notice in the console and telemetry bar.

---

## File Structure

```text
D:\projects\mini\
├── assets/
│   └── audio/
│       └── rasengan.mp3  # <--- Place your MP3 audio file here
├── index.html            # Main HTML layout, viewport frame, status indicators & controls
├── style.css             # Cyberpunk dark theme, glassmorphic styling & responsive controls
├── js/
│   ├── app.js            # Main application controller, camera & MediaPipe loop
│   ├── rasengan.js       # Procedural 2D Canvas Rasengan VFX engine & particle presets
│   └── audio.js          # Rasengan MP3 audio player & lifecycle controller
└── README.md             # Documentation & manual testing checklist
```

---

## Configuration

All palm anchor offsets, scaling, and presets are centralized in `js/rasengan.js`:

```javascript
export const PALM_CONFIG = {
  knuckleOffsetFactor: 0.58, // 0.0 = wrist, 1.0 = middle knuckle
  sizeMultiplier: 0.54,      // Sphere radius relative to hand span
  minRadius: 32,             // Minimum radius in canvas pixels
  maxRadius: 145,            // Maximum radius in canvas pixels
  positionSmoothing: 0.32,   // Exponential smoothing factor (position)
  radiusSmoothing: 0.22      // Exponential smoothing factor (radius)
};

export const PARTICLE_DENSITY_PRESETS = {
  low: { particleCount: 22, spiralArmCount: 5 },
  medium: { particleCount: 46, spiralArmCount: 7 },
  high: { particleCount: 80, spiralArmCount: 9 }
};
```

---

## How to Run the Project

Modern browsers require a secure HTTP origin (such as `http://127.0.0.1:5500` or `http://localhost`) rather than `file:///` to access `navigator.mediaDevices.getUserMedia()`, WebAssembly, and audio playback.

### Option A: VS Code Live Server (Recommended)
1. Open `D:\projects\mini` in VS Code.
2. Ensure the **Live Server** extension (by *Ritwick Dey*) is installed.
3. Right-click [index.html](file:///d:/projects/mini/index.html) -> **"Open with Live Server"**.
4. The application will launch at `http://127.0.0.1:5500/index.html`.

### Option B: Node.js / npx serve
```powershell
npx -y serve -l 5500 .
```
Then navigate to `http://localhost:5500`.

---

## Manual Browser Testing Checklist for MP3 Audio

1. **Place your MP3 audio file:**
   - Copy your `rasengan.mp3` file to `D:\projects\mini\assets\audio\rasengan.mp3`.
   *(If not placed yet, verify that the console logs the warning message and the app continues tracking without crashing).*

2. **Start Camera & Sound Toggle:**
   - Open `http://127.0.0.1:5500/index.html`.
   - Click **Start Camera** and grant permissions.
   - Verify initial audio state is **Sound: OFF** and status bar displays `Muted`.
   - Click **Sound: OFF** to toggle it to **Sound: ON** (cyan glow).
   - Status bar displays `Standby` (or `MP3 Missing` if the file has not yet been placed).

3. **Hand Detection & Audio Trigger:**
   - Hold your open palm facing the webcam.
   - The Rasengan forms over your palm.
   - `rasengan.mp3` begins playing.
   - Status bar displays `Playing`.
   - Keep your hand steady: verify the audio plays through smoothly and **does not restart on every frame**.

4. **Hand Exit & Audio Pause:**
   - Move your hand out of frame:
   - The Rasengan disappears, and the audio immediately pauses and resets to beginning.
   - Status bar returns to `Standby`.

5. **Overlap Prevention & Rapid Movement:**
   - Move your hand into view, out of view, and back into view rapidly:
   - Verify there is never overlapping or duplicate audio playing simultaneously.

6. **Camera Stop:**
   - Click **Stop Camera**:
   - Verify audio immediately stops, the stream stops, and status resets to `Muted`.
