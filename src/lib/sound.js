import { reactive } from 'vue'

const SOUND_KEY = 'tianji.sound'

function loadEnabled() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

let audioContext
let master

function context() {
  if (audioContext) return audioContext
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return null
  audioContext = new AudioContext()
  master = audioContext.createGain()
  master.gain.value = 0.24
  master.connect(audioContext.destination)
  return audioContext
}

function tone(frequency, duration, options = {}) {
  if (!sound.enabled) return
  const ctx = context()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = options.type || 'sine'
  oscillator.frequency.setValueAtTime(frequency, now)
  if (options.to) oscillator.frequency.exponentialRampToValueAtTime(options.to, now + duration)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(options.gain || 0.12, now + Math.min(0.012, duration / 4))
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  oscillator.connect(gain)
  gain.connect(master)
  oscillator.start(now)
  oscillator.stop(now + duration + 0.02)
}

function sweepNoise(duration = 0.24) {
  if (!sound.enabled) return
  const ctx = context()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length)
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(380, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + duration)
  filter.Q.value = 1.4
  gain.gain.setValueAtTime(0.06, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
  source.buffer = buffer
  source.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  source.start()
}

export const sound = reactive({
  enabled: loadEnabled(),
  toggle() {
    this.enabled = !this.enabled
    try { localStorage.setItem(SOUND_KEY, this.enabled ? 'on' : 'off') } catch {}
    if (this.enabled) tone(520, 0.08, { gain: 0.06 })
  },
  drop() {
    tone(190, 0.16, { to: 72, gain: 0.08, type: 'sine' })
  },
  sweep() {
    sweepNoise()
  },
  morph() {
    tone(52, 0.3, { to: 44, gain: 0.035, type: 'sine' })
  },
  coin() {
    tone(1780, 0.12, { to: 960, gain: 0.09, type: 'triangle' })
    tone(2640, 0.07, { to: 1840, gain: 0.035, type: 'sine' })
  },
  bell() {
    tone(196, 0.85, { to: 190, gain: 0.08, type: 'sine' })
    tone(392, 0.58, { to: 380, gain: 0.035, type: 'sine' })
  }
})
