/**
 * Rasengan Lite — Procedural 2D Canvas Rasengan VFX Engine
 *
 * Renders an anime-inspired, high-velocity spinning chakra sphere:
 * 1. Radiant white-hot plasma nucleus
 * 2. Multi-axis high-speed rotating spiral chakra bands
 * 3. Additive blending layered radial glow & pulsing aura
 * 4. Orbiting energy particles with short motion trails
 * 5. Smooth exponential interpolation (lerp) for jitter reduction
 * 6. Particle density presets (Low / Medium / High)
 *
 * Zero external libraries, purely HTML5 Canvas 2D math.
 */

export const RASENGAN_MODULE_INFO = {
  name: 'Rasengan Procedural VFX Engine',
  version: '1.2.0',
  stage: 'Stage 5 Polish'
};

/**
 * Palm tracking and positioning configuration.
 * All offsets, scaling, and smoothing constants are centralized here.
 */
export const PALM_CONFIG = {
  // Position along the vector from wrist (landmark 0) to middle knuckle (landmark 9)
  // 0.0 = wrist, 1.0 = middle knuckle base. 0.58 lands in the center of the palm basin.
  knuckleOffsetFactor: 0.58,

  // Size ratio of the Rasengan radius relative to hand span (wrist to middle knuckle distance)
  sizeMultiplier: 0.54,

  // Radius boundaries in canvas pixels
  minRadius: 32,
  maxRadius: 145,

  // Exponential smoothing factor for palm position (0.01 = heavy lag, 1.0 = raw/no smoothing)
  positionSmoothing: 0.32,

  // Exponential smoothing factor for radius scaling
  radiusSmoothing: 0.22
};

/**
 * Particle density presets for performance tuning
 */
export const PARTICLE_DENSITY_PRESETS = {
  low: { particleCount: 22, spiralArmCount: 5 },
  medium: { particleCount: 46, spiralArmCount: 7 },
  high: { particleCount: 80, spiralArmCount: 9 }
};

/**
 * Visual styling and particle tuning constants
 */
export const DEFAULT_RASENGAN_CONFIG = {
  density: 'medium',
  particleCount: PARTICLE_DENSITY_PRESETS.medium.particleCount,
  spiralArmCount: PARTICLE_DENSITY_PRESETS.medium.spiralArmCount,
  baseColorCyan: 'rgba(0, 242, 254, 0.85)',
  auraColorBlue: 'rgba(2, 132, 199, 0.3)',
  coreColorWhite: '#ffffff',
  swirlSpeedBase: 12.0 // radians per second
};

// Static ring configurations moved outside render loop to eliminate per-frame allocations
const ORBIT_RING_CONFIGS = [
  { rFactor: 0.62, tilt: 0.38, speed: 15.0, color: 'rgba(0, 242, 254, 0.65)' },
  { rFactor: 0.84, tilt: -0.52, speed: -17.5, color: 'rgba(56, 189, 248, 0.55)' },
  { rFactor: 0.98, tilt: 0.82, speed: 13.0, color: 'rgba(2, 132, 199, 0.45)' }
];

export class RasenganRenderer {
  /**
   * @param {HTMLCanvasElement} canvas - Target overlay canvas
   * @param {Object} [config] - Optional overrides for DEFAULT_RASENGAN_CONFIG
   */
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.config = { ...DEFAULT_RASENGAN_CONFIG, ...config };
    this.currentDensity = this.config.density || 'medium';

    // Smoothed state coordinates
    this.smoothedX = null;
    this.smoothedY = null;
    this.smoothedRadius = null;
    this.hasTarget = false;

    // Timing
    this.lastRenderTime = 0;

    // Persistent Particle Pool (zero allocations per frame)
    this.particles = this.createParticlePool(this.config.particleCount);
  }

  /**
   * Update particle density preset without recreating renderer instance
   * @param {'low' | 'medium' | 'high'} level
   */
  setDensity(level) {
    const validLevel = level in PARTICLE_DENSITY_PRESETS ? level : 'medium';
    const preset = PARTICLE_DENSITY_PRESETS[validLevel];

    this.currentDensity = validLevel;
    this.config.particleCount = preset.particleCount;
    this.config.spiralArmCount = preset.spiralArmCount;

    // Reallocate pool only on user change, never in animation frame
    this.particles = this.createParticlePool(preset.particleCount);
    console.info(`[RasenganRenderer] Particle density updated to ${validLevel.toUpperCase()} (${preset.particleCount} particles).`);
  }

  /**
   * Get current particle density level
   * @returns {'low' | 'medium' | 'high'}
   */
  getDensity() {
    return this.currentDensity;
  }

  /**
   * Initialize a reusable particle pool for orbiting chakra sparks
   */
  createParticlePool(count) {
    const pool = [];
    for (let i = 0; i < count; i++) {
      pool.push({
        radiusRatio: 0.3 + Math.random() * 0.85, // relative to sphere radius
        angle: Math.random() * Math.PI * 2,
        speed: (4.5 + Math.random() * 6.0) * (Math.random() > 0.15 ? 1 : -1), // mostly clockwise, some turbulent
        tiltAngle: (Math.random() - 0.5) * Math.PI * 0.85,
        eccentricity: 0.45 + Math.random() * 0.45,
        wobbleSpeed: 2.5 + Math.random() * 4.0,
        wobblePhase: Math.random() * Math.PI * 2,
        size: 1.5 + Math.random() * 1.6,
        alpha: 0.5 + Math.random() * 0.5,
        // Pre-allocated trail history of 3 previous points
        trail: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ]
      });
    }
    return pool;
  }

  /**
   * Calculate palm center and scale from MediaPipe hand landmarks in canvas screen space
   * @param {Array<{x: number, y: number}>} screenLandmarks - 21 screen-mapped landmarks
   * @returns {{x: number, y: number, radius: number} | null}
   */
  calculatePalmTarget(screenLandmarks) {
    if (!screenLandmarks || screenLandmarks.length < 21) {
      return null;
    }

    // Key landmarks: 0 (Wrist), 5 (Index MCP), 9 (Middle MCP), 17 (Pinky MCP)
    const wrist = screenLandmarks[0];
    const middleKnuckle = screenLandmarks[9];

    // Axis vector pointing from wrist to middle knuckle
    const axisX = middleKnuckle.x - wrist.x;
    const axisY = middleKnuckle.y - wrist.y;
    const handSpan = Math.hypot(axisX, axisY);

    if (handSpan <= 0) return null;

    // Palm center estimated along the hand longitudinal axis
    const palmX = wrist.x + axisX * PALM_CONFIG.knuckleOffsetFactor;
    const palmY = wrist.y + axisY * PALM_CONFIG.knuckleOffsetFactor;

    // Dynamic radius scaled to hand size and clamped within bounds
    const rawRadius = handSpan * PALM_CONFIG.sizeMultiplier;
    const radius = Math.max(PALM_CONFIG.minRadius, Math.min(PALM_CONFIG.maxRadius, rawRadius));

    return { x: palmX, y: palmY, radius };
  }

  /**
   * Update the smoothed palm target position
   * @param {number} targetX
   * @param {number} targetY
   * @param {number} targetRadius
   */
  updateTarget(targetX, targetY, targetRadius) {
    if (!this.hasTarget || this.smoothedX === null) {
      // First frame of detection: snap instantly to avoid glide from origin
      this.smoothedX = targetX;
      this.smoothedY = targetY;
      this.smoothedRadius = targetRadius;
      this.hasTarget = true;
    } else {
      // Exponential smoothing (lerp)
      this.smoothedX += (targetX - this.smoothedX) * PALM_CONFIG.positionSmoothing;
      this.smoothedY += (targetY - this.smoothedY) * PALM_CONFIG.positionSmoothing;
      this.smoothedRadius += (targetRadius - this.smoothedRadius) * PALM_CONFIG.radiusSmoothing;
    }
  }

  /**
   * Reset target and smoothed positions when hand disappears
   */
  clearTarget() {
    this.hasTarget = false;
    this.smoothedX = null;
    this.smoothedY = null;
    this.smoothedRadius = null;
  }

  /**
   * Render the complete procedural Rasengan effect
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {number} currentTimeMs - Current timestamp in milliseconds
   */
  render(ctx, currentTimeMs) {
    if (!this.hasTarget || this.smoothedX === null || this.smoothedRadius === null) {
      return;
    }

    const t = currentTimeMs / 1000;
    const dt = this.lastRenderTime > 0 ? Math.min((currentTimeMs - this.lastRenderTime) / 1000, 0.1) : 0.016;
    this.lastRenderTime = currentTimeMs;

    const cx = this.smoothedX;
    const cy = this.smoothedY;
    const R = this.smoothedRadius;

    ctx.save();

    // Use additive blending for intense energy radiance without expensive Gaussian blurs
    ctx.globalCompositeOperation = 'lighter';

    // 1. Layer: Ambient Outer Aura & Pulsing Energy Shell
    this.drawAura(ctx, cx, cy, R, t);

    // 2. Layer: Swirling Spiral Chakra Bands
    this.drawSpiralBands(ctx, cx, cy, R, t);

    // 3. Layer: High-Speed Concentric Internal Orbit Rings
    this.drawOrbitRings(ctx, cx, cy, R, t);

    // 4. Layer: Orbiting Energy Particles with Motion Trails
    this.drawParticles(ctx, cx, cy, R, t, dt);

    // 5. Layer: Dense Radiant White Plasma Core
    this.drawCore(ctx, cx, cy, R, t);

    // 6. Layer: Crackling Chakra Whisps / Perimeter Flares
    this.drawFlares(ctx, cx, cy, R, t);

    ctx.restore();
  }

  /**
   * Draw the outer layered radial aura with pulsing breathing motion
   */
  drawAura(ctx, cx, cy, R, t) {
    const pulseFactor = 1.0 + 0.04 * Math.sin(t * 7.5);
    const outerAuraRadius = R * 1.38 * pulseFactor;

    const grad = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, outerAuraRadius);
    grad.addColorStop(0, 'rgba(0, 242, 254, 0.45)');
    grad.addColorStop(0.45, 'rgba(2, 132, 199, 0.22)');
    grad.addColorStop(0.8, 'rgba(0, 102, 255, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(cx, cy, outerAuraRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  /**
   * Draw rotating spiral chakra bands flowing in 3D perspective
   */
  drawSpiralBands(ctx, cx, cy, R, t) {
    const arms = this.config.spiralArmCount;
    const baseSpeed = this.config.swirlSpeedBase;

    ctx.save();
    ctx.lineCap = 'round';

    for (let i = 0; i < arms; i++) {
      const armAngleOffset = (i * Math.PI * 2) / arms;
      const armTilt = ((i % 3) - 1) * 0.4; // varied inclination angles for volumetric sphere feel
      const armDirection = i % 2 === 0 ? 1 : -0.85; // turbulent counter-currents

      ctx.beginPath();
      let first = true;
      const steps = 18;

      for (let s = 0; s <= steps; s++) {
        const progress = s / steps;
        const currentR = R * (0.22 + progress * 0.78);
        const theta = armAngleOffset + t * baseSpeed * armDirection + progress * 3.8;

        // Apply orbital perspective tilt
        const u = currentR * Math.cos(theta);
        const v = currentR * Math.sin(theta) * (0.75 + armTilt * 0.35);

        // Rotate by tilt angle
        const px = cx + u * Math.cos(armTilt) - v * Math.sin(armTilt);
        const py = cy + u * Math.sin(armTilt) + v * Math.cos(armTilt);

        if (first) {
          ctx.moveTo(px, py);
          first = false;
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.strokeStyle = i % 2 === 0 ? 'rgba(0, 242, 254, 0.7)' : 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 2.2 + Math.sin(t * 10 + i) * 0.8;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw internal concentric energy rings spinning at rapid angular rates
   * Uses pre-allocated static ORBIT_RING_CONFIGS to prevent per-frame allocations
   */
  drawOrbitRings(ctx, cx, cy, R, t) {
    ctx.save();
    ctx.lineWidth = 1.6;

    for (let j = 0; j < ORBIT_RING_CONFIGS.length; j++) {
      const ring = ORBIT_RING_CONFIGS[j];
      const ringR = R * ring.rFactor;
      const angle = t * ring.speed;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ring.tilt);
      ctx.scale(1, 0.55 + 0.1 * Math.sin(t * 6 + j)); // dynamic perspective wobble

      ctx.beginPath();
      ctx.arc(0, 0, ringR, angle, angle + Math.PI * 1.5);
      ctx.strokeStyle = ring.color;
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Update and render orbiting energy particles with short motion trails
   */
  drawParticles(ctx, cx, cy, R, t, dt) {
    const particles = this.particles;

    for (let k = 0; k < particles.length; k++) {
      const p = particles[k];

      // Update angle
      p.angle += p.speed * dt;

      // Calculate instantaneous radius with dynamic turbulence
      const currentPRadius = R * (p.radiusRatio + 0.04 * Math.sin(t * p.wobbleSpeed + p.wobblePhase));

      // Calculate orbital 2D coordinates on inclined orbital plane
      const u = currentPRadius * Math.cos(p.angle);
      const v = currentPRadius * Math.sin(p.angle) * p.eccentricity;

      const px = cx + u * Math.cos(p.tiltAngle) - v * Math.sin(p.tiltAngle);
      const py = cy + u * Math.sin(p.tiltAngle) + v * Math.cos(p.tiltAngle);

      // Draw short motion trail from historical points
      const trail = p.trail;
      ctx.beginPath();
      ctx.moveTo(trail[0].x || px, trail[0].y || py);
      ctx.lineTo(trail[1].x || px, trail[1].y || py);
      ctx.lineTo(px, py);
      ctx.strokeStyle = `rgba(0, 242, 254, ${p.alpha * 0.45})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Shift trail history in-place
      trail[0].x = trail[1].x;
      trail[0].y = trail[1].y;
      trail[1].x = px;
      trail[1].y = py;

      // Draw bright spark head
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  /**
   * Draw the dense white-hot plasma nucleus at the center of the Rasengan
   */
  drawCore(ctx, cx, cy, R, t) {
    const corePulse = 1.0 + 0.03 * Math.sin(t * 14);
    const coreRadius = R * 0.32 * corePulse;

    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.35, 'rgba(224, 255, 255, 0.98)');
    coreGrad.addColorStop(0.72, 'rgba(0, 242, 254, 0.85)');
    coreGrad.addColorStop(1, 'rgba(0, 180, 255, 0)');

    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();
  }

  /**
   * Draw erratic chakra flares around the perimeter for turbulent energy feel
   */
  drawFlares(ctx, cx, cy, R, t) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(200, 250, 255, 0.7)';

    for (let f = 0; f < 3; f++) {
      const flareAngle = t * 11 + f * 2.1;
      const flareLen = R * (0.92 + 0.15 * Math.sin(t * 18 + f * 4));

      const x1 = cx + Math.cos(flareAngle) * (R * 0.7);
      const y1 = cy + Math.sin(flareAngle) * (R * 0.7);

      const midAngle = flareAngle + 0.25 * Math.sin(t * 22 + f);
      const xMid = cx + Math.cos(midAngle) * flareLen;
      const yMid = cy + Math.sin(midAngle) * flareLen;

      const x2 = cx + Math.cos(flareAngle + 0.45) * (R * 0.85);
      const y2 = cy + Math.sin(flareAngle + 0.45) * (R * 0.85);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(xMid, yMid, x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Clear the overlay canvas and reset smoothed state
   */
  clear() {
    this.clearTarget();
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
