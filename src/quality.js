// Graphics quality tiers + FPS-driven auto throttle ("potato mode").
// Low:  tiny geometry, pixelRatio 1, no ambient drift -> scene can go fully
//       idle between interactions (pure on-demand rendering).
// Med:  balanced; High: crisp geometry and full pixel ratio.
export const TIERS = {
  low:  { key: 'low',  label: 'Low',    sphereSeg: [10, 8],  cylSeg: 6,  pixelRatio: 1,   drift: false },
  med:  { key: 'med',  label: 'Medium', sphereSeg: [16, 12], cylSeg: 10, pixelRatio: 1.5, drift: true },
  high: { key: 'high', label: 'High',   sphereSeg: [26, 18], cylSeg: 14, pixelRatio: 2,   drift: true },
};

export const TIER_ORDER = ['low', 'med', 'high'];

// Auto mode: start at medium, drop a tier when fps stays under 30 for 2 s,
// climb back above 55 fps sustained for 4 s. Hysteresis avoids flapping.
export class AutoThrottle {
  constructor({ downFps = 30, upFps = 55, downMs = 2000, upMs = 4000 } = {}) {
    this.downFps = downFps; this.upFps = upFps;
    this.downMs = downMs; this.upMs = upMs;
    this.lowSince = null; this.highSince = null;
  }
  // Returns the suggested tier index (may equal current).
  update(fps, tierIndex, maxIndex = TIER_ORDER.length - 1) {
    const now = performance.now();
    if (fps < this.downFps) {
      this.lowSince ??= now;
      if (now - this.lowSince >= this.downMs && tierIndex > 0) {
        this.reset();
        return tierIndex - 1;
      }
    } else this.lowSince = null;
    if (fps > this.upFps) {
      this.highSince ??= now;
      if (now - this.highSince >= this.upMs && tierIndex < maxIndex) {
        this.reset();
        return tierIndex + 1;
      }
    } else this.highSince = null;
    return tierIndex;
  }
  reset() { this.lowSince = null; this.highSince = null; }
}

// Rolling fps sampler over the rAF loop. Samples every frame (even skipped
// renders): when the scene is idle, frames are nearly free, so fps stays high
// and the throttle never punishes an idle scene.
export class FpsSampler {
  constructor(windowMs = 1000) {
    this.windowMs = windowMs;
    this.frames = [];
  }
  frame(now) {
    this.frames.push(now);
    const cutoff = now - this.windowMs;
    while (this.frames.length > 2 && this.frames[0] < cutoff) this.frames.shift();
  }
  get fps() {
    if (this.frames.length < 2) return 60;
    const span = this.frames[this.frames.length - 1] - this.frames[0];
    return span > 0 ? (this.frames.length - 1) * 1000 / span : 60;
  }
}
