<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { subscribeMotion } from '../lib/motion.js'
import { sound } from '../lib/sound.js'
import { createInkBrushSprites } from '../lib/inkTexture.js'
import ChapterInstrument from './ChapterInstrument.vue'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps({ items: { type: Array, required: true } })
const emit = defineEmits(['open'])
const root = ref(null)
const track = ref(null)
const stage = ref(null)
const sceneHost = ref(null)
const inkCanvas = ref(null)
const inkFrontCanvas = ref(null)
const activeIndex = ref(0)
const previewIndex = ref(null)
const progress = ref(0)
const reducedMotion = ref(false)
const webglFailed = ref(false)
const isMobile = ref(false)
const opening = ref(false)
const staticMode = computed(() => reducedMotion.value || webglFailed.value)
const progressPercent = computed(() => Math.round(progress.value * 100))
const displayIndex = computed(() => previewIndex.value ?? activeIndex.value)
const ITEM_COUNT = props.items.length

let renderer
let scene
let camera
let world
let stars
let forms = []
let formWeights = Array(ITEM_COUNT).fill(0)
let scrollTrigger
let resizeObserver
let intersectionObserver
let motionQuery
let mobileQuery
let unsubscribeMotion
let initialized = false
let activated = false
let inView = false
let running = false
let stageWidth = 1
let stageHeight = 1
let dragPhase = 0
let dragVelocity = 0
let dragging = false
let dragX = 0
let zoomOverlay = null
let zoomTimers = []
let inkContext
let inkSprites = []
let inkWidth = 1
let inkHeight = 1
let inkFrontContext
let inkFrontWidth = 1
let inkFrontHeight = 1
let inkFlow = 0
let inkLastTime = 0
let inkLastProgress = 0
let spiralRadius = 320
let spiralRow = 260
let stageCardWidth = 520
let stageCardHeight = 420
const inkParticles = Array.from({ length: 64 }, (_, index) => ({
  seed: ((index * 0.61803398875) % 1),
  size: 0.45 + ((index * 0.38196601125) % 1) * 0.9,
  speed: 0.65 + ((index * 0.2360679775) % 1) * 0.8,
  sway: 0.6 + ((index * 0.527864045) % 1) * 1.7
}))

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function easeInOut(value) {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2
}

function openItem(item, event) {
  if (!item || opening.value) return
  sound.morph()
  if (staticMode.value || reducedMotion.value || typeof Element === 'undefined') {
    emit('open', item.key)
    return
  }
  const source = event?.currentTarget instanceof Element ? event.currentTarget : null
  const rect = source?.getBoundingClientRect()
  if (!rect || !window.Element.prototype.animate) {
    emit('open', item.key)
    return
  }
  opening.value = true
  buildZoomOverlay(item, rect)
  zoomTimers.push(window.setTimeout(() => emit('open', item.key), 220))
}

function buildZoomOverlay(item, rect) {
  const overlay = document.createElement('div')
  overlay.className = 'chapter-zoom'
  overlay.setAttribute('aria-hidden', 'true')
  const veil = document.createElement('div')
  veil.className = 'chapter-zoom-veil'
  const card = document.createElement('div')
  card.className = 'chapter-zoom-card'
  card.style.left = `${rect.left}px`
  card.style.top = `${rect.top}px`
  card.style.width = `${rect.width}px`
  card.style.height = `${rect.height}px`

  const code = document.createElement('span')
  code.className = 'chapter-zoom-code'
  code.textContent = item.chapter
  const label = document.createElement('span')
  label.className = 'chapter-zoom-label'
  label.textContent = item.label
  const title = document.createElement('span')
  title.className = 'chapter-zoom-title'
  title.textContent = item.title
  const rule = document.createElement('span')
  rule.className = 'chapter-zoom-rule'
  const caption = document.createElement('span')
  caption.className = 'chapter-zoom-caption'
  caption.textContent = 'ENTERING THE CHAPTER'
  const flare = document.createElement('span')
  flare.className = 'chapter-zoom-flare'

  card.append(code, label, title, rule, caption, flare)
  overlay.append(veil, card)
  document.body.append(overlay)
  zoomOverlay = overlay

  try {
    card.animate([
      { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` },
      { left: '0px', top: '0px', width: `${window.innerWidth}px`, height: `${window.innerHeight}px` }
    ], { duration: 640, easing: 'cubic-bezier(.76, 0, .24, 1)', fill: 'forwards' })
    veil.animate([
      { opacity: 0 },
      { opacity: 1 }
    ], { duration: 420, delay: 90, easing: 'ease-out', fill: 'both' })
  } catch {
    cleanupZoomOverlay()
    return
  }

  const fadeTimer = window.setTimeout(() => {
    const fade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' })
    fade.onfinish = cleanupZoomOverlay
    fade.oncancel = cleanupZoomOverlay
  }, 760)
  zoomTimers.push(fadeTimer)
}

function cleanupZoomOverlay() {
  zoomTimers.forEach(timer => window.clearTimeout(timer))
  zoomTimers = []
  zoomOverlay?.remove()
  zoomOverlay = null
  opening.value = false
}

function previewItem(index) {
  if (previewIndex.value === index) return
  previewIndex.value = index
  if (index !== activeIndex.value) sound.morph()
}

function clearPreview(index) {
  if (previewIndex.value === index) previewIndex.value = null
}

function goChapter(index) {
  if (!track.value) return
  sound.morph()
  const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0
  const top = track.value.getBoundingClientRect().top + window.scrollY - headerHeight
  const travel = Math.max(0, track.value.offsetHeight - (stage.value?.clientHeight || window.innerHeight))
  const ratio = index === ITEM_COUNT - 1 ? 1 : (index + 0.08) / (ITEM_COUNT - 1)
  window.scrollTo({ top: top + travel * ratio, behavior: reducedMotion.value ? 'auto' : 'smooth' })
}

function resizeInkCanvas() {
  const canvas = inkCanvas.value
  if (!canvas) return
  const width = Math.max(1, stage.value?.clientWidth || window.innerWidth)
  const height = Math.max(1, stage.value?.clientHeight || window.innerHeight)
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile.value ? 1.25 : 1.5)
  const sizeCanvas = (target, canvasWidth, canvasHeight) => {
    target.width = Math.round(canvasWidth * dpr)
    target.height = Math.round(canvasHeight * dpr)
    const context = target.getContext('2d')
    context?.setTransform(dpr, 0, 0, dpr, 0, 0)
    return context
  }
  inkWidth = width
  inkHeight = height
  const sampleCard = stage.value?.querySelector('.chapter-card')
  stageCardWidth = sampleCard?.offsetWidth || Math.min(width * 0.38, 580)
  stageCardHeight = sampleCard?.offsetHeight || Math.min(height * 0.42, 460)
  inkContext = sizeCanvas(canvas, width, height)
  const front = inkFrontCanvas.value
  if (front) {
    inkFrontWidth = width
    inkFrontHeight = height
    inkFrontContext = sizeCanvas(front, width, height)
  } else {
    inkFrontContext = undefined
  }
  if (!inkSprites.length) inkSprites = createInkBrushSprites(isMobile.value ? 4 : 6, 128)
}

function drawInkCanvas(now) {
  if (!inkContext || !inkSprites.length) return
  const context = inkContext
  const delta = inkLastTime ? clamp((now - inkLastTime) / 1000, 0.001, 0.05) : 0.016
  inkLastTime = now
  const scrollSpeed = Math.min(0.8, Math.abs(progress.value - inkLastProgress) / delta)
  inkLastProgress = progress.value
  inkFlow += delta * (0.055 + scrollSpeed * 0.16)

  context.clearRect(0, 0, inkWidth, inkHeight)
  context.globalCompositeOperation = 'source-over'

  const centerX = inkWidth * 0.5
  const centerY = inkHeight * 0.49
  const radius = spiralRadius
  const row = spiralRow
  const sample = relative => {
    const angle = relative * Math.PI * 0.5
    return {
      x: centerX + Math.sin(angle) * radius,
      y: centerY + relative * row,
      depth: (Math.cos(angle) + 1) * 0.5
    }
  }

  context.beginPath()
  for (let index = 0; index <= 116; index += 1) {
    const d = -3.1 + index / 116 * 6.2
    const point = sample(d)
    if (index === 0) context.moveTo(point.x, point.y)
    else context.lineTo(point.x, point.y)
  }
  context.strokeStyle = 'rgba(238,240,238,0.055)'
  context.lineWidth = 34
  context.stroke()

  let previous = sample(-3.1)
  for (let index = 1; index <= 116; index += 1) {
    const d = -3.1 + index / 116 * 6.2
    const point = sample(d)
    const depth = point.depth
    context.beginPath()
    context.moveTo(previous.x, previous.y)
    context.lineTo(point.x, point.y)
    context.strokeStyle = `rgba(244,246,244,${(0.06 + depth * 0.3).toFixed(3)})`
    context.lineWidth = 1 + depth * 2.8
    context.stroke()
    previous = point
  }

  context.save()
  context.lineCap = 'round'
  for (let index = 0; index < 120; index += 1) {
    if (index % 11 < 2) continue
    const d = -3.1 + index / 120 * 6.2
    const point = sample(d)
    const tail = sample(d + 0.026)
    context.globalAlpha = 0.04 + point.depth * 0.12
    context.beginPath()
    context.moveTo(point.x, point.y)
    context.lineTo(tail.x, tail.y)
    context.strokeStyle = 'rgba(244,246,244,0.9)'
    context.lineWidth = 0.8 + point.depth * 2.1
    context.stroke()
  }
  context.restore()
  context.globalAlpha = 1

  const count = isMobile.value ? 26 : 68
  const bloomSprites = Math.min(3, inkSprites.length)
  for (let index = 0; index < count; index += 1) {
    const particle = inkParticles[index % inkParticles.length]
    const d = -2.9 + ((particle.seed * 5.8 + inkFlow * particle.speed) % 5.8)
    const fade = clamp(1 - Math.abs(d) / 3.1)
    if (fade <= 0.02) continue
    const brush = inkSprites[index % bloomSprites]
    for (let trail = 0; trail < 3; trail += 1) {
      const trailD = d - trail * 0.065 * particle.speed
      const point = sample(trailD)
      const depth = point.depth
      const wobble = Math.sin(now * 0.00036 * particle.sway + particle.seed * 19 + trail) * (4.5 + depth * 8)
      const size = (4 + particle.size * 11) * (0.55 + depth * 1.05) * (1 - trail * 0.18)
      const alpha = (0.12 + depth * 0.36) * fade * (1 - trail * 0.24)
      context.globalAlpha = alpha
      context.drawImage(
        brush,
        point.x + wobble - size,
        point.y - size + Math.cos(now * 0.00029 + particle.seed * 13) * 3.5,
        size * 2,
        size * 2
      )
    }
  }

  context.globalCompositeOperation = 'lighter'
  const washes = isMobile.value ? 2 : 4
  for (let index = 0; index < washes; index += 1) {
    const travel = (inkFlow * 0.016 + index / washes + progress.value * 0.18) % 1
    const d = -2.4 + travel * 4.8
    const point = sample(d)
    const size = (72 + point.depth * 72) * (isMobile.value ? 0.72 : 1)
    const brush = inkSprites[(index + 1) % inkSprites.length]
    context.globalAlpha = 0.22 + point.depth * 0.18
    context.drawImage(brush, point.x - size, point.y - size * 0.6, size * 2, size * 1.2)
  }

  context.globalCompositeOperation = 'multiply'
  for (let index = 0; index < 6; index += 1) {
    const travel = (index + 0.5) / 6
    const d = -2.8 + travel * 5.6
    const point = sample(d)
    const size = 34 + point.depth * 28
    context.globalAlpha = 0.05 + point.depth * 0.045
    context.drawImage(inkSprites[(index + 2) % inkSprites.length], point.x - size, point.y - size * 0.62, size * 2, size * 1.24)
  }
  context.globalAlpha = 1
  context.globalCompositeOperation = 'lighter'

  const comets = isMobile.value ? 2 : 3
  for (let index = 0; index < comets; index += 1) {
    const travel = (inkFlow * (0.11 + index * 0.018) + index / comets + progress.value * 0.32) % 1
    const d = -2.85 + travel * 5.7
    const envelope = Math.sin(travel * Math.PI)
    const point = sample(d)
    const depth = point.depth
    const cometBrush = inkSprites[(index + 3) % inkSprites.length]
    for (let trail = 0; trail < 7; trail += 1) {
      const tailPoint = sample(d - trail * 0.038)
      const size = (index === 0 ? 15 : 8) * (1 - trail * 0.1) * (0.7 + depth * 0.7)
      context.globalAlpha = envelope * (0.14 + depth * 0.26) * (1 - trail / 7)
      context.drawImage(cometBrush, tailPoint.x - size, tailPoint.y - size, size * 2, size * 2)
    }
    if (index === 0) {
      const glint = (2.2 + Math.sin(now * 0.0014) * 0.8) * (isMobile.value ? 0.7 : 1)
      context.globalAlpha = envelope * 0.4
      context.fillStyle = 'rgba(246,247,245,0.82)'
      context.beginPath()
      context.arc(point.x, point.y, glint, 0, Math.PI * 2)
      context.fill()
    }
  }

  if (inkFrontContext) {
    const front = inkFrontContext
    front.clearRect(0, 0, inkFrontWidth, inkFrontHeight)
    front.globalCompositeOperation = 'lighter'
    const cardLeft = (inkFrontWidth - stageCardWidth) * 0.5
    const cardTop = (inkFrontHeight - stageCardHeight) * 0.5
    const cardRight = cardLeft + stageCardWidth
    const cardBottom = cardTop + stageCardHeight
    front.beginPath()
    let drawing = false
    for (let index = 0; index <= 144; index += 1) {
      const d = -3.1 + index / 144 * 6.2
      const point = sample(d)
      const insideCard = point.x > cardLeft + 6 && point.x < cardRight - 6 && point.y > cardTop + 6 && point.y < cardBottom - 6
      if (insideCard) {
        drawing = false
        continue
      }
      if (!drawing) {
        front.moveTo(point.x, point.y)
        drawing = true
      } else {
        front.lineTo(point.x, point.y)
      }
    }
    front.setLineDash([2, 10])
    front.strokeStyle = 'rgba(245,247,245,0.035)'
    front.lineWidth = 10
    front.stroke()
    front.strokeStyle = 'rgba(245,247,245,0.24)'
    front.lineWidth = 1.2
    front.stroke()
    front.setLineDash([])
    const frontCount = isMobile.value ? 34 : 90
    for (let index = 0; index < frontCount; index += 1) {
      const particle = inkParticles[(index + 7) % inkParticles.length]
      const brush = inkSprites[(index + 1) % inkSprites.length]
      const drift = -1.55 + ((particle.seed * 3.1 + inkFlow * (0.14 + particle.speed * 0.08)) % 3.1)
      const point = sample(drift)
      const insideCard = point.x > cardLeft + 4 && point.x < cardRight - 4 && point.y > cardTop + 4 && point.y < cardBottom - 4
      const swayX = Math.sin(now * 0.00017 * particle.sway + particle.seed * 17) * (18 + particle.seed * 56)
      const swayY = Math.cos(now * 0.00021 + particle.seed * 11) * (12 + particle.seed * 32)
      const large = index % 4 === 0
      const size = (large ? 16 + particle.size * 30 : 3 + particle.size * 10) * (isMobile.value ? 0.68 : 1)
      const fade = insideCard ? 0.34 : 1
      front.globalAlpha = (large
        ? 0.07 + point.depth * 0.1
        : 0.14 + point.depth * 0.2 + particle.seed * 0.03) * fade
      front.drawImage(
        brush,
        point.x + swayX - size * 1.35,
        point.y + swayY - size * 0.82,
        size * 2.7,
        size * 1.64
      )
      const tail = sample(drift - 0.1 * particle.speed)
      front.globalAlpha *= 0.45
      front.drawImage(
        brush,
        tail.x + swayX * 0.7 - size * 0.8,
        tail.y + swayY * 0.7 - size * 0.5,
        size * 1.65,
        size
      )
      if (large) {
        front.globalAlpha *= 0.4
        front.drawImage(
          inkSprites[(index + 3) % inkSprites.length],
          point.x + swayX - size * 0.4,
          point.y + swayY - size * 1.5,
          size * 2,
          size * 1.6
        )
      }
    }
    front.globalAlpha = 1
    front.globalCompositeOperation = 'source-over'
  }

  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
}

function layoutChapters() {
  if (staticMode.value || !stage.value) return
  const cards = stage.value.querySelectorAll('.chapter-card')
  if (!cards.length) return
  const width = stage.value.clientWidth || 1
  const height = stage.value.clientHeight || 1
  const raw = progress.value * (ITEM_COUNT - 1)
  const base = Math.floor(raw)
  const local = raw - base
  const transition = easeInOut(clamp((local - 0.18) / 0.82))
  const position = Math.min(ITEM_COUNT - 1, base + transition)
  const mobile = isMobile.value
  const radius = mobile ? Math.min(width * 0.09, 42) : Math.min(width * 0.34, 500)
  const rowStep = mobile ? height * 0.34 : Math.min(height * 0.32, 300)
  const nextActive = Math.min(ITEM_COUNT - 1, Math.round(position))
  activeIndex.value = nextActive
  spiralRadius = mobile ? Math.min(width * 0.34, 130) : radius
  spiralRow = rowStep

  cards.forEach((button, index) => {
    const distance = index - position
    const absolute = Math.abs(distance)
    const angle = distance * Math.PI * 0.5
    const x = Math.sin(angle) * radius
    const y = distance * rowStep
    const scale = 1 - Math.min(absolute, 2) * (mobile ? 0.08 : 0.14)
    const rotateY = -Math.sin(angle) * (mobile ? 6 : 17)
    const rotateZ = mobile ? 0 : distance * 1.3
    const opacity = Math.max(0, 1 - absolute * 0.36)
    const hidden = mobile ? absolute > 0.58 : absolute > 1.75
    button.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${rotateZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`
    button.style.opacity = hidden ? '0' : opacity.toFixed(3)
    button.style.visibility = hidden ? 'hidden' : 'visible'
    button.style.pointerEvents = hidden ? 'none' : 'auto'
    button.style.zIndex = index === nextActive ? '20' : String(Math.max(2, 14 - Math.round(absolute * 4)))
    button.tabIndex = hidden ? -1 : 0
    button.setAttribute('aria-hidden', hidden ? 'true' : 'false')
    if (hidden && document.activeElement === button) button.blur()
  })
}

function makeLine(points, opacity = 0.3) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color: 0xf0f1ef,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  material.userData.baseOpacity = opacity
  return new THREE.Line(geometry, material)
}

function buildStars() {
  let seed = 41
  const random = () => {
    seed = seed * 16807 % 2147483647
    return (seed - 1) / 2147483646
  }
  const positions = []
  const colors = []
  for (let index = 0; index < 110; index += 1) {
    positions.push((random() - 0.5) * 17, (random() - 0.5) * 12, -2 - random() * 5)
    const light = 0.45 + random() * 0.55
    colors.push(light, light, light)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.03,
    vertexColors: true,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }))
}

function formGroup() {
  const group = new THREE.Group()
  group.userData.materials = []
  return group
}

function addFormLine(group, points, opacity = 0.35) {
  const line = makeLine(points, opacity)
  group.add(line)
  group.userData.materials.push(line.material)
  return line
}

function addFormRing(group, radius, opacity = 0.3, rotation = 0) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xf2f3f1,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  })
  material.userData.baseOpacity = opacity
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008, 4, 128), material)
  ring.rotation.x = rotation
  group.add(ring)
  group.userData.materials.push(material)
}

function buildForms() {
  const result = []

  const compass = formGroup()
  addFormRing(compass, 1.5, 0.34)
  addFormRing(compass, 1.15, 0.18, 0.8)
  addFormRing(compass, 0.62, 0.22, -0.65)
  for (let index = 0; index < 24; index += 1) {
    const angle = index / 24 * Math.PI * 2
    addFormLine(compass, [
      new THREE.Vector3(Math.sin(angle) * 1.3, Math.cos(angle) * 1.3, 0),
      new THREE.Vector3(Math.sin(angle) * 1.48, Math.cos(angle) * 1.48, 0)
    ], 0.16)
  }
  result.push(compass)

  const doubleHelix = formGroup()
  for (let strand = 0; strand < 2; strand += 1) {
    const points = []
    for (let index = 0; index <= 120; index += 1) {
      const value = index / 120
      const angle = value * Math.PI * 4 + strand * Math.PI
      points.push(new THREE.Vector3(Math.sin(angle) * 0.85, (value - 0.5) * 3.2, Math.cos(angle) * 0.85))
    }
    addFormLine(doubleHelix, points, strand ? 0.2 : 0.38)
  }
  result.push(doubleHelix)

  const constellation = formGroup()
  const constellationPoints = Array.from({ length: 13 }, (_, index) => new THREE.Vector3(
    Math.sin(index * 2.17) * (0.5 + index % 4 * 0.28),
    Math.cos(index * 1.73) * (0.45 + index % 3 * 0.38),
    (index % 3 - 1) * 0.28
  ))
  constellationPoints.forEach((position, index) => {
    const next = constellationPoints[(index + 3) % constellationPoints.length]
    addFormLine(constellation, [position, next], 0.2)
  })
  const starGeometry = new THREE.BufferGeometry().setFromPoints(constellationPoints)
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.075, transparent: true, opacity: 0.72, depthWrite: false })
  starMaterial.userData.baseOpacity = 0.72
  constellation.add(new THREE.Points(starGeometry, starMaterial))
  constellation.userData.materials.push(starMaterial)
  result.push(constellation)

  const pillars = formGroup()
  addFormRing(pillars, 1.62, 0.2, Math.PI / 2)
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.35, 2.15, 0.35))
    const material = new THREE.LineBasicMaterial({ color: 0xf0f1ef, transparent: true, opacity: 0.36, depthWrite: false })
    material.userData.baseOpacity = 0.36
    const pillar = new THREE.LineSegments(geometry, material)
    pillar.position.set(Math.sin(angle) * 1.1, 0, Math.cos(angle) * 1.1)
    pillars.add(pillar)
    pillars.userData.materials.push(material)
  }
  result.push(pillars)

  const hexagram = formGroup()
  for (let index = 0; index < 6; index += 1) {
    const y = (index - 2.5) * 0.42
    if (index % 2) {
      addFormLine(hexagram, [new THREE.Vector3(-1.4, y, 0), new THREE.Vector3(-0.2, y, 0)], 0.42)
      addFormLine(hexagram, [new THREE.Vector3(0.2, y, 0), new THREE.Vector3(1.4, y, 0)], 0.42)
    } else {
      addFormLine(hexagram, [new THREE.Vector3(-1.4, y, 0), new THREE.Vector3(1.4, y, 0)], 0.42)
    }
  }
  result.push(hexagram)

  const butterfly = formGroup()
  const wingPositions = []
  let seed = 73
  const random = () => {
    seed = seed * 16807 % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let index = 0; index < 90; index += 1) {
    const side = index % 2 ? 1 : -1
    const y = (random() - 0.5) * 2.2
    const wing = Math.sin((y + 1.1) / 2.2 * Math.PI)
    wingPositions.push(side * (0.12 + random() * 1.4 * wing), y, (random() - 0.5) * 0.7)
  }
  const wingGeometry = new THREE.BufferGeometry()
  wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wingPositions, 3))
  const wingMaterial = new THREE.PointsMaterial({ color: 0xf4f5f3, size: 0.045, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
  wingMaterial.userData.baseOpacity = 0.6
  butterfly.add(new THREE.Points(wingGeometry, wingMaterial))
  butterfly.userData.materials.push(wingMaterial)
  addFormLine(butterfly, [new THREE.Vector3(0, -0.8, 0), new THREE.Vector3(0, 0.85, 0)], 0.36)
  result.push(butterfly)

  result.forEach((group, index) => {
    group.position.set(0.4, 0, -2.2)
    group.scale.setScalar(1.34)
    group.visible = index === 0
    group.userData.materials.forEach(material => { material.opacity = 0 })
  })
  return result
}

function hasWebGLSupport() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

function initScene() {
  if (initialized || isMobile.value || !sceneHost.value) return
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-hidden', 'true')
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost)
  renderer.domElement.addEventListener('pointerdown', handleDragStart)
  sceneHost.value.appendChild(renderer.domElement)
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60)
  camera.position.set(0, 0, 17.2)
  world = new THREE.Group()
  scene.add(world)
  stars = buildStars()
  scene.add(stars)
  forms = buildForms()
  forms.forEach(form => world.add(form))
  initialized = true
  resizeScene()
}

function resizeScene() {
  if (!stage.value) return
  stageWidth = stage.value.clientWidth || 1
  stageHeight = stage.value.clientHeight || 1
  if (initialized && renderer && camera) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setSize(stageWidth, stageHeight, false)
    camera.aspect = stageWidth / stageHeight
    camera.updateProjectionMatrix()
    world.position.set(0, 2.9, 0)
    world.scale.setScalar(Math.min(1.08, stageHeight / 720))
  }
  resizeInkCanvas()
  layoutChapters()
}

function updateForms(now) {
  forms.forEach((form, index) => {
    const target = index === displayIndex.value ? 1 : 0
    formWeights[index] += (target - formWeights[index]) * 0.09
    const weight = formWeights[index]
    form.visible = weight > 0.008
    if (!form.visible) return
    const pulse = index === activeIndex.value ? 1 + Math.sin(now * 0.002) * 0.08 : 1
    form.rotation.y = now * 0.0002 * (index % 2 ? -1 : 1)
    form.rotation.x = Math.sin(now * 0.00017 + index) * 0.08
    form.userData.materials.forEach(material => {
      material.opacity = Math.min(1, material.userData.baseOpacity * weight * pulse * 1.18)
    })
  })
}

function renderFrame(now) {
  if (!running || !inView || staticMode.value) return
  drawInkCanvas(now)
  if (isMobile.value || !initialized) return
  if (!dragging) {
    dragPhase += dragVelocity
    dragVelocity *= 0.92
  }
  world.rotation.y = dragPhase + progress.value * 0.7
  world.rotation.x = Math.sin(now * 0.00018) * 0.05
  updateForms(now)
  stars.rotation.z = progress.value * 0.32 + now * 0.000025
  stars.rotation.y = progress.value * 0.22
  scene.updateMatrixWorld(true)
  renderer.render(scene, camera)
}

function syncMotion() {
  const shouldRun = running && inView && !staticMode.value
  if (shouldRun && !unsubscribeMotion) unsubscribeMotion = subscribeMotion(renderFrame)
  if (!shouldRun && unsubscribeMotion) {
    unsubscribeMotion()
    unsubscribeMotion = undefined
  }
}

function setProgress(value) {
  progress.value = clamp(value)
  layoutChapters()
}

function setupScrollTrigger() {
  if (scrollTrigger || !track.value || staticMode.value) return
  scrollTrigger = ScrollTrigger.create({
    trigger: track.value,
    start: () => `top ${getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim() || '88px'}`,
    end: 'bottom bottom',
    invalidateOnRefresh: true,
    onUpdate: self => setProgress(self.progress),
    onRefresh: self => setProgress(self.progress)
  })
  setProgress(scrollTrigger.progress)
}

function handleDragStart(event) {
  if (event.pointerType === 'touch') return
  dragging = true
  dragX = event.clientX
  dragVelocity = 0
  renderer?.domElement.setPointerCapture(event.pointerId)
  renderer?.domElement.addEventListener('pointermove', handleDragMove)
  renderer?.domElement.addEventListener('pointerup', handleDragEnd)
  renderer?.domElement.addEventListener('pointercancel', handleDragEnd)
}

function handleDragMove(event) {
  if (!dragging) return
  const delta = event.clientX - dragX
  dragX = event.clientX
  dragPhase += delta * 0.004
  dragVelocity = delta * 0.0007
}

function handleDragEnd() {
  dragging = false
  renderer?.domElement.removeEventListener('pointermove', handleDragMove)
  renderer?.domElement.removeEventListener('pointerup', handleDragEnd)
  renderer?.domElement.removeEventListener('pointercancel', handleDragEnd)
}

function handleContextLost(event) {
  event.preventDefault()
  failWebGL()
}

function disposeScene() {
  resizeObserver?.disconnect()
  resizeObserver = undefined
  if (renderer) {
    handleDragEnd()
    renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
    renderer.domElement.removeEventListener('pointerdown', handleDragStart)
  }
  if (scene) {
    const geometries = new Set()
    const materials = new Set()
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry)
      if (object.material) {
        const list = Array.isArray(object.material) ? object.material : [object.material]
        list.forEach(material => materials.add(material))
      }
    })
    geometries.forEach(geometry => geometry.dispose())
    materials.forEach(material => material.dispose())
    scene.clear()
  }
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = undefined
  scene = undefined
  camera = undefined
  world = undefined
  stars = undefined
  forms = []
  initialized = false
}

function failWebGL() {
  webglFailed.value = true
  running = false
  syncMotion()
  scrollTrigger?.kill()
  scrollTrigger = undefined
  disposeScene()
}

function handleViewportResize() {
  resizeScene()
  scrollTrigger?.refresh()
}

function start() {
  if (!activated || staticMode.value || running) return
  running = true
  if (!isMobile.value && initialized && sceneHost.value && !resizeObserver && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(resizeScene)
    resizeObserver.observe(sceneHost.value)
  }
  scrollTrigger?.enable()
  handleViewportResize()
  syncMotion()
}

function stop() {
  running = false
  syncMotion()
  scrollTrigger?.disable(false)
  resizeObserver?.disconnect()
  resizeObserver = undefined
}

async function initialize() {
  await nextTick()
  if (!activated || staticMode.value) return
  try {
    if (!isMobile.value) {
      if (!hasWebGLSupport()) {
        failWebGL()
        return
      }
      initScene()
    }
    setupScrollTrigger()
    resizeScene()
    start()
  } catch {
    failWebGL()
  }
}

async function handleMotionChange() {
  stop()
  cleanupZoomOverlay()
  reducedMotion.value = motionQuery.matches
  if (reducedMotion.value) {
    scrollTrigger?.kill()
    scrollTrigger = undefined
    disposeScene()
  } else {
    await initialize()
  }
}

async function handleMobileChange() {
  stop()
  isMobile.value = mobileQuery.matches
  scrollTrigger?.kill()
  scrollTrigger = undefined
  disposeScene()
  await initialize()
}

watch(staticMode, value => {
  if (value) {
    cleanupZoomOverlay()
    inkContext = undefined
    inkFrontContext = undefined
  } else {
    nextTick(() => {
      resizeInkCanvas()
      layoutChapters()
    })
  }
})

onMounted(() => {
  activated = true
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  mobileQuery = window.matchMedia('(max-width: 760px)')
  reducedMotion.value = motionQuery.matches
  isMobile.value = mobileQuery.matches
  motionQuery.addEventListener('change', handleMotionChange)
  mobileQuery.addEventListener('change', handleMobileChange)
  window.addEventListener('resize', handleViewportResize, { passive: true })
  intersectionObserver = new IntersectionObserver(entries => {
    inView = entries[0]?.isIntersecting ?? false
    syncMotion()
  }, { rootMargin: '120px 0px' })
  if (track.value) intersectionObserver.observe(track.value)
  initialize()
})

onActivated(() => {
  activated = true
  start()
  nextTick(() => {
    resizeInkCanvas()
    layoutChapters()
  })
})

onDeactivated(() => {
  activated = false
  stop()
})

onBeforeUnmount(() => {
  activated = false
  stop()
  cleanupZoomOverlay()
  inkContext = undefined
  inkFrontContext = undefined
  inkSprites = []
  intersectionObserver?.disconnect()
  motionQuery?.removeEventListener('change', handleMotionChange)
  mobileQuery?.removeEventListener('change', handleMobileChange)
  window.removeEventListener('resize', handleViewportResize)
  scrollTrigger?.kill()
  scrollTrigger = undefined
  disposeScene()
})
</script>

<template>
  <section ref="root" class="spiral-journey" :class="{ 'is-static': staticMode, 'is-mobile': isMobile, 'is-opening': opening }" :aria-busy="opening" aria-labelledby="journey-title">
    <template v-if="!staticMode">
      <div class="journey-intro">
        <div class="intro-inner">
          <p>星轨 / CELESTIAL INDEX · {{ String(items.length).padStart(2, '0') }}</p>
          <h2 id="journey-title">七章命轨，<br>皆为你所行。</h2>
          <span>向下滚动，沿银墨螺旋逐章靠近。当前章节停驻于中心，点选卡片即可抵达。</span>
          <i aria-hidden="true"></i>
        </div>
      </div>
      <div ref="track" class="journey-track">
        <div ref="stage" class="journey-stage">
          <div v-if="!isMobile" ref="sceneHost" class="scene-host" aria-hidden="true"></div>
          <canvas ref="inkCanvas" class="ink-spiral" aria-hidden="true"></canvas>
          <div class="compass-halo" aria-hidden="true">
            <svg viewBox="0 0 800 800" focusable="false">
              <g class="compass-halo-outer">
                <circle cx="400" cy="400" r="372" />
                <circle cx="400" cy="400" r="356" stroke-dasharray="1 14" />
                <circle cx="400" cy="400" r="286" />
                <line
                  v-for="tick in 60"
                  :key="tick"
                  x1="400"
                  y1="26"
                  x2="400"
                  :y2="tick % 5 === 0 ? 58 : 40"
                  :transform="`rotate(${tick * 6} 400 400)`"
                />
              </g>
              <g class="compass-halo-inner">
                <circle cx="400" cy="400" r="206" stroke-dasharray="48 12 8 12" />
                <circle cx="400" cy="400" r="128" />
                <path d="M400 148 L424 376 L400 400 L376 376 Z" />
                <path d="M400 652 L376 424 L400 400 L424 424 Z" opacity=".55" />
                <line x1="122" y1="400" x2="678" y2="400" opacity=".4" />
              </g>
            </svg>
          </div>
          <div class="stage-vignette" aria-hidden="true"></div>

          <nav class="chapter-deck" aria-label="七项星轨功能">
            <a
              v-for="(item, index) in items"
              :key="item.key"
              class="star-tab chapter-card"
              :class="{ active: index === activeIndex, preview: index === displayIndex }"
              :href="item.path"
              :aria-current="index === activeIndex ? 'step' : undefined"
              :aria-label="`打开${item.label}：${item.title}。${item.concept}`"
              @click.prevent="openItem(item, $event)"
              @pointerenter="previewItem(index)"
              @pointerleave="clearPreview(index)"
              @focus="previewItem(index)"
              @blur="clearPreview(index)"
            >
              <span class="chapter-card-top">
                <span class="chapter-code">{{ item.chapter }}</span>
                <span class="chapter-station"><i aria-hidden="true"></i>STATION / {{ String(index + 1).padStart(2, '0') }}</span>
              </span>
              <ChapterInstrument :type="item.key" :data="item.instrument" :active="index === activeIndex" />
              <span class="chapter-body">
                <span class="chapter-lead">
                  <span class="chapter-name">{{ item.label }}</span>
                  <span class="chapter-title">{{ item.title }}</span>
                  <span class="chapter-concept">{{ item.concept }}</span>
                  <span class="chapter-live">{{ item.description }}</span>
                </span>
                <span class="chapter-side">
                  <span class="chapter-metrics">
                    <span v-for="metric in item.metrics" :key="metric.label" class="chapter-metric">
                      <span class="chapter-metric-key">{{ metric.label }}</span>
                      <span class="chapter-metric-value">{{ metric.value }}</span>
                    </span>
                  </span>
                  <span class="chapter-enter">
                    <span>展开此章</span>
                    <span class="chapter-arrow" aria-hidden="true">↗</span>
                  </span>
                </span>
              </span>
              <span class="chapter-ghost" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
            </a>
          </nav>

          <canvas ref="inkFrontCanvas" class="ink-spiral ink-spiral-front" aria-hidden="true"></canvas>

          <nav class="chapter-jump" aria-label="星轨站点">
            <button
              v-for="(item, index) in items"
              :key="item.key"
              type="button"
              :class="{ active: index === activeIndex }"
              :aria-current="index === activeIndex ? 'true' : undefined"
              @click="goChapter(index)"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>{{ item.label }}
            </button>
          </nav>

          <div class="journey-progress">
            <span class="progress-label">星轨 / STAR RAIL</span>
            <div class="progress-track" role="progressbar" aria-label="星轨滚动进度" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="progressPercent"><i :style="{ transform: `scaleX(${progress})` }"></i></div>
            <span class="progress-count">{{ String(activeIndex + 1).padStart(2, '0') }} — {{ String(ITEM_COUNT).padStart(2, '0') }}</span>
          </div>
        </div>
      </div>
      <div class="journey-breath" aria-hidden="true"><span>疏可走马，密不透风。</span></div>
    </template>

    <div v-else class="static-journey">
      <header class="static-heading">
        <p>星轨 / CELESTIAL INDEX · {{ String(items.length).padStart(2, '0') }}</p>
        <h2 id="journey-title">七章星轨</h2>
        <span>{{ webglFailed ? 'WebGL 暂不可用，星图已静态展开。' : '已依减少动态效果偏好静态展开。' }}</span>
      </header>
      <div class="static-grid">
        <a
          v-for="(item, index) in items"
          :key="item.key"
          class="star-tab chapter-card static-card"
          :href="item.path"
          :aria-label="`打开${item.label}：${item.title}。${item.concept}`"
          @click.prevent="openItem(item, $event)"
        >
          <span class="chapter-card-top">
            <span class="chapter-code">{{ item.chapter }}</span>
            <span class="chapter-station"><i aria-hidden="true"></i>STATION / {{ String(index + 1).padStart(2, '0') }}</span>
          </span>
          <ChapterInstrument :type="item.key" :data="item.instrument" :active="false" />
          <span class="chapter-body">
            <span class="chapter-lead">
              <span class="chapter-name">{{ item.label }}</span>
              <span class="chapter-title">{{ item.title }}</span>
              <span class="chapter-concept">{{ item.concept }}</span>
              <span class="chapter-live">{{ item.description }}</span>
            </span>
            <span class="chapter-side">
              <span class="chapter-metrics">
                <span v-for="metric in item.metrics" :key="metric.label" class="chapter-metric">
                  <span class="chapter-metric-key">{{ metric.label }}</span>
                  <span class="chapter-metric-value">{{ metric.value }}</span>
                </span>
              </span>
              <span class="chapter-enter">
                <span>展开此章</span>
                <span class="chapter-arrow" aria-hidden="true">↗</span>
              </span>
            </span>
          </span>
          <span class="chapter-ghost" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.spiral-journey { position: relative; width: 100%; color: var(--glow); }
.journey-intro { position: relative; height: 120vh; }
.intro-inner { position: sticky; top: var(--header-h); display: flex; height: calc(100svh - var(--header-h)); min-height: min(600px, calc(100svh - var(--header-h))); padding: 10vh clamp(28px, 7vw, 120px); flex-direction: column; justify-content: center; overflow: hidden; }
.intro-inner > p { color: var(--muted); font-size: 10px; letter-spacing: 0.22em; }
.intro-inner h2 { margin-top: 24px; font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: clamp(42px, 6vw, 88px); font-weight: 400; letter-spacing: 0.08em; line-height: 1.25; }
.intro-inner > span { max-width: 38em; margin-top: 28px; color: var(--silver); font-size: 13px; line-height: 1.9; }
.intro-inner i { width: 1px; height: 70px; margin-top: 38px; background: linear-gradient(var(--silver), transparent); }
.journey-track { position: relative; height: 400vh; }
.journey-stage { position: sticky; top: var(--header-h); width: 100%; height: calc(100svh - var(--header-h)); min-height: min(620px, calc(100svh - var(--header-h))); overflow: hidden; }
.scene-host { position: absolute; inset: 0; z-index: 0; }
.scene-host :deep(canvas) { display: block; width: 100%; height: 100%; touch-action: pan-y; cursor: grab; }
.scene-host :deep(canvas:active) { cursor: grabbing; }
.ink-spiral { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; mix-blend-mode: screen; pointer-events: none; }
.ink-spiral-front { z-index: 6; opacity: 0.78; }
.compass-halo {
  position: absolute;
  z-index: 2;
  top: 47%;
  left: 50%;
  width: min(62vw, 840px);
  aspect-ratio: 1;
  color: var(--glow);
  opacity: 0.1;
  pointer-events: none;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 0 10px oklch(0.97 0 0 / 0.12));
}
.compass-halo svg { display: block; width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 0.75; }
.compass-halo-outer,
.compass-halo-inner { transform-box: fill-box; transform-origin: center; }
.compass-halo-outer { animation: halo-turn 80s linear infinite; }
.compass-halo-inner { animation: halo-turn 55s linear infinite reverse; }
.stage-vignette { position: absolute; inset: 0; z-index: 3; background: radial-gradient(ellipse at 50% 48%, transparent 30%, oklch(0.05 0 0 / 0.38) 76%, var(--void) 100%); pointer-events: none; }
.chapter-deck { position: absolute; inset: 0; z-index: 4; perspective: 1400px; pointer-events: none; transform-style: preserve-3d; }
.chapter-card {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  width: clamp(430px, 38vw, 580px);
  height: clamp(370px, 42svh, 460px);
  padding: clamp(22px, 2.4vw, 32px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid oklch(0.72 0 0 / 0.34);
  background:
    radial-gradient(circle at 84% 4%, oklch(0.97 0 0 / 0.07), transparent 38%),
    linear-gradient(148deg, oklch(0.13 0 0 / 0.975), oklch(0.045 0 0 / 0.992) 70%);
  box-shadow: inset 0 1px oklch(0.97 0 0 / 0.09), 0 30px 100px oklch(0 0 0 / 0.62);
  color: var(--glow);
  cursor: pointer;
  opacity: 0;
  pointer-events: auto;
  text-align: left;
  text-decoration: none;
  transform: translate(-50%, -50%);
  transform-origin: center;
  transform-style: preserve-3d;
  transition: border-color 240ms ease, box-shadow 320ms ease;
  will-change: transform, opacity;
}
.chapter-card::before {
  position: absolute;
  inset: -30%;
  background: radial-gradient(circle at 30% 42%, oklch(0.97 0 0 / 0.05), transparent 48%);
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 500ms ease;
}
.chapter-card::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, oklch(0.97 0 0 / 0.35), transparent);
  content: '';
  opacity: 0.28;
}
.chapter-card:hover {
  border-color: oklch(0.97 0 0 / 0.68);
  box-shadow: inset 0 1px oklch(0.97 0 0 / 0.16), 0 0 46px oklch(0.97 0 0 / 0.06), 0 32px 104px oklch(0 0 0 / 0.68);
}
.chapter-card:focus-visible {
  border-color: var(--glow);
  outline: 2px solid oklch(0.97 0 0 / 0.55);
  outline-offset: -7px;
}
.chapter-card:hover::before,
.chapter-card:focus-visible::before,
.chapter-card.preview::before { opacity: 1; }
.chapter-card.active {
  border-color: oklch(0.72 0 0 / 0.66);
  box-shadow: inset 0 1px oklch(0.97 0 0 / 0.18), 0 0 84px oklch(0.97 0 0 / 0.065), 0 35px 110px oklch(0 0 0 / 0.74);
}
.chapter-card.active::before { animation: chapter-breathe 6s ease-in-out infinite; }
.chapter-card.preview .chapter-title { text-shadow: 0 0 34px oklch(0.97 0 0 / 0.16); }
.chapter-card.preview .chapter-name::before { box-shadow: 0 0 12px oklch(0.97 0 0 / 0.55); }
.chapter-card.active .chapter-station i { animation: station-pulse 2.6s ease-in-out infinite; }
.chapter-card-top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 20px; color: var(--muted); font-size: 10px; letter-spacing: 0.18em; }
.chapter-station { display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.chapter-station i { width: 5px; height: 5px; border: 1px solid var(--silver); background: var(--glow); box-shadow: 0 0 8px oklch(0.97 0 0 / 0.7); }
.chapter-body { position: relative; z-index: 1; display: flex; min-height: 0; margin-top: clamp(12px, 2vh, 20px); flex: 1; flex-direction: column; }
.chapter-lead { display: flex; min-width: 0; flex-direction: column; }
.chapter-card.active .chapter-lead,
.static-card .chapter-lead { max-width: 60%; }
.chapter-name { display: inline-flex; align-items: center; gap: 9px; color: var(--silver); font-size: 12px; letter-spacing: 0.24em; }
.chapter-name::before { width: 16px; height: 1px; flex: 0 0 16px; background: var(--silver); content: ''; }
.chapter-title { margin-top: 9px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: clamp(36px, 3.4vw, 52px); font-weight: 400; letter-spacing: 0.055em; line-height: 1.06; overflow-wrap: anywhere; }
.chapter-concept { display: -webkit-box; max-width: 30em; margin-top: 11px; overflow: hidden; color: var(--silver); font-size: clamp(12px, 0.92vw, 13.5px); line-height: 1.75; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow-wrap: anywhere; }
.chapter-live { display: -webkit-box; max-width: 34em; margin-top: 8px; padding-left: 10px; overflow: hidden; border-left: 1px solid var(--line-strong); color: var(--muted); font-size: 12px; line-height: 1.65; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
.chapter-side { display: flex; min-width: 0; margin-top: auto; padding-top: 11px; align-items: flex-end; justify-content: space-between; gap: 14px; border-top: 1px solid var(--line); }
.chapter-metrics { display: flex; min-width: 0; flex: 1; flex-wrap: wrap; gap: 8px 18px; }
.chapter-metric { display: flex; min-width: 0; flex: 0 1 auto; flex-direction: column; gap: 2px; }
.chapter-metric-key { color: var(--muted); font-size: 10px; letter-spacing: 0.1em; }
.chapter-metric-value { color: var(--glow); font-size: clamp(12px, 0.95vw, 15px); font-weight: 300; font-variant-numeric: tabular-nums; line-height: 1.3; overflow-wrap: anywhere; }
.chapter-enter { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 10px; color: var(--silver); font-size: 12px; letter-spacing: 0.1em; }
.chapter-arrow { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; border: 1px solid var(--line-strong); border-radius: 50%; color: var(--glow); font-size: 13px; transition: background-color 220ms ease, border-color 220ms ease, transform 220ms ease; }
.chapter-card:hover .chapter-arrow,
.chapter-card:focus-visible .chapter-arrow { border-color: var(--glow); background: oklch(0.97 0 0 / 0.1); transform: translate(2px, -2px); }
.chapter-card:not(.active):not(.static-card) .chapter-title,
.chapter-card:not(.active):not(.static-card) .chapter-concept,
.chapter-card:not(.active):not(.static-card) .chapter-live,
.chapter-card:not(.active):not(.static-card) .chapter-side { display: none; }
.chapter-card:not(.active):not(.static-card) .chapter-lead { flex: 1; justify-content: center; }
.chapter-card:not(.active):not(.static-card) .chapter-name { color: var(--glow); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: clamp(22px, 2.2vw, 32px); letter-spacing: 0.18em; }
.chapter-card:not(.active):not(.static-card) .chapter-name::before { width: 24px; flex-basis: 24px; }
.chapter-card.static-card .chapter-live { display: -webkit-box; }
.chapter-card.static-card .chapter-side { display: flex; }
.chapter-card.static-card .chapter-lead { flex: 0 1 auto; justify-content: flex-start; }
.chapter-card.static-card .chapter-concept { opacity: 1; }
.chapter-card.static-card .chapter-title { color: var(--glow); }
.chapter-ghost { position: absolute; z-index: 0; right: clamp(10px, 1.6vw, 24px); bottom: clamp(2px, 0.8vh, 12px); color: transparent; font-family: 'DM Sans', ui-sans-serif, sans-serif; font-size: clamp(94px, 9vw, 150px); font-weight: 300; letter-spacing: -0.08em; line-height: 0.72; opacity: 0.6; pointer-events: none; -webkit-text-stroke: 1px oklch(0.97 0 0 / 0.035); }
.chapter-jump { position: absolute; z-index: 7; bottom: 44px; left: 50%; display: flex; gap: 4px; transform: translateX(-50%); }
.chapter-jump::before { position: absolute; top: 8px; right: 18px; left: 18px; height: 1px; background: linear-gradient(90deg, transparent, var(--line-strong), transparent); content: ''; }
.chapter-jump button { position: relative; display: inline-flex; min-height: 44px; padding: 17px 9px 4px; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--muted); cursor: pointer; font-size: 12px; letter-spacing: 0.06em; white-space: nowrap; transition: color 180ms ease; }
.chapter-jump button span { color: var(--mist); font-size: 11px; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.chapter-jump button::before { position: absolute; z-index: 1; top: 5px; left: 50%; width: 6px; height: 6px; border: 1px solid var(--mist); background: var(--void); content: ''; transform: translateX(-50%) rotate(45deg); transition: background-color 180ms ease, border-color 180ms ease, box-shadow 220ms ease; }
.chapter-jump button::after { position: absolute; right: 9px; bottom: 1px; left: 9px; height: 1px; background: var(--glow); content: ''; opacity: 0; transform: scaleX(0.4); transition: opacity 180ms ease, transform 180ms ease; }
.chapter-jump button:hover { color: var(--silver); }
.chapter-jump button.active { color: var(--glow); }
.chapter-jump button.active span { color: var(--silver); }
.chapter-jump button.active::before { border-color: var(--glow); background: var(--glow); box-shadow: 0 0 10px oklch(0.97 0 0 / 0.6); }
.chapter-jump button.active::after { opacity: 0.35; transform: scaleX(1); }
.journey-progress { position: absolute; z-index: 7; right: clamp(28px, 6vw, 100px); bottom: 22px; left: clamp(28px, 6vw, 100px); display: grid; grid-template-columns: auto minmax(80px, 1fr) auto; align-items: center; gap: 20px; color: var(--muted); font-size: 12px; letter-spacing: 0.1em; font-variant-numeric: tabular-nums; }
.progress-track { height: 1px; background: var(--line); }
.progress-track i { display: block; width: 100%; height: 100%; background: var(--silver); transform-origin: left; }
.progress-count { color: var(--silver); }
.journey-breath { display: grid; height: 40vh; place-items: center; color: var(--muted); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 13px; letter-spacing: 0.24em; }
.static-journey { width: min(100%, 1320px); margin: 0 auto; padding: 90px clamp(20px, 6vw, 88px) 80px; }
.static-heading { padding-bottom: 38px; border-bottom: 1px solid var(--line); }
.static-heading > p { color: var(--muted); font-size: 10px; letter-spacing: 0.2em; }
.static-heading h2 { margin-top: 14px; font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: clamp(38px, 5vw, 66px); font-weight: 400; letter-spacing: 0.12em; }
.static-heading > span { display: block; margin-top: 16px; color: var(--muted); font-size: 12px; }
.static-grid { display: grid; margin-top: 26px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.static-card { position: relative; top: auto; left: auto; width: 100%; height: clamp(460px, 54svh, 620px); opacity: 1; transform: none; }
.static-card .chapter-title { font-size: clamp(40px, 3.8vw, 62px); }
.static-card .chapter-concept { font-size: 13px; }
.static-card .chapter-enter { display: none; }
@keyframes chapter-breathe {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
}
@keyframes station-pulse {
  0%, 100% { opacity: 0.62; box-shadow: 0 0 5px oklch(0.97 0 0 / 0.38); }
  50% { opacity: 1; box-shadow: 0 0 15px oklch(0.97 0 0 / 0.8); }
}
@keyframes halo-turn {
  to { transform: rotate(360deg); }
}
@media (max-width: 1120px) {
  .compass-halo { width: 70vw; }
  .chapter-card { width: clamp(400px, 44vw, 520px); height: clamp(360px, 42svh, 440px); padding: 22px; }
  .chapter-title { font-size: clamp(34px, 3.8vw, 46px); }
}
@media (max-width: 940px) {
  .compass-halo { width: 82vw; opacity: 0.09; }
  .chapter-card { width: clamp(380px, 52vw, 520px); }
}
@media (max-width: 760px) {
  .journey-intro { height: 100vh; }
  .intro-inner { padding: 8vh 24px; }
  .intro-inner h2 { font-size: clamp(38px, 12vw, 54px); }
  .journey-track { height: 440vh; }
  .journey-stage { min-height: 0; }
  .chapter-card { left: 50%; width: calc(100vw - 36px); height: clamp(390px, 54svh, 470px); padding: 18px 16px; transform: translate(-50%, -50%); }
  .chapter-card-top { gap: 10px; font-size: 10px; letter-spacing: 0.12em; }
  .chapter-station { gap: 6px; }
  .chapter-body { margin-top: 11px; overflow: hidden; }
  .chapter-name { gap: 8px; font-size: 12px; letter-spacing: 0.18em; }
  .chapter-name::before { width: 13px; flex-basis: 13px; }
  .chapter-card:not(.active):not(.static-card) .chapter-name { font-size: 24px; }
  .chapter-card.active .chapter-lead,
  .static-card .chapter-lead { max-width: 60%; }
  .chapter-title { margin-top: 7px; font-size: clamp(35px, 10.5vw, 47px); }
  .chapter-concept { max-width: none; margin-top: 8px; font-size: 12px; line-height: 1.68; -webkit-line-clamp: 3; }
  .chapter-live { margin-top: 6px; font-size: 12px; line-height: 1.55; -webkit-line-clamp: 2; }
  .chapter-side { padding-top: 8px; gap: 8px; }
  .chapter-metrics { gap: 6px 12px; }
  .chapter-metric-key { font-size: 10px; letter-spacing: 0.06em; }
  .chapter-metric-value { font-size: 12px; line-height: 1.25; }
  .chapter-enter { width: 34px; height: 34px; gap: 0; font-size: 0; }
  .chapter-arrow { width: 34px; height: 34px; flex-basis: 34px; }
  .chapter-ghost { right: 9px; bottom: 5px; font-size: 96px; }
  .compass-halo { top: 48%; width: 132vw; opacity: 0.08; }
  .chapter-jump { bottom: 38px; width: 100%; padding-inline: 8px; justify-content: center; gap: 0; }
  .chapter-jump button { min-height: 44px; padding: 15px 3px 2px; gap: 3px; font-size: 12px; }
  .chapter-jump button span { font-size: 11px; }
  .chapter-jump button::after { right: 4px; left: 4px; }
  .journey-progress { right: 18px; bottom: 12px; left: 18px; grid-template-columns: 1fr auto; gap: 12px; }
  .progress-label { display: none; }
  .static-journey { padding-top: 60px; }
  .static-grid { grid-template-columns: 1fr; }
  .static-card { top: auto; left: auto; width: 100%; height: auto; min-height: 500px; padding: 24px 20px; transform: none; }
  .static-card .chapter-title { font-size: clamp(36px, 10.5vw, 52px); }
  .static-card .chapter-concept { display: block; overflow: visible; -webkit-line-clamp: unset; }
  .static-card .chapter-enter { display: none; }
}
@media (max-width: 390px) {
  .chapter-card { width: calc(100vw - 24px); height: clamp(380px, 53svh, 450px); padding: 16px 14px; }
  .chapter-title { font-size: 34px; }
  .chapter-concept { font-size: 11.5px; line-height: 1.62; }
  .chapter-live { font-size: 9.5px; }
  .chapter-metric-value { font-size: 11px; }
  .chapter-ghost { font-size: 82px; }
}
@media (prefers-reduced-motion: reduce) {
  .chapter-card { will-change: auto; transition: none; }
  .chapter-card.active::before { animation: none; opacity: 1; }
  .chapter-card.active .chapter-station i { animation: none; }
  .compass-halo-outer,
  .compass-halo-inner { animation: none; }
}
</style>
