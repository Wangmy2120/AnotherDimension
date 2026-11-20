<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { subscribeMotion } from '../lib/motion.js'

const props = defineProps({ ready: { type: Boolean, default: false } })
const emit = defineEmits(['finished'])

const canvas = ref(null)
const complete = ref(false)
const percent = ref(0)

let context
let particles = []
let unsubscribeMotion
let resizeObserver
let finishTimer
let exitTimer
let started = 0
let reducedMotion = false
let finishing = false
let canvasSize = 340

const continents = [
  [[-168, 72], [-140, 70], [-124, 56], [-130, 44], [-122, 30], [-105, 20], [-90, 18], [-82, 25], [-80, 32], [-65, 45], [-55, 55], [-70, 70], [-105, 76]],
  [[-82, 12], [-65, 9], [-48, -5], [-38, -20], [-54, -55], [-70, -45], [-76, -15]],
  [[-11, 36], [-10, 59], [20, 72], [62, 76], [112, 70], [164, 60], [171, 46], [142, 31], [121, 20], [105, 5], [78, 20], [57, 25], [41, 36], [29, 45], [10, 36]],
  [[-17, 35], [15, 37], [35, 30], [51, 10], [40, -15], [25, -35], [10, -35], [0, -20], [-15, 10]],
  [[112, -10], [155, -10], [154, -39], [130, -44], [112, -25]],
  [[-55, 82], [-20, 75], [-30, 60], [-50, 59], [-65, 72]]
]

function insidePolygon(longitude, latitude, polygon) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[index]
    const [x2, y2] = polygon[previous]
    if ((y1 > latitude) !== (y2 > latitude)
      && longitude < (x2 - x1) * (latitude - y1) / (y2 - y1) + x1) inside = !inside
  }
  return inside
}

function makeParticles() {
  const count = window.innerWidth < 600 ? 380 : 620
  const mask = document.createElement('canvas')
  mask.width = 200
  mask.height = 200
  const maskContext = mask.getContext('2d', { willReadFrequently: true })
  maskContext.fillStyle = '#fff'
  maskContext.beginPath()
  maskContext.arc(100, 100, 78, 0, Math.PI * 2)
  maskContext.fill()
  const darkSide = new Path2D('M100 22A78 78 0 0 1 100 178A39 39 0 0 1 100 100A39 39 0 0 0 100 22Z')
  maskContext.fillStyle = '#000'
  maskContext.fill(darkSide)
  maskContext.fillStyle = '#fff'
  maskContext.beginPath()
  maskContext.arc(100, 61, 9, 0, Math.PI * 2)
  maskContext.fill()
  maskContext.fillStyle = '#000'
  maskContext.beginPath()
  maskContext.arc(100, 139, 9, 0, Math.PI * 2)
  maskContext.fill()
  const pixels = maskContext.getImageData(0, 0, 200, 200).data
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  particles = Array.from({ length: count }, (_, index) => {
    const diskRadius = 78 * Math.sqrt((index + 0.5) / count)
    const diskAngle = index * goldenAngle
    const dx = Math.cos(diskAngle) * diskRadius
    const dy = Math.sin(diskAngle) * diskRadius
    const pixelIndex = (Math.round(100 + dy) * 200 + Math.round(100 + dx)) * 4
    const y = 1 - 2 * (index + 0.5) / count
    const ringRadius = Math.sqrt(1 - y * y)
    const longitude = index * goldenAngle
    const x = Math.cos(longitude) * ringRadius
    const z = Math.sin(longitude) * ringRadius
    const longitudeDegrees = Math.atan2(z, x) * 180 / Math.PI
    const latitudeDegrees = Math.asin(y) * 180 / Math.PI
    return {
      dx,
      dy,
      light: pixels[pixelIndex] > 128,
      sx: x * 78,
      sy: y * 78,
      sz: z * 78,
      land: continents.some(polygon => insidePolygon(longitudeDegrees, latitudeDegrees, polygon)),
      size: 0.65 + Math.random() * 0.8
    }
  })
}

function clamp(value) {
  return Math.min(1, Math.max(0, value))
}

function ease(value) {
  const t = clamp(value)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function mix(from, to, progress) {
  return from + (to - from) * progress
}

function rotateYin(particle, elapsed) {
  const angle = elapsed * 0.00072
  const tilt = Math.sin(elapsed * 0.00055) * 0.22
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const x = particle.dx * cos - particle.dy * sin
  const y = particle.dx * sin + particle.dy * cos
  return [x * Math.cos(tilt), y, -x * Math.sin(tilt)]
}

function rotateSphere(x, y, z, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const rotatedX = x * cos + z * sin
  const rotatedZ = -x * sin + z * cos
  const tilt = -0.3
  return [
    rotatedX,
    y * Math.cos(tilt) - rotatedZ * Math.sin(tilt),
    y * Math.sin(tilt) + rotatedZ * Math.cos(tilt)
  ]
}

function project(x, y, z, unit, center) {
  const perspective = 250 / (250 - z)
  return [center + x * perspective * unit, center + y * perspective * unit, perspective, z]
}

function drawGrid(elapsed, morph, unit, center) {
  if (morph <= 0) return
  const angle = elapsed * 0.00032
  context.beginPath()
  for (const latitudeDegrees of [-60, -30, 0, 30, 60]) {
    const latitude = latitudeDegrees * Math.PI / 180
    for (let index = 0; index <= 72; index++) {
      const longitude = index / 72 * Math.PI * 2
      const point = rotateSphere(
        Math.cos(latitude) * Math.cos(longitude) * 78,
        Math.sin(latitude) * 78,
        Math.cos(latitude) * Math.sin(longitude) * 78,
        angle
      )
      const [x, y] = project(...point, unit, center)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
  }
  for (let longitudeIndex = 0; longitudeIndex < 12; longitudeIndex++) {
    const longitude = longitudeIndex / 12 * Math.PI * 2
    for (let index = 0; index <= 48; index++) {
      const latitude = -Math.PI / 2 + index / 48 * Math.PI
      const point = rotateSphere(
        Math.cos(latitude) * Math.cos(longitude) * 78,
        Math.sin(latitude) * 78,
        Math.cos(latitude) * Math.sin(longitude) * 78,
        angle
      )
      const [x, y] = project(...point, unit, center)
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
  }
  context.strokeStyle = `rgba(235,238,242,${0.13 * morph})`
  context.lineWidth = 0.45 * unit
  context.stroke()
}

function drawInstrument(elapsed, birth, unit, center) {
  context.save()
  context.translate(center, center)
  context.rotate(elapsed * 0.000045)
  context.beginPath()
  context.arc(0, 0, 106 * unit, 0, Math.PI * 2)
  context.setLineDash([unit, 8 * unit])
  context.strokeStyle = `rgba(255,255,255,${0.2 * birth})`
  context.lineWidth = 0.6 * unit
  context.stroke()
  context.setLineDash([])
  context.beginPath()
  context.arc(0, 0, 94 * unit, -0.35, 1.15)
  context.strokeStyle = `rgba(255,255,255,${0.34 * birth})`
  context.lineWidth = 0.8 * unit
  context.stroke()
  context.rotate(-elapsed * 0.00009)
  context.beginPath()
  for (let index = 0; index < 48; index++) {
    const angle = index / 48 * Math.PI * 2
    const inner = index % 4 === 0 ? 112 : 116
    context.moveTo(Math.cos(angle) * inner * unit, Math.sin(angle) * inner * unit)
    context.lineTo(Math.cos(angle) * 120 * unit, Math.sin(angle) * 120 * unit)
  }
  context.strokeStyle = `rgba(255,255,255,${0.12 * birth})`
  context.lineWidth = 0.55 * unit
  context.stroke()
  context.restore()
}

function drawFrame(timestamp, staticFrame = false) {
  if (!context) return
  const elapsed = staticFrame ? 3000 : timestamp - started
  if (!complete.value) {
    const nextPercent = staticFrame ? 100 : Math.min(96, Math.floor(ease(elapsed / 1550) * 96))
    if (percent.value !== nextPercent) percent.value = nextPercent
  }
  const birth = ease(elapsed / 620)
  const morph = ease((elapsed - 950) / 800)
  const center = canvasSize / 2
  const unit = canvasSize / 340
  context.clearRect(0, 0, canvasSize, canvasSize)

  const glow = context.createRadialGradient(center, center, 0, center, center, 128 * unit)
  glow.addColorStop(0, `rgba(255,255,255,${0.07 + (1 - birth) * 0.16})`)
  glow.addColorStop(0.45, 'rgba(255,255,255,0.025)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = glow
  context.fillRect(0, 0, canvasSize, canvasSize)
  drawInstrument(elapsed, birth, unit, center)

  if (birth > 0 && morph < 1) {
    context.beginPath()
    context.arc(center, center, 78 * unit * birth, 0, Math.PI * 2)
    context.fillStyle = `rgba(255,255,255,${0.035 * birth * (1 - morph)})`
    context.fill()
  }
  drawGrid(elapsed, morph, unit, center)

  const globeAngle = elapsed * 0.00032
  for (const particle of particles) {
    const yin = rotateYin(particle, elapsed)
    const globe = rotateSphere(particle.sx, particle.sy, particle.sz, globeAngle)
    const x = mix(yin[0] * birth, globe[0], morph)
    const y = mix(yin[1] * birth, globe[1], morph)
    const z = mix(yin[2] * birth, globe[2], morph)
    const [screenX, screenY, perspective, depth] = project(x, y, z, unit, center)
    const yinBrightness = particle.light ? 0.94 : 0.085
    const globeBrightness = particle.land ? 0.96 : 0.13
    const brightness = mix(mix(1, yinBrightness, birth), globeBrightness, morph)
    const depthOpacity = 0.36 + 0.64 * clamp((depth / 78 + 1) / 2)
    const radius = mix(1.15, particle.size, birth) * perspective * unit
    context.beginPath()
    context.arc(screenX, screenY, Math.max(0.35, radius), 0, Math.PI * 2)
    context.fillStyle = `rgba(245,245,243,${brightness * depthOpacity})`
    context.fill()
  }
}

function resize() {
  if (!canvas.value) return
  canvasSize = canvas.value.clientWidth || 340
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
  canvas.value.width = Math.round(canvasSize * ratio)
  canvas.value.height = Math.round(canvasSize * ratio)
  context = canvas.value.getContext('2d')
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  drawFrame(performance.now(), reducedMotion)
}

function finish() {
  if (finishing) return
  finishing = true
  const elapsed = performance.now() - started
  const delay = Math.max(0, (reducedMotion ? 0 : 1850) - elapsed)
  finishTimer = window.setTimeout(() => {
    percent.value = 100
    complete.value = true
    exitTimer = window.setTimeout(() => emit('finished'), reducedMotion ? 20 : 620)
  }, delay)
}

watch(() => props.ready, value => {
  if (value) finish()
})

onMounted(() => {
  started = performance.now()
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  makeParticles()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.value)
  resize()
  if (reducedMotion) {
    drawFrame(started + 3000, true)
  } else {
    unsubscribeMotion = subscribeMotion(time => drawFrame(time))
  }
  if (props.ready) finish()
})

onBeforeUnmount(() => {
  unsubscribeMotion?.()
  window.clearTimeout(finishTimer)
  window.clearTimeout(exitTimer)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div
    class="celestial-loader"
    :class="{ 'loader--complete': complete }"
    role="status"
    :aria-label="`页面加载中 ${percent}%`"
  >
    <div class="loader-content">
      <div class="loader-instrument">
        <canvas ref="canvas" class="loader-canvas" aria-hidden="true"></canvas>
        <svg class="taiji-seal" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" />
          <path d="M50 4a46 46 0 0 1 0 92 23 23 0 0 1 0-46 23 23 0 0 0 0-46Z" />
          <circle cx="50" cy="27" r="3" /><circle cx="50" cy="73" r="3" />
        </svg>
      </div>
      <div class="loader-percent" aria-hidden="true"><span>{{ String(percent).padStart(3, '0') }}</span><small>%</small></div>
      <p class="loader-motto" aria-hidden="true"><span v-for="(character, index) in '观时 · 知位 · 见天地'" :key="index" :style="{ '--char': index }">{{ character === ' ' ? ' ' : character }}</span></p>
    </div>
  </div>
</template>

<style scoped>
.celestial-loader { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; overflow: hidden; background: rgba(3, 3, 4, 0.96); clip-path: inset(0 0 0 0); transition: clip-path 600ms cubic-bezier(0.76, 0, 0.24, 1), visibility 0s linear 600ms; }
.loader-content { position: relative; display: grid; width: min(84vw, 540px); place-items: center; transition: opacity 300ms ease, transform 600ms cubic-bezier(0.76, 0, 0.24, 1); }
.loader-instrument { position: relative; width: min(64vw, 310px); aspect-ratio: 1; }
.loader-canvas { display: block; width: 100%; height: 100%; filter: drop-shadow(0 0 32px rgba(255, 255, 255, 0.06)); }
.taiji-seal { position: absolute; inset: 19%; width: 62%; height: 62%; fill: none; stroke: oklch(0.97 0 0 / 0.28); stroke-width: 0.65; stroke-dasharray: 310; stroke-dashoffset: 310; animation: seal-draw 1.4s 0.2s ease forwards; }
.loader-percent { position: absolute; right: 0; bottom: 4%; display: flex; align-items: flex-start; color: var(--glow); font-variant-numeric: tabular-nums; line-height: 0.8; }
.loader-percent > span { font-family: 'DM Sans', sans-serif; font-size: clamp(70px, 12vw, 142px); font-weight: 200; letter-spacing: -0.08em; }
.loader-percent small { margin: 4px 0 0 12px; color: var(--silver); font-size: 12px; letter-spacing: 0.1em; }
.loader-motto { position: absolute; bottom: 0; left: 0; display: flex; color: var(--silver); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 12px; letter-spacing: 0.18em; white-space: nowrap; }
.loader-motto span { display: inline-block; opacity: 0; transform: translateY(12px); animation: character-in 480ms ease forwards; animation-delay: calc(280ms + var(--char) * 55ms); }
.loader--complete { clip-path: inset(0 0 100% 0); pointer-events: none; }
.loader--complete .loader-content { opacity: 0; transform: translateY(-30px) scale(1.06); }
@keyframes seal-draw { to { stroke-dashoffset: 0; } }
@keyframes character-in { to { opacity: 1; transform: translateY(0); } }
@media (max-width: 600px) { .loader-content { width: 86vw; } .loader-percent { right: 4px; bottom: 12%; } .loader-motto { bottom: 2%; } }
@media (prefers-reduced-motion: reduce) { .celestial-loader, .loader-content { transition: none; } .taiji-seal { stroke-dashoffset: 0; animation: none; } .loader-motto span { opacity: 1; transform: none; animation: none; } }
</style>
