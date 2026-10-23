/**
 * Rasengan Lite — Rasengan MP3 Audio Controller
 *
 * Manages playback of the user's authentic Rasengan audio file:
 * Location: assets/audio/rasengan.mp3
 *
 * Features:
 * - Sound toggle (OFF by default)
 * - Plays when the Rasengan activates on palm detection
 * - Frame-loop guard: never restarts audio on consecutive tracking frames
 * - Overlap prevention: single-instance playback with clean pause/rewind
 * - Safe lifecycle release when camera stops or hand disappears
 * - Graceful error handling if file is missing or autoplay is restricted
 */

export const AUDIO_PATH = 'assets/audio/rasengan.mp3';

export class ChakraAudioEngine {
  /**
   * @param {string} [audioPath=AUDIO_PATH] - Path to the MP3 file
   */
  constructor(audioPath = AUDIO_PATH) {
    this.audioPath = audioPath;
    this.enabled = false;
    this.isHandPresent = false;
    this.isPlaying = false;
    this.isMissing = false;
    this.audio = null;

    this.initAudioElement();
  }

  /**
   * Initialize HTML5 Audio element and listeners
   */
  initAudioElement() {
    try {
      this.audio = new Audio(this.audioPath);
      this.audio.preload = 'auto';
      this.audio.loop = true; // Loops seamlessly while Rasengan is held active in palm

      // Listen for loading errors (e.g. 404 when file is not yet placed)
      this.audio.addEventListener('error', () => {
        this.isMissing = true;
        this.isPlaying = false;
        console.warn(
          `[RasenganAudio] Notice: Audio file not found at "${this.audioPath}".\n` +
          `To enable custom sound, place your MP3 file at: D:\\projects\\mini\\assets\\audio\\rasengan.mp3`
        );
      });

      // Handle natural playback completion (if loop is disabled)
      this.audio.addEventListener('ended', () => {
        this.isPlaying = false;
      });

      // Pause audio if user changes browser tabs
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden && this.isPlaying) {
            this.pause();
          }
        });
      }
    } catch (err) {
      console.warn('[RasenganAudio] Audio initialization exception:', err);
    }
  }

  /**
   * Toggle Sound ON or OFF (OFF by default)
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);

    if (this.enabled) {
      // If user enables sound while hand is already detected, activate playback
      if (this.isHandPresent && !this.isPlaying) {
        this.play();
      }
    } else {
      // Sound disabled: stop and reset immediately
      this.stop();
    }
  }

  /**
   * Start playback of rasengan.mp3
   * Guarded against duplicate/overlapping calls on consecutive tracking frames
   */
  play() {
    if (!this.enabled || !this.audio || this.isPlaying || this.isMissing) {
      return;
    }

    try {
      this.audio.currentTime = 0;
      const playPromise = this.audio.play();

      if (playPromise !== undefined) {
        this.isPlaying = true;

        playPromise.catch((err) => {
          this.isPlaying = false;

          // AbortError occurs normally if pause() is called while play() is pending
          if (err.name === 'AbortError') {
            return;
          }

          if (err.name === 'NotAllowedError') {
            console.warn('[RasenganAudio] Autoplay restricted by browser. Click the Sound toggle to allow audio.');
          } else {
            console.warn(`[RasenganAudio] Playback notice: ${err.message}`);
          }
        });
      } else {
        this.isPlaying = true;
      }
    } catch (err) {
      this.isPlaying = false;
      console.warn('[RasenganAudio] Error playing audio:', err);
    }
  }

  /**
   * Pause playback
   */
  pause() {
    if (!this.audio) return;
    try {
      this.audio.pause();
    } catch (err) {
      console.warn('[RasenganAudio] Error pausing audio:', err);
    }
  }

  /**
   * Stop audio and reset position to 0
   * Prevents overlapping playback when camera stops or restarts
   */
  stop() {
    this.isPlaying = false;
    this.isHandPresent = false;

    if (!this.audio) return;

    try {
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch (err) {
      console.warn('[RasenganAudio] Error resetting audio:', err);
    }
  }

  /**
   * Synchronize audio with hand detection lifecycle
   * @param {boolean} isPresent - Whether hand is currently detected and Rasengan is active
   */
  updateHandPresence(isPresent) {
    this.isHandPresent = Boolean(isPresent);

    if (!this.enabled) {
      if (this.isPlaying) this.stop();
      return;
    }

    if (this.isHandPresent) {
      // Hand detected: start playback once if not already playing
      if (!this.isPlaying) {
        this.play();
      }
    } else {
      // Hand lost: stop audio immediately
      if (this.isPlaying) {
        this.stop();
      }
    }
  }
}

// Export alias for backward compatibility
export { ChakraAudioEngine as RasenganAudioPlayer };
