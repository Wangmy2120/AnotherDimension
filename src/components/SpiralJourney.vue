<script setup>
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps({ items: { type: Array, required: true } })
const emit = defineEmits(['open'])

const root = ref(null)
const sceneHost = ref(null)
const activeIndex = ref(0)
const progress = ref(0)
const reducedMotion = ref(false)
const webglFailed = ref(false)
const activeItem = computed(() => props.items[activeIndex.value] || props.items[0])
const staticMode = computed(() => reducedMotion.value || webglFailed.value)
const progressPercent = computed(() => Math.round(progress.value * 100))

const ITEM_COUNT = 6
const SPAN = 7.8
const TOTAL_ANGLE = Math.PI * 3.5
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

let renderer
let scene
let camera
let world
let compass
let helix
let stars
let scrollTrigger
let resizeObserver
let motionQuery
let initialized = false
let activated = false
let running = false
let nodeEntries = []
let hitTargets = []
let compassMaterials = []
let helixMaterials = []

function openItem(item) {
  if (item) emit('open', item.key)
}

function helixPoint(value, phase = 0) {
  const angle = value * TOTAL_ANGLE + phase
  const radius = 1.58 + Math.sin(value * Math.PI) * 0.18
  return new THREE.Vector3(
    Math.sin(angle) * radius,
    (value - 0.5) * SPAN,
    Math.cos(angle) * radius
  )
}

function makeLine(points, opacity, color = 0xe8edf2) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  })
  return new THREE.Line(geometry, material)
}

function buildCompass() {
  const group = new THREE.Group()
  const materials = []
  ;[2.38, 1.92, 0.72].forEach((radius, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: index === 0 ? 0xf1f3f5 : 0xaeb6bf,
      transparent: true,
      opacity: [0.38, 0.17, 0.2][index],
      depthWrite: false
    })
    material.userData.baseOpacity = material.opacity
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 4, 192), material)
    group.add(ring)
    materials.push(material)
  })

  const major = []
  const minor = []
  for (let index = 0; index < 96; index += 1) {
    const angle = index / 96 * Math.PI * 2
    const inner = index % 8 === 0 ? 2.08 : 2.25
    const target = index % 8 === 0 ? major : minor
    target.push(
      Math.sin(angle) * inner, Math.cos(angle) * inner, 0,
      Math.sin(angle) * 2.37, Math.cos(angle) * 2.37, 0
    )
  }
  ;[[major, 0.42], [minor, 0.16]].forEach(([positions, opacity]) => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const material = new THREE.LineBasicMaterial({ color: 0xe8edf2, transparent: true, opacity, depthWrite: false })
    material.userData.baseOpacity = opacity
    group.add(new THREE.LineSegments(geometry, material))
    materials.push(material)
  })

  const horizontal = makeLine([new THREE.Vector3(-2.7, 0, 0), new THREE.Vector3(2.7, 0, 0)], 0.12)
  const vertical = makeLine([new THREE.Vector3(0, -2.7, 0), new THREE.Vector3(0, 2.7, 0)], 0.12)
  horizontal.material.userData.baseOpacity = 0.12
  vertical.material.userData.baseOpacity = 0.12
  group.add(horizontal, vertical)
  materials.push(horizontal.material, vertical.material)
  compassMaterials = materials
  return group
}

function buildHelix() {
  const group = new THREE.Group()
  helixMaterials = []
  ;[0, Math.PI].forEach((phase, index) => {
    const points = []
    for (let step = 0; step <= 420; step += 1) points.push(helixPoint(step / 420, phase))
    const line = makeLine(points, index === 0 ? 0.4 : 0.24, index === 0 ? 0xf0f2f4 : 0xabb3bc)
    line.material.userData.baseOpacity = line.material.opacity
    group.add(line)
    helixMaterials.push(line.material)
  })

  const axis = makeLine([
    new THREE.Vector3(0, -SPAN * 0.57, 0),
    new THREE.Vector3(0, SPAN * 0.57, 0)
  ], 0.15, 0xb9c0c8)
  group.add(axis)

  const tickPositions = []
  for (let index = 0; index <= 42; index += 1) {
    const y = (index / 42 - 0.5) * SPAN
    const width = index % 7 === 0 ? 0.13 : 0.055
    tickPositions.push(-width, y, 0, width, y, 0)
  }
  const ticksGeometry = new THREE.BufferGeometry()
  ticksGeometry.setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3))
  group.add(new THREE.LineSegments(ticksGeometry, new THREE.LineBasicMaterial({
    color: 0xd8dde2,
    transparent: true,
    opacity: 0.18,
    depthWrite: false
  })))

  nodeEntries = []
  hitTargets = []
  for (let index = 0; index < ITEM_COUNT; index += 1) {
    const value = index / (ITEM_COUNT - 1)
    const position = helixPoint(value)
    const node = new THREE.Group()
    node.position.copy(position)

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xf4f5f6,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide
    })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.011, 6, 56), ringMaterial)
    node.add(ring)

    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xe8ecf0, transparent: true, opacity: 0.5, depthWrite: false })
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), coreMaterial)
    node.add(core)

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.36, 10, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    )
    hit.userData.key = props.items[index]?.key
    node.add(hit)
    hitTargets.push(hit)
    group.add(node)

    const arm = makeLine([new THREE.Vector3(0, position.y, 0), position], 0.13, 0xc6cdd4)
    group.add(arm)
    nodeEntries.push({ node, ringMaterial, coreMaterial, armMaterial: arm.material })
  }
  return group
}

function buildStars() {
  let seed = 41
  const random = () => {
    seed = seed * 16807 % 2147483647
    return (seed - 1) / 2147483646
  }
  const positions = []
  for (let index = 0; index < 86; index += 1) {
    positions.push((random() - 0.5) * 15, (random() - 0.5) * 10, -1.5 - random() * 5)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xdde3e9,
    size: 0.022,
    transparent: true,
    opacity: 0.38,
    depthWrite: false
  }))
}

function initScene() {
  if (initialized || !sceneHost.value) return
  const host = sceneHost.value
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-hidden', 'true')
  renderer.domElement.addEventListener('click', handleCanvasClick)
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost)
  host.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60)
  camera.position.set(0, 0, 10.5)
  world = new THREE.Group()
  scene.add(world)
  stars = buildStars()
  scene.add(stars)
  compass = buildCompass()
  helix = buildHelix()
  world.add(compass, helix)
  initialized = true
  resizeScene()
  renderScene()
}

function resizeScene() {
  if (!initialized || !renderer || !camera || !sceneHost.value) return
  const width = sceneHost.value.clientWidth
  const height = sceneHost.value.clientHeight
  if (!width || !height) return
  const compact = window.innerWidth <= 760
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.35 : 1.75))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  world.position.set(compact ? 0 : 1.45, 0, 0)
  world.scale.setScalar(compact ? 0.72 : Math.min(1, height / 760))
  renderScene()
}

function renderScene() {
  if (!initialized || !renderer || !scene || !camera || staticMode.value) return
  const value = THREE.MathUtils.clamp(progress.value, 0, 1)
  const travel = value
  const reveal = THREE.MathUtils.smoothstep(value, 0, 0.2)

  compass.rotation.set(reveal * 1.18, value * 0.72, value * 0.2)
  compass.scale.setScalar(1 + reveal * 0.24)
  compassMaterials.forEach(material => {
    material.opacity = material.userData.baseOpacity * (1 - reveal)
  })

  helix.position.y = (0.5 - travel) * SPAN
  helix.rotation.x = (1 - reveal) * 1.12
  helix.rotation.y = -travel * TOTAL_ANGLE + (1 - reveal) * 0.18
  helix.rotation.z = (1 - reveal) * -0.12 + Math.sin(value * Math.PI) * 0.035
  helixMaterials.forEach(material => {
    material.opacity = material.userData.baseOpacity * (0.24 + reveal * 0.76)
  })

  nodeEntries.forEach((entry, index) => {
    const current = index === activeIndex.value
    entry.node.scale.setScalar(current ? 1.32 : 1)
    entry.ringMaterial.opacity = current ? 0.96 : 0.25 + reveal * 0.12
    entry.coreMaterial.opacity = current ? 1 : 0.42
    entry.armMaterial.opacity = current ? 0.42 : 0.1
  })
  stars.rotation.z = value * 0.045
  renderer.render(scene, camera)
}

function setProgress(value) {
  progress.value = THREE.MathUtils.clamp(value, 0, 1)
  activeIndex.value = Math.min(ITEM_COUNT - 1, Math.round(progress.value * (ITEM_COUNT - 1)))
  renderScene()
}

function setupScrollTrigger() {
  if (scrollTrigger || !root.value) return
  scrollTrigger = ScrollTrigger.create({
    trigger: root.value,
    start: 'top top',
    end: 'bottom bottom',
    invalidateOnRefresh: true,
    onUpdate: self => setProgress(self.progress),
    onRefresh: self => setProgress(self.progress)
  })
  setProgress(scrollTrigger.progress)
}

function handleCanvasClick(event) {
  if (!running || !renderer || !camera) return
  const bounds = renderer.domElement.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return
  pointer.set(
    (event.clientX - bounds.left) / bounds.width * 2 - 1,
    -(event.clientY - bounds.top) / bounds.height * 2 + 1
  )
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(hitTargets, false)[0]
  if (hit?.object.userData.key !== undefined) emit('open', hit.object.userData.key)
}

function handleContextLost(event) {
  event.preventDefault()
  failWebGL()
}

function disposeScene() {
  resizeObserver?.disconnect()
  resizeObserver = undefined
  if (renderer) {
    renderer.domElement.removeEventListener('click', handleCanvasClick)
    renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
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
  compass = undefined
  helix = undefined
  stars = undefined
  initialized = false
  nodeEntries = []
  hitTargets = []
  compassMaterials = []
  helixMaterials = []
}

function failWebGL() {
  webglFailed.value = true
  running = false
  scrollTrigger?.disable(false)
  disposeScene()
}

function handleViewportResize() {
  if (!running) return
  resizeScene()
  scrollTrigger?.refresh()
  renderScene()
}

function start() {
  if (!activated || staticMode.value || !initialized || running || !sceneHost.value) return
  running = true
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(resizeScene)
    resizeObserver.observe(sceneHost.value)
  }
  scrollTrigger?.enable()
  resizeScene()
  scrollTrigger?.refresh()
  renderScene()
}

function stop() {
  running = false
  scrollTrigger?.disable(false)
  resizeObserver?.disconnect()
  resizeObserver = undefined
}

async function handleMotionChange() {
  stop()
  reducedMotion.value = motionQuery.matches
  await nextTick()
  if (reducedMotion.value || webglFailed.value || !activated) return
  try {
    initScene()
    setupScrollTrigger()
    start()
  } catch {
    failWebGL()
  }
}

onMounted(() => {
  activated = true
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', handleMotionChange)
  window.addEventListener('resize', handleViewportResize, { passive: true })
  if (reducedMotion.value) return
  try {
    initScene()
    setupScrollTrigger()
    start()
  } catch {
    failWebGL()
  }
})

onActivated(() => {
  activated = true
  start()
})

onDeactivated(() => {
  activated = false
  stop()
})

onBeforeUnmount(() => {
  activated = false
  stop()
  motionQuery?.removeEventListener('change', handleMotionChange)
  window.removeEventListener('resize', handleViewportResize)
  scrollTrigger?.kill()
  scrollTrigger = undefined
  disposeScene()
})
</script>

<template>
  <section ref="root" class="spiral-journey" :class="{ 'is-static': staticMode }" aria-labelledby="journey-title">
    <div v-if="!staticMode" class="journey-stage">
      <div ref="sceneHost" class="scene-host" aria-hidden="true"></div>

      <div class="journey-copy">
        <Transition name="chapter-copy" mode="out-in">
          <article v-if="activeItem" :key="activeItem.key" class="chapter-copy">
            <p class="chapter-eyebrow">
              <span>{{ String(activeIndex + 1).padStart(2, '0') }} / 06</span>
              {{ activeItem.chapter }}
            </p>
            <h2 id="journey-title">{{ activeItem.title }}</h2>
            <p class="chapter-label">{{ activeItem.label }}</p>
            <p class="chapter-description">{{ activeItem.description }}</p>
            <dl class="chapter-metrics">
              <div v-for="metric in activeItem.metrics" :key="metric.label">
                <dt>{{ metric.label }}</dt>
                <dd>{{ metric.value }}</dd>
              </div>
            </dl>
            <button class="chapter-cta" type="button" @click="openItem(activeItem)">
              <span>{{ activeItem.cta }}</span>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" /></svg>
            </button>
          </article>
        </Transition>
      </div>

      <nav class="chapter-nav" aria-label="六项星轨章节">
        <button
          v-for="(item, index) in items"
          :key="item.key"
          type="button"
          :class="{ active: index === activeIndex }"
          :aria-current="index === activeIndex ? 'step' : undefined"
          :aria-label="`打开${item.chapter}：${item.title}`"
          @click="openItem(item)"
        >
          <span class="nav-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="nav-rule" aria-hidden="true"><i></i></span>
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="journey-progress">
        <span>SCROLL TO UNFOLD</span>
        <div
          class="progress-track"
          role="progressbar"
          aria-label="星轨滚动进度"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="progressPercent"
        ><i :style="{ transform: `scaleX(${progress})` }"></i></div>
        <span class="progress-count">{{ String(activeIndex + 1).padStart(2, '0') }} — 06</span>
      </div>
    </div>

    <div v-else class="static-journey">
      <header class="static-heading">
        <p>CELESTIAL INDEX / 06</p>
        <h2 id="journey-title">六章星轨</h2>
        <span>{{ webglFailed ? 'WebGL 暂不可用，已展开全部章节。' : '已依减少动态效果偏好展开全部章节。' }}</span>
      </header>
      <ol class="static-list">
        <li v-for="(item, index) in items" :key="item.key">
          <article class="static-chapter">
            <div class="static-index">{{ String(index + 1).padStart(2, '0') }}</div>
            <div class="static-copy">
              <p>{{ item.chapter }} · {{ item.label }}</p>
              <h3><button type="button" class="static-title" @click="openItem(item)">{{ item.title }}</button></h3>
              <p class="static-description">{{ item.description }}</p>
            </div>
            <dl class="static-metrics">
              <div v-for="metric in item.metrics" :key="metric.label">
                <dt>{{ metric.label }}</dt>
                <dd>{{ metric.value }}</dd>
              </div>
            </dl>
            <button class="chapter-cta static-cta" type="button" @click="openItem(item)">
              <span>{{ item.cta }}</span>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" /></svg>
            </button>
          </article>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.spiral-journey {
  --silver: oklch(0.94 0.006 250);
  --silver-soft: oklch(0.82 0.008 250 / 0.64);
  --silver-muted: oklch(0.86 0.006 250 / 0.38);
  --silver-line: oklch(0.9 0.006 250 / 0.16);
  position: relative;
  width: 100%;
  height: 560vh;
  background: transparent;
  color: var(--silver);
}
.spiral-journey.is-static { height: auto; }
.journey-stage {
  position: sticky;
  top: 0;
  width: 100%;
  height: 100vh;
  height: 100svh;
  min-height: 600px;
  overflow: hidden;
  background: transparent;
}
.scene-host { position: absolute; inset: 0; z-index: 0; }
.scene-host :deep(canvas) { display: block; width: 100%; height: 100%; touch-action: pan-y; }
.journey-copy {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: clamp(28px, 7vw, 120px);
  width: min(36vw, 480px);
  transform: translateY(-48%);
}
.chapter-copy { min-width: 0; }
.chapter-eyebrow {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
  color: var(--silver-muted);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
.chapter-eyebrow span { color: var(--silver-soft); font-variant-numeric: tabular-nums; }
.chapter-copy h2 {
  max-width: 12em;
  font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif;
  font-size: clamp(38px, 4.2vw, 68px);
  font-weight: 400;
  letter-spacing: 0.08em;
  line-height: 1.18;
  overflow-wrap: anywhere;
}
.chapter-label { margin-top: 14px; color: var(--silver-soft); font-size: 12px; letter-spacing: 0.18em; }
.chapter-description {
  max-width: 34em;
  margin-top: 24px;
  color: var(--silver-soft);
  font-size: 13px;
  line-height: 1.95;
  overflow-wrap: anywhere;
}
.chapter-metrics { display: flex; margin-top: 28px; flex-wrap: wrap; gap: 16px 28px; }
.chapter-metrics div { min-width: 72px; }
.chapter-metrics dt,
.static-metrics dt { color: var(--silver-muted); font-size: 9px; letter-spacing: 0.14em; }
.chapter-metrics dd,
.static-metrics dd { margin-top: 5px; color: var(--silver); font-size: 18px; font-weight: 300; font-variant-numeric: tabular-nums; }
.chapter-cta {
  display: inline-flex;
  min-height: 44px;
  margin-top: 30px;
  padding: 0 0 8px;
  align-items: center;
  justify-content: space-between;
  gap: 42px;
  border: 0;
  border-bottom: 1px solid var(--silver-soft);
  background: transparent;
  color: var(--silver);
  cursor: pointer;
  font-size: 12px;
  letter-spacing: 0.12em;
  transition: color 180ms ease, border-color 180ms ease;
}
.chapter-cta svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1; transition: transform 180ms ease; }
.chapter-cta:hover { border-color: var(--silver); color: #fff; }
.chapter-cta:hover svg { transform: translateX(3px); }
.chapter-cta:active svg { transform: translateX(5px); }
.chapter-nav {
  position: absolute;
  z-index: 3;
  top: 50%;
  right: clamp(24px, 5vw, 84px);
  display: flex;
  width: 190px;
  flex-direction: column;
  transform: translateY(-50%);
}
.chapter-nav button {
  display: grid;
  min-height: 52px;
  padding: 0;
  grid-template-columns: 28px 40px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border: 0;
  background: transparent;
  color: var(--silver-muted);
  cursor: pointer;
  text-align: left;
  transition: color 200ms ease;
}
.chapter-nav button:hover,
.chapter-nav button.active { color: var(--silver); }
.nav-number { font-size: 9px; font-variant-numeric: tabular-nums; letter-spacing: 0.08em; }
.nav-rule { position: relative; display: block; height: 1px; background: var(--silver-line); }
.nav-rule i {
  position: absolute;
  top: 50%;
  left: 0;
  width: 5px;
  height: 5px;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: transparent;
  transform: translateY(-50%);
  transition: background-color 200ms ease, transform 200ms ease;
}
.chapter-nav button.active .nav-rule i { background: currentColor; transform: translateY(-50%) scale(1.35); }
.nav-label { overflow: hidden; font-size: 11px; letter-spacing: 0.14em; text-overflow: ellipsis; white-space: nowrap; }
.journey-progress {
  position: absolute;
  z-index: 3;
  right: clamp(28px, 6vw, 100px);
  bottom: 30px;
  left: clamp(28px, 6vw, 100px);
  display: grid;
  grid-template-columns: auto minmax(80px, 1fr) auto;
  align-items: center;
  gap: 22px;
  color: var(--silver-muted);
  font-size: 8px;
  letter-spacing: 0.18em;
  font-variant-numeric: tabular-nums;
}
.progress-track { height: 1px; overflow: hidden; background: var(--silver-line); }
.progress-track i { display: block; width: 100%; height: 100%; background: var(--silver-soft); transform-origin: left; }
.progress-count { color: var(--silver-soft); }
.chapter-copy-enter-active,
.chapter-copy-leave-active { transition: opacity 220ms ease, transform 260ms ease; }
.chapter-copy-enter-from { opacity: 0; transform: translateY(12px); }
.chapter-copy-leave-to { opacity: 0; transform: translateY(-8px); }
.static-journey { width: min(100%, 1240px); margin: 0 auto; padding: 142px clamp(24px, 6vw, 88px) 110px; }
.static-heading { padding-bottom: 46px; border-bottom: 1px solid var(--silver-line); }
.static-heading > p { color: var(--silver-muted); font-size: 9px; letter-spacing: 0.22em; }
.static-heading h2 { margin-top: 16px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: clamp(38px, 5vw, 66px); font-weight: 400; letter-spacing: 0.12em; }
.static-heading > span { display: block; margin-top: 18px; color: var(--silver-muted); font-size: 11px; }
.static-list { list-style: none; }
.static-chapter {
  display: grid;
  padding: 42px 0;
  grid-template-columns: 44px minmax(0, 1.4fr) minmax(150px, 0.7fr) auto;
  align-items: start;
  gap: 30px;
  border-bottom: 1px solid var(--silver-line);
}
.static-index { padding-top: 4px; color: var(--silver-muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.static-copy > p:first-child { color: var(--silver-muted); font-size: 10px; letter-spacing: 0.15em; }
.static-copy h3 { margin-top: 12px; }
.static-title { display: block; border: 0; background: transparent; color: var(--silver); cursor: pointer; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 28px; font-weight: 400; letter-spacing: 0.08em; text-align: left; }
.static-description { max-width: 38em; margin-top: 16px; color: var(--silver-soft); font-size: 12px; line-height: 1.9; }
.static-metrics { display: flex; flex-wrap: wrap; gap: 18px 24px; }
.static-metrics div { min-width: 64px; }
.static-metrics dd { font-size: 16px; }
.static-cta { margin-top: 0; white-space: nowrap; gap: 20px; }

@media (max-width: 900px) {
  .journey-copy { left: 32px; width: 39vw; }
  .chapter-nav { right: 24px; width: 154px; }
  .chapter-nav button { grid-template-columns: 24px 26px minmax(0, 1fr); gap: 8px; }
  .static-chapter { grid-template-columns: 36px minmax(0, 1fr) auto; }
  .static-metrics { grid-column: 2; }
  .static-cta { grid-column: 3; grid-row: 1 / span 2; }
}

@media (max-width: 760px) {
  .spiral-journey { height: 450vh; }
  .journey-stage {
    display: grid;
    min-height: 0;
    padding: 64px 20px 48px;
    grid-template-rows: minmax(210px, 40svh) 44px minmax(0, 1fr);
    gap: 10px;
  }
  .scene-host { position: relative; inset: auto; grid-row: 1; width: 100%; height: 100%; min-height: 0; }
  .journey-copy {
    position: relative;
    top: auto;
    left: auto;
    grid-row: 3;
    align-self: start;
    width: 100%;
    transform: none;
  }
  .chapter-eyebrow { margin-bottom: 10px; font-size: 8px; }
  .chapter-copy h2 { max-width: none; font-size: clamp(30px, 9vw, 42px); line-height: 1.15; }
  .chapter-label { margin-top: 7px; font-size: 10px; }
  .chapter-description { margin-top: 12px; font-size: 12px; line-height: 1.75; }
  .chapter-metrics { margin-top: 14px; gap: 10px 22px; }
  .chapter-metrics dd { margin-top: 2px; font-size: 15px; }
  .chapter-cta { min-height: 44px; margin-top: 14px; padding-bottom: 5px; }
  .chapter-nav {
    position: relative;
    top: auto;
    right: auto;
    display: grid;
    grid-row: 2;
    width: 100%;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    transform: none;
  }
  .chapter-nav button { display: flex; min-width: 0; min-height: 44px; justify-content: center; gap: 7px; }
  .nav-rule { width: 12px; }
  .nav-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .journey-progress { right: 20px; bottom: 16px; left: 20px; grid-template-columns: minmax(60px, 1fr) auto; gap: 14px; }
  .journey-progress > span:first-child { display: none; }
  .static-journey { padding: 108px 20px 70px; }
  .static-heading { padding-bottom: 32px; }
  .static-chapter { padding: 32px 0; grid-template-columns: 28px minmax(0, 1fr); gap: 18px; }
  .static-copy { min-width: 0; }
  .static-title { max-width: 100%; font-size: 25px; white-space: normal; }
  .static-metrics { grid-column: 2; }
  .static-cta { grid-column: 2; grid-row: auto; justify-self: start; }
}

@media (max-width: 760px) and (max-height: 740px) {
  .journey-stage { padding-top: 54px; grid-template-rows: minmax(180px, 34svh) 44px minmax(0, 1fr); gap: 6px; }
  .chapter-copy h2 { font-size: 30px; }
  .chapter-description { margin-top: 8px; line-height: 1.6; }
  .chapter-metrics { margin-top: 9px; }
  .chapter-cta { margin-top: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .chapter-copy-enter-active,
  .chapter-copy-leave-active,
  .chapter-cta,
  .chapter-cta svg,
  .chapter-nav button,
  .nav-rule i { transition: none; }
}
</style>
