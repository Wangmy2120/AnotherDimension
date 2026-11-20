<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import { subscribeMotion } from '../lib/motion.js'
import { sound } from '../lib/sound.js'
import { createInkBrushSprites } from '../lib/inkTexture.js'

const props = defineProps({
  home: { type: Boolean, default: false },
  indexOpen: { type: Boolean, default: false }
})

const canvas = ref(null)
const cursorDot = ref(null)
const cursorRing = ref(null)
const cursorLabel = ref('')
const cursorVisible = ref(false)

let context
let sprites = []
let width = 0
let height = 0
let ratio = 1
let stars = []
let drops = []
let rings = []
let trail = []
let unsubscribe
let motionQuery
let finePointerQuery
let reducedMotion = false
let finePointer = false
let pointerX = -1000
let pointerY = -1000
let lastPointerX = 0
let lastPointerY = 0
let lastPointerTime = 0
let pointerInside = false
let scrollY = 0
let scrollVelocity = 0
let seed = 7127
let ringX
let ringY
let resizeObserver

function random() {
  seed = seed * 16807 % 2147483647
  return (seed - 1) / 2147483646
}

function mobile() {
  return window.innerWidth <= 760
}

function makeStars() {
  const count = reducedMotion ? 0 : props.home ? (mobile() ? 90 : 200) : (mobile() ? 30 : 40)
  stars = Array.from({ length: count }, (_, index) => {
    const layer = index % 3
    return {
      x: random() * width,
      y: random() * height,
      originX: random() * width,
      originY: random() * height,
      layer,
      size: 0.5 + layer * 0.5 + random() * 0.45,
      alpha: 0.1 + layer * 0.07 + random() * 0.08,
      drift: 0.0003 + random() * 0.0007,
      phase: random() * Math.PI * 2
    }
  })
}

function resize() {
  if (!canvas.value) return
  width = window.innerWidth
  height = window.innerHeight
  ratio = Math.min(window.devicePixelRatio || 1, 1.5)
  canvas.value.width = Math.round(width * ratio)
  canvas.value.height = Math.round(height * ratio)
  canvas.value.style.width = `${width}px`
  canvas.value.style.height = `${height}px`
  context = canvas.value.getContext('2d')
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  makeStars()
  if (reducedMotion) drawStatic()
}

function drawStatic() {
  if (!context) return
  context.clearRect(0, 0, width, height)
  const corners = [
    [width * 0.06, height * 0.12, Math.min(width, height) * 0.32],
    [width * 0.94, height * 0.42, Math.min(width, height) * 0.25],
    [width * 0.14, height * 0.94, Math.min(width, height) * 0.28]
  ]
  corners.forEach(([x, y, radius], index) => {
    context.globalAlpha = 0.055
    const brush = sprites[index % sprites.length] || sprites[0]
    if (brush) context.drawImage(brush, x - radius, y - radius, radius * 2, radius * 2)
  })
  context.globalAlpha = 1
}

function addDrop(x, y, speed = 0, options = {}) {
  const limit = mobile() ? 40 : 80
  if (drops.length >= limit) drops.splice(0, drops.length - limit + 1)
  const maxR = options.maxR || Math.min(46, 18 + speed * 13)
  drops.push({
    x,
    y,
    baseX: x,
    baseY: y,
    vx: (random() - 0.5) * 0.018,
    vy: (random() - 0.5) * 0.014 - 0.004,
    age: 0,
    life: options.life || 900 + random() * 650,
    maxR,
    alpha: options.alpha || Math.min(0.16, 0.085 + speed * 0.025),
    phase: random() * Math.PI * 2,
    drift: 2 + random() * 6,
    spriteIndex: Math.floor(random() * Math.max(1, sprites.length))
  })
}

function addPulse(x, y, silent = false) {
  addDrop(x, y, 0, { maxR: 70, alpha: 0.16, life: 1250 })
  if (rings.length >= 10) rings.shift()
  rings.push({ x, y, age: 0, life: 720, maxR: 92 })
  if (!silent) sound.drop()
}

function addTrailPoint(x, y, speed) {
  trail.push({ x, y, speed, time: performance.now() })
  if (trail.length > 14) trail.shift()
}

function handlePointerMove(event) {
  if (event.pointerType === 'touch') return
  updatePointer(event.clientX, event.clientY)
}

function handleTouchMove(event) {
  const touch = event.touches[0]
  if (touch) updatePointer(touch.clientX, touch.clientY)
}

function updatePointer(x, y) {
  if (reducedMotion) return
  const now = performance.now()
  const elapsed = Math.max(8, now - lastPointerTime)
  const distance = Math.hypot(x - lastPointerX, y - lastPointerY)
  const speed = Math.min(3.2, distance / elapsed)
  pointerX = x
  pointerY = y
  pointerInside = true
  cursorVisible.value = finePointer
  if (lastPointerTime && distance > 2) {
    const steps = Math.min(4, Math.max(1, Math.floor(distance / 12)))
    for (let index = 1; index <= steps; index += 1) {
      const amount = index / steps
      addDrop(lastPointerX + (x - lastPointerX) * amount, lastPointerY + (y - lastPointerY) * amount, speed)
    }
    addTrailPoint(x, y, speed)
    if (speed > 1.25) {
      const satellites = 2 + Math.floor(random() * 3)
      for (let index = 0; index < satellites; index += 1) {
        const angle = random() * Math.PI * 2
        const distanceFromStroke = 8 + random() * 20
        addDrop(x + Math.cos(angle) * distanceFromStroke, y + Math.sin(angle) * distanceFromStroke, speed * 0.4, {
          maxR: 8 + random() * 12,
          alpha: 0.1,
          life: 550 + random() * 350
        })
      }
    }
  }
  lastPointerX = x
  lastPointerY = y
  lastPointerTime = now
}

function handlePointerDown(event) {
  if (reducedMotion || event.pointerType === 'touch') return
  addPulse(event.clientX, event.clientY)
}

function handleTouchStart(event) {
  if (reducedMotion) return
  const touch = event.touches[0]
  if (touch) addPulse(touch.clientX, touch.clientY)
}

function handlePointerLeave(event) {
  if (!event.relatedTarget) {
    pointerInside = false
    cursorVisible.value = false
    lastPointerTime = 0
  }
}

function handleScroll() {
  const next = window.scrollY
  scrollVelocity += (next - scrollY) * 0.22
  scrollY = next
}

function handleInkPulse(event) {
  if (reducedMotion) return
  const rect = event.detail?.rect
  const x = event.detail?.x ?? (rect ? rect.left + rect.width / 2 : width / 2)
  const y = event.detail?.y ?? (rect ? rect.top + rect.height / 2 : height / 2)
  addPulse(x, y, true)
}

function drawTrail(now) {
  trail = trail.filter(point => now - point.time < 460)
  if (trail.length < 2) return
  context.save()
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (let index = 1; index < trail.length; index += 1) {
    const previous = trail[index - 1]
    const point = trail[index]
    const fade = 1 - (now - point.time) / 460
    context.beginPath()
    context.moveTo(previous.x, previous.y)
    context.lineTo(point.x, point.y)
    context.lineWidth = Math.min(8, 1.2 + point.speed * 2.2) * (index / trail.length)
    context.strokeStyle = `rgba(236,238,236,${Math.min(0.06, 0.018 + point.speed * 0.012) * fade})`
    context.stroke()
  }
  context.restore()
}

function drawDrops(delta, now) {
  for (let index = drops.length - 1; index >= 0; index -= 1) {
    const drop = drops[index]
    drop.age += delta
    if (drop.age >= drop.life) {
      drops.splice(index, 1)
      continue
    }
    const progress = drop.age / drop.life
    const growth = 1 - Math.pow(1 - Math.min(1, progress * 2.1), 3)
    const radius = 2 + (drop.maxR - 2) * growth
    const seconds = delta / 16.67
    drop.x += drop.vx * delta + Math.sin(now * 0.0012 + drop.phase) * drop.drift * 0.003 * seconds
    drop.y += drop.vy * delta + Math.cos(now * 0.001 + drop.phase) * drop.drift * 0.002 * seconds
    const fade = progress < 0.18 ? progress / 0.18 : Math.pow(1 - progress, 1.35)
    context.globalAlpha = Math.max(0, drop.alpha * fade)
    const brush = sprites[drop.spriteIndex % sprites.length] || sprites[0]
    if (!brush) continue
    context.drawImage(brush, drop.x - radius, drop.y - radius, radius * 2, radius * 2)
    if (drop.spriteIndex % 3 === 0) {
      context.globalAlpha *= 0.36
      context.drawImage(brush, drop.x - radius * 0.58, drop.y - radius * 1.2, radius * 1.35, radius * 0.9)
    }
  }
  context.globalAlpha = 1
}

function drawRings(delta) {
  for (let index = rings.length - 1; index >= 0; index -= 1) {
    const ring = rings[index]
    ring.age += delta
    if (ring.age >= ring.life) {
      rings.splice(index, 1)
      continue
    }
    const progress = ring.age / ring.life
    context.beginPath()
    context.arc(ring.x, ring.y, 8 + ring.maxR * (1 - Math.pow(1 - progress, 3)), 0, Math.PI * 2)
    context.strokeStyle = `rgba(238,240,238,${0.12 * (1 - progress)})`
    context.lineWidth = 0.8
    context.stroke()
  }
}

function drawStars(delta, now) {
  scrollVelocity *= Math.pow(0.88, delta / 16.67)
  const gather = props.indexOpen
  stars.forEach(star => {
    const depth = (star.layer + 1) / 3
    if (gather) {
      const angle = star.phase
      const targetX = width / 2 + Math.cos(angle + now * 0.00008) * (90 + star.layer * 48)
      const targetY = height / 2 + Math.sin(angle + now * 0.00008) * (90 + star.layer * 48)
      star.x += (targetX - star.x) * 0.035
      star.y += (targetY - star.y) * 0.035
    } else {
      star.y -= scrollVelocity * depth
      star.x += Math.sin(now * star.drift + star.phase) * 0.015 * depth * delta
      if (star.y < -12) star.y = height + 12
      if (star.y > height + 12) star.y = -12
      if (star.x < -12) star.x = width + 12
      if (star.x > width + 12) star.x = -12
    }
    let x = star.x
    let y = star.y
    if (pointerInside) {
      const dx = x - pointerX
      const dy = y - pointerY
      const distance = Math.hypot(dx, dy)
      if (distance < 120 && distance > 0.1) {
        const pull = (1 - distance / 120) * 12 * depth
        x -= dx / distance * pull
        y -= dy / distance * pull
      }
    }
    const trailLength = Math.min(20, Math.abs(scrollVelocity) * depth * 0.8)
    context.beginPath()
    if (trailLength > 1.5) {
      context.moveTo(x, y)
      context.lineTo(x, y + Math.sign(scrollVelocity) * trailLength)
      context.strokeStyle = `rgba(235,237,235,${star.alpha * 0.42})`
      context.lineWidth = star.size
      context.stroke()
    } else {
      context.arc(x, y, star.size, 0, Math.PI * 2)
      context.fillStyle = `rgba(235,237,235,${star.alpha})`
      context.fill()
    }
  })
}

function draw(now, delta) {
  if (!context || reducedMotion) return
  context.clearRect(0, 0, width, height)
  drawStars(delta, now)
  drawTrail(now)
  drawDrops(delta, now)
  drawRings(delta)
}

function updateCursor(event) {
  if (!finePointer || !cursorDot.value || !cursorRing.value) return
  const target = event.target instanceof Element ? event.target : null
  const systemInput = target?.closest('input, textarea, select, [contenteditable="true"]')
  const interactive = target?.closest('button, a, [role="button"]')
  const heroCanvas = target?.closest('.cosmic-stage canvas, .hero-canvas')
  cursorVisible.value = !systemInput
  cursorLabel.value = heroCanvas ? '拖拽' : interactive ? '开启' : ''
  cursorRing.value?.classList.toggle('is-active', Boolean(heroCanvas || interactive))
  cursorDot.value.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`
  ringX?.(event.clientX)
  ringY?.(event.clientY)
}

function startMotion() {
  if (!unsubscribe && !reducedMotion) unsubscribe = subscribeMotion(draw)
}

function stopMotion() {
  unsubscribe?.()
  unsubscribe = undefined
}

function handleMotionChange() {
  reducedMotion = motionQuery.matches
  if (reducedMotion) {
    stopMotion()
    drops = []
    rings = []
    trail = []
    makeStars()
    drawStatic()
  } else {
    makeStars()
    startMotion()
  }
}

function handleFinePointerChange() {
  finePointer = finePointerQuery.matches
  document.documentElement.classList.toggle('has-custom-cursor', finePointer && !reducedMotion)
  if (!finePointer) cursorVisible.value = false
}

watch(() => props.home, () => {
  makeStars()
  if (reducedMotion) drawStatic()
})

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  finePointerQuery = window.matchMedia('(pointer: fine)')
  reducedMotion = motionQuery.matches
  finePointer = finePointerQuery.matches
  sprites = createInkBrushSprites(6, 128)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(document.documentElement)
  resize()
  scrollY = window.scrollY
  motionQuery.addEventListener('change', handleMotionChange)
  finePointerQuery.addEventListener('change', handleFinePointerChange)
  handleFinePointerChange()
  window.addEventListener('pointermove', handlePointerMove, { passive: true })
  window.addEventListener('pointermove', updateCursor, { passive: true })
  window.addEventListener('pointerdown', handlePointerDown, { passive: true })
  window.addEventListener('touchmove', handleTouchMove, { passive: true })
  window.addEventListener('touchstart', handleTouchStart, { passive: true })
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('tianji:ink-pulse', handleInkPulse)
  document.addEventListener('mouseout', handlePointerLeave)
  if (!reducedMotion) startMotion()
  else drawStatic()
  if (finePointer) {
    ringX = gsap.quickTo(cursorRing.value, 'x', { duration: 0.28, ease: 'power3.out' })
    ringY = gsap.quickTo(cursorRing.value, 'y', { duration: 0.28, ease: 'power3.out' })
  }
})

onBeforeUnmount(() => {
  stopMotion()
  resizeObserver?.disconnect()
  motionQuery?.removeEventListener('change', handleMotionChange)
  finePointerQuery?.removeEventListener('change', handleFinePointerChange)
  document.documentElement.classList.remove('has-custom-cursor')
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointermove', updateCursor)
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('tianji:ink-pulse', handleInkPulse)
  document.removeEventListener('mouseout', handlePointerLeave)
  sprites = []
})
</script>

<template>
  <div class="ink-field" :class="{ 'is-reduced': reducedMotion }" aria-hidden="true">
    <canvas ref="canvas" class="ink-canvas"></canvas>
    <div ref="cursorDot" class="cursor-dot" :class="{ visible: cursorVisible }"></div>
    <div ref="cursorRing" class="cursor-ring" :class="{ visible: cursorVisible }">
      <span>{{ cursorLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.ink-field { position: fixed; inset: 0; z-index: 35; pointer-events: none; }
.ink-canvas { position: absolute; inset: 0; display: block; pointer-events: none; mix-blend-mode: screen; }
.cursor-dot,
.cursor-ring { position: fixed; top: 0; left: 0; pointer-events: none; opacity: 0; transition: opacity 160ms ease; }
.cursor-dot { z-index: 302; width: 4px; height: 4px; margin: -2px 0 0 -2px; border-radius: 50%; background: var(--glow); box-shadow: 0 0 8px oklch(0.97 0 0 / 0.25); }
.cursor-ring { z-index: 301; display: grid; width: 38px; height: 38px; margin: -19px 0 0 -19px; place-items: center; border: 1px solid oklch(0.97 0 0 / 0.38); border-radius: 50%; transition: width 180ms ease, height 180ms ease, margin 180ms ease, opacity 160ms ease, background-color 180ms ease; }
.cursor-ring.is-active { width: 58px; height: 58px; margin: -29px 0 0 -29px; background: oklch(0.05 0 0 / 0.3); border-color: oklch(0.97 0 0 / 0.7); }
.cursor-ring span { color: var(--glow); font-size: 10px; letter-spacing: 0.08em; }
.cursor-dot.visible,
.cursor-ring.visible { opacity: 1; }
@media (pointer: coarse), (prefers-reduced-motion: reduce) { .cursor-dot, .cursor-ring { display: none; } }
</style>
