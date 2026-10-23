# Rasengan Lite 🌀

A lightweight, browser-based Rasengan visual effect inspired by Naruto. Rasengan Lite uses your webcam and real-time hand tracking to create a glowing, spinning energy sphere that follows your palm.

## ✨ Features

- **Real-time hand tracking** — Detects hand landmarks using MediaPipe.
- **Interactive Rasengan effect** — A glowing cyan-blue energy sphere follows your palm.
- **Canvas 2D rendering** — Creates spiral arms, energy rings, particles, trails, and a luminous core.
- **Live webcam feed** — Uses your camera to track hand movements.
- **Hand skeleton overlay** — Displays detected hand landmarks and connections when enabled.
- **Sound effects** — Supports an optional MP3 Rasengan activation sound.
- **Camera controls** — Start and stop the webcam directly from the interface.
- **Lightweight architecture** — Built with HTML, CSS, and vanilla JavaScript without a frontend framework or backend.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and interface |
| CSS3 | Styling, layout, and visual polish |
| JavaScript | Application logic and interaction |
| Canvas 2D | Real-time energy effects and particles |
| MediaPipe Hand Landmarker | Real-time hand detection and landmark tracking |
| WebRTC / `getUserMedia()` | Webcam access |
| HTML Audio API | Playback of the Rasengan MP3 sound effect |

MediaPipe and its model assets are loaded from configured external URLs. An internet connection may be required when the application first loads these resources.

## 📁 Project Structure

```text
mini/
├── index.html
├── style.css
├── README.md
├── js/
│   ├── app.js
│   └── rasengan.js
└── assets/
    └── audio/
        └── rasengan.mp3
```

The audio file should be present at `assets/audio/rasengan.mp3` for the sound feature to work. Adjust this structure to match the actual files in your project.

## 🚀 Getting Started

### Prerequisites

- A modern browser such as Google Chrome or Microsoft Edge.
- A working webcam.
- An internet connection for loading MediaPipe resources from the CDN.
- Visual Studio Code or another code editor.
- A local web server.

### Installation

1. Open the project folder in VS Code:

   ```text
   D:\projects\mini
   ```

2. Check that the project files and folders match the project structure above.

3. If you want sound effects, place your MP3 file here:

   ```text
   assets/audio/rasengan.mp3
   ```

4. Start a local development server. For example, with the VS Code Live Server extension, right-click `index.html` and select **Open with Live Server**.

5. Open the local URL provided by the server in your browser.

**Important:** Use a local server rather than opening `index.html` directly with a `file://` URL. Webcam access and external model loading work more reliably in a supported secure context such as `localhost`.

## 🎮 How to Use

1. Open Rasengan Lite in your browser.
2. Click the camera start button.
3. Allow webcam access when the browser requests permission.
4. Place one hand in front of the camera.
5. Move your palm and observe the Rasengan following your hand.
6. Enable the sound toggle to hear the activation effect, if audio is configured.
7. Use the hand skeleton option, if available, to inspect the tracked landmarks.
8. Stop the camera when you finish.

### Sound Behavior

- Sound is optional and should be disabled by default.
- When enabled, the complete Rasengan MP3 plays once when the effect transitions from inactive to active.
- The sound should not restart on every tracking frame.
- Stopping the camera should stop audio playback.
- The audio file must exist at the configured path.

Actual sound behavior depends on the implemented code and the presence of a valid audio file.

## 🧠 How It Works

1. **Camera initialization:** The browser requests webcam permission and obtains the video stream.
2. **Hand detection:** MediaPipe processes camera frames and identifies hand landmarks.
3. **Palm positioning:** The application uses detected landmarks to estimate the palm position and scale.
4. **Effect rendering:** Canvas 2D draws and animates the Rasengan around the estimated palm position.
5. **Frame updates:** The animation loop updates the effect as the hand moves.
6. **Audio activation:** The application can play the MP3 when the effect becomes active, provided sound is enabled and the file is available.

## 🔒 Privacy

- Webcam access requires your permission.
- The browser uses the camera stream for the hand-tracking experience.
- The project does not require a custom backend for its core visual effect.
- MediaPipe resources may be downloaded from an external CDN.
- Review the libraries and model-loading configuration in the source code to verify network behavior before making privacy claims about a deployed version.

## ⚠️ Troubleshooting

### Camera does not start

- Check that the browser has camera permission.
- Close other applications that may be using the webcam.
- Use `localhost` or another supported secure context.
- Check the browser console for errors.

### Hand is not detected

- Ensure your hand is clearly visible.
- Improve lighting and avoid a cluttered background.
- Move your hand into the camera's field of view.
- Check that the MediaPipe model and WASM resources load successfully.

### Rasengan does not follow the palm

- Confirm that hand detection is working.
- Check the browser console for JavaScript errors.
- Verify that the landmark coordinates are mapped correctly to the canvas.

### Sound does not play

- Verify that `assets/audio/rasengan.mp3` exists.
- Confirm that the configured audio path matches the file name.
- Check the browser tab and system volume.
- Enable sound in the application.
- Check the console for audio-loading or playback errors.


## 🔮 Future Improvements

- Adjustable particle density.
- More Rasengan animation styles.
- Customizable energy colors.
- Improved gesture-based activation.
- Additional sound effects and activation controls.
- Performance optimizations for lower-powered devices.

## 📄 License

This project is intended for learning and demonstration purposes. Add a project license before redistributing the source code.

Ensure that any third-party libraries, MediaPipe model assets, and audio files are used in accordance with their respective licenses. Naruto and Rasengan are associated with their respective copyright and trademark holders; this project is an unofficial fan-inspired experiment.

---

**Rasengan Lite — Bring the energy of the Rasengan to your browser.** 🌀
