'use client'

// Web Audio API-based sound effects for the SPIN wheel.
// All sounds are synthesized — no file downloads.

class SpinAudio {
  private ctx:     AudioContext | null = null
  private enabled: boolean             = false

  setEnabled(v: boolean): void {
    this.enabled = v
    if (v && !this.ctx) {
      try { this.ctx = new AudioContext() } catch { /* SSR / blocked */ }
    }
    if (v && this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  isEnabled(): boolean { return this.enabled }

  // Resume context on user gesture (required by browsers)
  resume(): void {
    this.ctx?.resume().catch(() => {})
  }

  private beep(
    freq:     number,
    duration: number,
    gain  = 0.08,
    type: OscillatorType = 'triangle',
    delay = 0,
  ): void {
    if (!this.ctx || !this.enabled) return
    const ctx = this.ctx
    const now = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g   = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain, now)
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration + 0.01)
  }

  // Called each time the pointer crosses a new segment during decel.
  // speed: 0 (slow) → 1 (fast) — controls pitch and brightness.
  tick(speed = 0.5): void {
    const freq = 400 + speed * 900
    this.beep(freq, 0.04, 0.05 + speed * 0.04, 'triangle')
  }

  // Called when the wheel bounces back to its final position.
  land(): void {
    this.beep(220, 0.12, 0.10, 'triangle')
    this.beep(330, 0.10, 0.07, 'triangle', 0.08)
    this.beep(440, 0.08, 0.05, 'sine',     0.16)
  }

  // Reward chord — pitch/length scale with XP amount.
  reward(xp: number): void {
    const base = xp >= 250 ? 523.25 : xp >= 100 ? 440 : xp >= 50 ? 369.99 : 329.63
    const vol  = Math.min(0.20, 0.10 + (xp / 250) * 0.10)
    this.beep(base,        0.40, vol,        'sine',     0)
    this.beep(base * 1.26, 0.35, vol * 0.75, 'sine',     0.12)
    this.beep(base * 1.50, 0.55, vol * 0.60, 'sine',     0.24)
    this.beep(base * 2.00, 0.30, vol * 0.40, 'triangle', 0.40)
  }
}

// Singleton — shared across the SPIN page lifecycle.
export const spinAudio = new SpinAudio()
