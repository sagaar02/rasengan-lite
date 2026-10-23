/**
 * Rasengan Lite — Stage 5 Application Controller
 * Real-time webcam streaming, MediaPipe Hand Landmarker tracking,
 * procedural 2D Canvas Rasengan VFX, Web Audio API synthesis, and user controls.
 */

// Import MediaPipe Vision Tasks from official CDN
import {
  FilesetResolver,
  HandLandmarker
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

// Import procedural Rasengan VFX engine and palm configuration
import {
  RasenganRenderer,
  PALM_CONFIG,
  PARTICLE_DENSITY_PRESETS,
  RASENGAN_MODULE_INFO
} from './rasengan.js';

// Import procedural Web Audio API chakra synthesizer
import { ChakraAudioEngine } from './audio.js';

// Official MediaPipe WASM assets and Hand Landmarker model paths
const MEDIAPIPE_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const HAND_LANDMARKER_MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Camera stream constraints (video only, 640x480 ideal, user-facing camera)
const CAMERA_CONSTRAINTS = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user'
  },
  audio: false
};

// Official MediaPipe 21-landmark hand connection topology (bones)
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index Finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle Finger
  [9, 10], [10, 11], [11, 12],
  // Ring Finger
  [13, 14], [14, 15], [15, 16],
  // Pinky Finger
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm Knuckles (MCP joints forming palm structure)
  [5, 9], [9, 13], [13, 17]
];

// Key landmark indices for visual accents (Wrist and Fingertips)
const KEY_TIPS = new Set([0, 4, 8, 12, 16, 20]);

document.addEventListener('DOMContentLoaded', () => {
  console.info(`[Rasengan Lite] Initializing Stage 5 • Polished Controls & Audio Engine`);

  // DOM Elements: Primary Actions
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  const soundToggleText = document.getElementById('sound-toggle-text');
  const btnToggleSkeleton = document.getElementById('btn-toggle-skeleton');
  const skeletonToggleText = document.getElementById('skeleton-toggle-text');

  // DOM Elements: Particle Density Chips
  const densityChips = document.querySelectorAll('.chip-btn');

  // DOM Elements: Status Telemetry
  const cameraStatusDot = document.getElementById('camera-status-dot');
  const cameraStatusText = document.getElementById('camera-status-text');

  const trackingStatusDot = document.getElementById('tracking-status-dot');
  const trackingStatusText = document.getElementById('tracking-status-text');

  const soundStatusDot = document.getElementById('sound-status-dot');
  const soundStatusText = document.getElementById('sound-status-text');

  const fpsCounter = document.getElementById('fps-counter');

  // DOM Elements: Viewport & Canvas
  const viewportWrapper = document.getElementById('viewport-wrapper');
  const webcamVideo = document.getElementById('webcam-video');
  const arCanvas = document.getElementById('ar-canvas');

  const viewportPlaceholder = document.getElementById('viewport-placeholder');
  const placeholderIconWrap = viewportPlaceholder?.querySelector('.placeholder-icon-wrap');
  const placeholderTitle = document.getElementById('placeholder-title');
  const placeholderDesc = document.getElementById('placeholder-desc');

  // Core Engines (Single Reused Instances)
  const rasenganRenderer = new RasenganRenderer(arCanvas);
  const audioEngine = new ChakraAudioEngine();

  // Application State
  let activeStream = null;
  let isStarting = false;
  let handLandmarker = null;
  let isModelInitializing = false;
  let isSoundEnabled = false;
  let showDebugSkeleton = false;
  let latestScreenPoints = null;

  // Animation Loop State
  let animationFrameId = null;
  let lastVideoTime = -1;
  let lastFpsUpdate = 0;
  let frameCount = 0;

  /**
   * Synchronize the overlay canvas dimensions with the displayed video / viewport wrapper
   */
  function syncCanvasDimensions() {
    if (!arCanvas || !viewportWrapper) return;
    const rect = viewportWrapper.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      arCanvas.width = Math.round(rect.width);
      arCanvas.height = Math.round(rect.height);
    }
  }

  // Dimension sync event listeners
  syncCanvasDimensions();
  window.addEventListener('resize', syncCanvasDimensions);
  if (webcamVideo) {
    webcamVideo.addEventListener('loadedmetadata', syncCanvasDimensions);
  }

  /**
   * Update Status Telemetry Helpers
   */
  function updateCameraStatus(status) {
    if (!cameraStatusDot || !cameraStatusText) return;
    switch (status) {
      case 'loading':
        cameraStatusDot.className = 'status-dot dot-standby';
        cameraStatusText.textContent = 'Loading...';
        break;
      case 'on':
        cameraStatusDot.className = 'status-dot dot-active';
        cameraStatusText.textContent = 'Camera On';
        break;
      case 'off':
      default:
        cameraStatusDot.className = 'status-dot dot-off';
        cameraStatusText.textContent = 'Camera Off';
        break;
    }
  }

  function updateTrackingStatus(status) {
    if (!trackingStatusDot || !trackingStatusText) return;
    switch (status) {
      case 'loading':
        trackingStatusDot.className = 'status-dot dot-standby';
        trackingStatusText.textContent = 'Loading Model';
        break;
      case 'detected':
        trackingStatusDot.className = 'status-dot dot-detected';
        trackingStatusText.textContent = 'Hand Detected';
        break;
      case 'no_hand':
        trackingStatusDot.className = 'status-dot dot-idle';
        trackingStatusText.textContent = 'No Hand Detected';
        break;
      case 'error':
        trackingStatusDot.className = 'status-dot dot-off';
        trackingStatusText.textContent = 'Tracking Error';
        break;
      case 'not_started':
      default:
        trackingStatusDot.className = 'status-dot dot-idle';
        trackingStatusText.textContent = 'Not Started';
        break;
    }
  }

  function updateSoundStatus(status) {
    if (!soundStatusDot || !soundStatusText) return;
    switch (status) {
      case 'active':
        soundStatusDot.className = 'status-dot dot-active';
        soundStatusText.textContent = 'Playing';
        break;
      case 'missing':
        soundStatusDot.className = 'status-dot dot-standby';
        soundStatusText.textContent = 'MP3 Missing';
        break;
      case 'standby':
        soundStatusDot.className = 'status-dot dot-standby';
        soundStatusText.textContent = 'Standby';
        break;
      case 'muted':
      default:
        soundStatusDot.className = 'status-dot dot-idle';
        soundStatusText.textContent = 'Muted';
        break;
    }
  }

  /**
   * Initialize MediaPipe HandLandmarker singleton (reused across camera sessions)
   */
  async function getOrInitHandLandmarker() {
    if (handLandmarker) {
      return handLandmarker;
    }

    if (isModelInitializing) {
      while (isModelInitializing) {
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      return handLandmarker;
    }

    isModelInitializing = true;
    updateTrackingStatus('loading');

    try {
      console.info('[Rasengan Lite] Fetching MediaPipe Vision WASM assets...');
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);

      console.info('[Rasengan Lite] Creating HandLandmarker model...');
      // Try GPU delegate for accelerated performance; fall back to CPU if unsupported
      try {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_LANDMARKER_MODEL_PATH,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        console.info('[Rasengan Lite] HandLandmarker initialized with GPU delegate.');
      } catch (gpuError) {
        console.warn('[Rasengan Lite] GPU delegate failed, falling back to CPU delegate:', gpuError);
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_LANDMARKER_MODEL_PATH,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        console.info('[Rasengan Lite] HandLandmarker initialized with CPU delegate.');
      }

      return handLandmarker;
    } catch (err) {
      console.error('[Rasengan Lite] Failed to initialize MediaPipe HandLandmarker:', err);
      updateTrackingStatus('error');
      throw err;
    } finally {
      isModelInitializing = false;
    }
  }

  /**
   * Map normalized landmark coordinate to canvas screen pixels,
   * accurately compensating for video object-fit: cover and CSS horizontal mirror (scaleX(-1))
   */
  function mapLandmarkToCanvas(landmark, canvasWidth, canvasHeight, videoWidth, videoHeight) {
    if (!videoWidth || !videoHeight) {
      return {
        x: (1 - landmark.x) * canvasWidth,
        y: landmark.y * canvasHeight
      };
    }

    // Determine scale factor for object-fit: cover
    const scale = Math.max(canvasWidth / videoWidth, canvasHeight / videoHeight);
    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;

    // Centered crop offsets
    const offsetX = (renderedWidth - canvasWidth) / 2;
    const offsetY = (renderedHeight - canvasHeight) / 2;

    // Map normalized raw video coordinates into crop box
    const rawX = landmark.x * renderedWidth - offsetX;
    const rawY = landmark.y * renderedHeight - offsetY;

    // Horizontally mirror X to match #webcam-video { transform: scaleX(-1) }
    return {
      x: canvasWidth - rawX,
      y: rawY
    };
  }

  /**
   * Optional Hand Skeleton visualizer for debugging mode
   */
  function drawDebugSkeleton(ctx, screenPoints) {
    ctx.save();
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.55)';

    // 1. Draw connecting skeleton bones
    for (let i = 0; i < HAND_CONNECTIONS.length; i++) {
      const [startIdx, endIdx] = HAND_CONNECTIONS[i];
      const p1 = screenPoints[startIdx];
      const p2 = screenPoints[endIdx];

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 2. Draw 21 landmark nodes
    for (let i = 0; i < screenPoints.length; i++) {
      const pt = screenPoints[i];
      const isTip = KEY_TIPS.has(i);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isTip ? 4.5 : 3.0, 0, Math.PI * 2);
      ctx.fillStyle = isTip ? 'rgba(0, 242, 254, 0.9)' : 'rgba(255, 255, 255, 0.75)';
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Main Hand Tracking & Rasengan VFX Animation Loop
   */
  function trackingLoop() {
    // Abort if camera stream or video playback is stopped
    if (!activeStream || !webcamVideo || webcamVideo.paused || webcamVideo.ended) {
      animationFrameId = null;
      return;
    }

    const now = performance.now();

    // Telemetry FPS Calculation
    frameCount++;
    if (now - lastFpsUpdate >= 500) {
      const currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
      if (fpsCounter) {
        fpsCounter.textContent = `${currentFps} FPS`;
      }
      frameCount = 0;
      lastFpsUpdate = now;
    }

    // Run MediaPipe detection only when a new video frame is ready
    if (
      handLandmarker &&
      webcamVideo.readyState >= 2 &&
      webcamVideo.currentTime !== lastVideoTime
    ) {
      lastVideoTime = webcamVideo.currentTime;

      try {
        const results = handLandmarker.detectForVideo(webcamVideo, now);

        if (results && results.landmarks && results.landmarks.length > 0) {
          const rawHand = results.landmarks[0];

          // Map all 21 raw landmarks to canvas screen pixel space
          const screenPoints = rawHand.map(lm =>
            mapLandmarkToCanvas(
              lm,
              arCanvas.width,
              arCanvas.height,
              webcamVideo.videoWidth,
              webcamVideo.videoHeight
            )
          );

          latestScreenPoints = screenPoints;

          // Calculate palm center and proportional Rasengan radius
          const palmTarget = rasenganRenderer.calculatePalmTarget(screenPoints);

          if (palmTarget) {
            rasenganRenderer.updateTarget(palmTarget.x, palmTarget.y, palmTarget.radius);

            // Trigger MP3 audio when Rasengan is active (guarded against frame-loop restarts)
            if (isSoundEnabled) {
              audioEngine.updateHandPresence(true);
              updateSoundStatus(audioEngine.isMissing ? 'missing' : 'active');
            }
          }

          updateTrackingStatus('detected');
        } else {
          // Hand lost: clear target so effect cleanly disappears
          latestScreenPoints = null;
          rasenganRenderer.clearTarget();

          // Stop audio playback when hand leaves view
          if (isSoundEnabled) {
            audioEngine.updateHandPresence(false);
            updateSoundStatus(audioEngine.isMissing ? 'missing' : 'standby');
          }

          updateTrackingStatus('no_hand');
        }
      } catch (detectErr) {
        console.warn('[Rasengan Lite] Frame detection error:', detectErr);
      }
    }

    // Always clear the overlay canvas before drawing the frame
    const ctx = arCanvas.getContext('2d');
    ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);

    // If debug skeleton is toggled on and hand landmarks are present, render skeleton
    if (showDebugSkeleton && latestScreenPoints) {
      drawDebugSkeleton(ctx, latestScreenPoints);
    }

    // Render the procedural Rasengan over the smoothed palm center
    if (rasenganRenderer.hasTarget) {
      rasenganRenderer.render(ctx, now);
    }

    // Schedule next frame
    animationFrameId = requestAnimationFrame(trackingLoop);
  }

  /**
   * Reset UI to clean Camera Off state
   */
  function resetToInitialState() {
    updateCameraStatus('off');
    updateTrackingStatus('not_started');
    updateSoundStatus(isSoundEnabled ? 'standby' : 'muted');

    if (fpsCounter) {
      fpsCounter.textContent = '60 FPS';
    }

    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;

    if (viewportPlaceholder) {
      viewportPlaceholder.classList.remove('hidden');
    }
    if (placeholderIconWrap) {
      placeholderIconWrap.classList.remove('error');
    }
    if (placeholderTitle) {
      placeholderTitle.textContent = 'Webcam Standby';
    }
    if (placeholderDesc) {
      placeholderDesc.innerHTML = 'Camera preview is currently inactive. Click <strong>Start Camera</strong> to begin.';
    }

    // Clear Rasengan target and overlay canvas
    latestScreenPoints = null;
    rasenganRenderer.clear();

    // Stop audio
    audioEngine.stop();
  }

  /**
   * Display friendly error message in placeholder overlay
   */
  function displayCameraError(error) {
    updateCameraStatus('off');
    updateTrackingStatus('not_started');

    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;

    if (viewportPlaceholder) {
      viewportPlaceholder.classList.remove('hidden');
    }
    if (placeholderIconWrap) {
      placeholderIconWrap.classList.add('error');
    }
    if (placeholderTitle) {
      placeholderTitle.textContent = 'Camera Unavailable';
    }

    let friendlyMessage = 'An unexpected error occurred while accessing your webcam.';
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      friendlyMessage = 'Camera permission was denied. Please allow camera access in your browser settings and try again.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      friendlyMessage = 'No camera device was detected. Please connect a webcam and try again.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      friendlyMessage = 'The webcam is currently in use by another application or the system cannot access it.';
    } else if (error.name === 'OverconstrainedError') {
      friendlyMessage = 'The requested camera resolution is not supported by your device.';
    } else if (error.message) {
      friendlyMessage = error.message;
    }

    if (placeholderDesc) {
      placeholderDesc.innerHTML = `${friendlyMessage} <br><br>Click <strong>Start Camera</strong> to retry.`;
    }

    console.error('[Rasengan Lite] Camera error:', error);
  }

  /**
   * Stop all active media tracks and cancel tracking loop
   */
  function stopCamera() {
    isStarting = false;

    // 1. Cancel tracking animation loop
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    lastVideoTime = -1;

    // 2. Stop camera hardware stream tracks
    if (activeStream) {
      try {
        const tracks = activeStream.getTracks();
        tracks.forEach(track => {
          track.stop();
          track.onended = null;
        });
      } catch (err) {
        console.warn('[Rasengan Lite] Error stopping tracks:', err);
      }
      activeStream = null;
    }

    // 3. Clear video element
    if (webcamVideo) {
      webcamVideo.pause();
      webcamVideo.srcObject = null;
    }

    // 4. Stop audio processing
    audioEngine.stop();

    resetToInitialState();
    console.info('[Rasengan Lite] Camera, tracking loop, audio, and VFX stopped cleanly.');
  }

  /**
   * Start live webcam stream and initialize MediaPipe tracking
   */
  async function startCamera() {
    if (isStarting || activeStream) {
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      displayCameraError(
        new Error('Your browser does not support webcam access or the page is not served via HTTPS / localhost.')
      );
      return;
    }

    isStarting = true;

    // Update UI to Loading state
    updateCameraStatus('loading');
    updateTrackingStatus('loading');

    if (btnStart) btnStart.disabled = true;
    if (btnStop) btnStop.disabled = false;

    if (placeholderTitle) {
      placeholderTitle.textContent = 'Initializing Camera & AI Model...';
    }
    if (placeholderDesc) {
      placeholderDesc.innerHTML = 'Starting webcam stream and preparing MediaPipe Hand Landmarker...';
    }

    try {
      // 1. Request camera stream
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);

      // Check if user clicked Stop while awaiting permission
      if (!isStarting) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      activeStream = stream;

      // Handle external track termination
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.warn('[Rasengan Lite] Video track ended externally.');
          stopCamera();
        };
      }

      if (webcamVideo) {
        webcamVideo.srcObject = stream;

        // Await video metadata loading
        await new Promise(resolve => {
          if (webcamVideo.readyState >= 1) {
            resolve();
          } else {
            webcamVideo.onloadedmetadata = () => resolve();
          }
        });

        await webcamVideo.play();
      }

      // Sync canvas dimensions
      syncCanvasDimensions();

      // Reveal webcam feed
      if (viewportPlaceholder) {
        viewportPlaceholder.classList.add('hidden');
      }

      // Update camera status to active
      updateCameraStatus('on');
      updateSoundStatus(isSoundEnabled ? 'standby' : 'muted');

      // 2. Initialize MediaPipe HandLandmarker (reused if already loaded)
      try {
        await getOrInitHandLandmarker();
        updateTrackingStatus('no_hand');

        // 3. Launch tracking & VFX animation loop
        if (!animationFrameId) {
          lastVideoTime = -1;
          lastFpsUpdate = performance.now();
          frameCount = 0;
          animationFrameId = requestAnimationFrame(trackingLoop);
        }
      } catch (modelErr) {
        console.error('[Rasengan Lite] Model load failure:', modelErr);
        updateTrackingStatus('error');
      }

      if (btnStart) btnStart.disabled = true;
      if (btnStop) btnStop.disabled = false;
      isStarting = false;

      console.info(
        '[Rasengan Lite] Camera & HandLandmarker online. Frame size:',
        webcamVideo?.videoWidth,
        'x',
        webcamVideo?.videoHeight
      );
    } catch (err) {
      isStarting = false;
      if (activeStream) {
        stopCamera();
      } else {
        displayCameraError(err);
      }
    }
  }

  // Audio Toggle Listener
  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', () => {
      isSoundEnabled = !isSoundEnabled;
      btnToggleSound.classList.toggle('active', isSoundEnabled);
      btnToggleSound.setAttribute('aria-pressed', String(isSoundEnabled));

      if (soundToggleText) {
        soundToggleText.textContent = isSoundEnabled ? 'Sound: ON' : 'Sound: OFF';
      }

      audioEngine.setEnabled(isSoundEnabled);

      if (isSoundEnabled) {
        if (audioEngine.isMissing) {
          updateSoundStatus('missing');
        } else {
          updateSoundStatus(rasenganRenderer.hasTarget ? 'active' : 'standby');
        }
      } else {
        updateSoundStatus('muted');
      }

      console.log(`[Rasengan Lite] Chakra sound: ${isSoundEnabled ? 'ENABLED' : 'MUTED'}`);
    });
  }

  // Debug Skeleton Toggle Listener
  if (btnToggleSkeleton) {
    btnToggleSkeleton.addEventListener('click', () => {
      showDebugSkeleton = !showDebugSkeleton;
      btnToggleSkeleton.classList.toggle('active', showDebugSkeleton);
      btnToggleSkeleton.setAttribute('aria-pressed', String(showDebugSkeleton));
      if (skeletonToggleText) {
        skeletonToggleText.textContent = showDebugSkeleton ? 'Skeleton: ON' : 'Skeleton: OFF';
      }
      console.log(`[Rasengan Lite] Debug hand skeleton: ${showDebugSkeleton ? 'ENABLED' : 'DISABLED'}`);
    });
  }

  // Particle Density Chips Listener
  densityChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const density = chip.dataset.density;
      if (!density) return;

      densityChips.forEach(c => {
        const isActive = c === chip;
        c.classList.toggle('active', isActive);
        c.setAttribute('aria-pressed', String(isActive));
      });

      rasenganRenderer.setDensity(density);
    });
  });

  // Button Event Listeners
  if (btnStart) {
    btnStart.addEventListener('click', startCamera);
  }

  if (btnStop) {
    btnStop.addEventListener('click', stopCamera);
  }

  // Set initial state
  resetToInitialState();
});
