<script setup>
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { store } from '../store.js'
import { getSolarPosition, getTrueSolarTime } from '../lib/solar.js'

gsap.registerPlugin(ScrollTrigger)

const root = ref(null)
const canvasHost = ref(null)
const webglFailed = ref(false)
const now = ref(new Date())
const position = computed(() => getSolarPosition(now.value, store.location.latitude, store.location.longitude))
const localTime = computed(() => now.value.toLocaleTimeString('zh-CN', { hour12: false }))
const coordinateText = computed(() => {
  const { latitude, longitude } = store.location
  return `${Math.abs(latitude).toFixed(3)}°${latitude >= 0 ? 'N' : 'S'}  ${Math.abs(longitude).toFixed(3)}°${longitude >= 0 ? 'E' : 'W'}`
})
const sourceLabel = computed(() => ({ default: 'BEIJING / DEFAULT', gps: 'CURRENT POSITION', manual: 'MANUAL POSITION' })[store.location.source])

let renderer
let scene
let camera
let composer
let instrument
let starfield
let timeTicks
let outerRing
let orbitA
let orbitB
let core
let flowA
let flowB
let sun
let sunGlow
let sunLine
let secondHand
let bloom
let baseScale = 1
let initialized = false
let animationActive = false
let motionQuery
let introTimeline
let scrollTween
let resizeObserver
let nowTimer
const timer = new THREE.Timer()
const motion = { progress: 0 }
const pointer = { x: 0, y: 0 }
const targetPointer = { x: 0, y: 0 }

function makeTextSprite(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  context.font = '42px "Songti SC", "SimSun", serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgba(255,255,255,0.82)'
  context.fillText(text, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.65, depthWrite: false }))
  sprite.scale.set(0.38, 0.38, 1)
  return sprite
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.8)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.16)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

function makeRing(radius, thickness, opacity) {
  return new THREE.Mesh(
    new THREE.TorusGeometry(radius, thickness, 8, 256),
    new THREE.MeshBasicMaterial({ color: 0xf4f5f7, transparent: true, opacity, depthWrite: false })
  )
}

function makeTicks() {
  const major = []
  const minor = []
  for (let index = 0; index < 120; index++) {
    const angle = index / 120 * Math.PI * 2
    const inner = index % 10 === 0 ? 2.32 : 2.43
    const target = index % 10 === 0 ? major : minor
    target.push(
      Math.sin(angle) * inner, Math.cos(angle) * inner, 0,
      Math.sin(angle) * 2.55, Math.cos(angle) * 2.55, 0
    )
  }
  const group = new THREE.Group()
  for (const [positions, opacity] of [[major, 0.72], [minor, 0.25]]) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false })))
  }
  return group
}

function makeFlow(phase, opacity) {
  const points = []
  for (let index = 0; index < 900; index++) {
    const progress = index / 900
    const angle = progress * Math.PI * 7 + phase
    const radius = 0.3 + progress * 1.1 + (Math.random() - 0.5) * 0.06
    points.push(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.72,
      (progress - 0.5) * 1.5 + (Math.random() - 0.5) * 0.08
    )
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.012, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending
  }))
}

function initScene() {
  const host = canvasHost.value
  const width = host.clientWidth || window.innerWidth
  const height = host.clientHeight || window.innerHeight
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setClearColor(0x030304, 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  host.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x030304, 0.025)
  camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100)
  camera.position.set(0, 0, 10)

  composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.75, 0.55, 0.22)
  composer.addPass(bloom)

  scene.add(new THREE.AmbientLight(0xffffff, 0.22))
  const keyLight = new THREE.PointLight(0xffffff, 42, 24)
  keyLight.position.set(4, 3, 5)
  scene.add(keyLight)
  const rimLight = new THREE.PointLight(0xb8c5ff, 28, 20)
  rimLight.position.set(-4, -1, 3)
  scene.add(rimLight)

  const starPositions = []
  const starCount = width < 800 ? 850 : 1800
  for (let index = 0; index < starCount; index++) {
    starPositions.push(
      (Math.random() - 0.5) * 34,
      (Math.random() - 0.5) * 22,
      -4 - Math.random() * 24
    )
  }
  const starsGeometry = new THREE.BufferGeometry()
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
  starfield = new THREE.Points(starsGeometry, new THREE.PointsMaterial({
    color: 0xe9edff, size: 0.025, transparent: true, opacity: 0.7, depthWrite: false
  }))
  scene.add(starfield)

  instrument = new THREE.Group()
  scene.add(instrument)
  outerRing = makeRing(2.62, 0.008, 0.72)
  instrument.add(outerRing)
  instrument.add(makeRing(2.12, 0.005, 0.2))
  instrument.add(makeRing(1.08, 0.005, 0.16))

  orbitA = makeRing(2.28, 0.009, 0.42)
  orbitA.rotation.set(1.08, 0.18, 0.2)
  instrument.add(orbitA)
  orbitB = makeRing(1.82, 0.007, 0.34)
  orbitB.rotation.set(0.62, 1.12, -0.35)
  instrument.add(orbitB)
  const orbitC = makeRing(2.83, 0.004, 0.18)
  orbitC.rotation.set(1.42, 0.2, 0.5)
  instrument.add(orbitC)

  timeTicks = makeTicks()
  instrument.add(timeTicks)
  const hours = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
  hours.forEach((hour, index) => {
    const angle = index / 12 * Math.PI * 2
    const label = makeTextSprite(hour)
    label.position.set(Math.sin(angle) * 3.02, Math.cos(angle) * 3.02, 0)
    instrument.add(label)
  })

  core = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 64, 64),
    new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.96, roughness: 0.18 })
  )
  instrument.add(core)
  const coreWire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.79, 2)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.09, depthWrite: false })
  )
  instrument.add(coreWire)

  flowA = makeFlow(0, 0.52)
  flowB = makeFlow(Math.PI, 0.25)
  instrument.add(flowA, flowB)

  sun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }))
  instrument.add(sun)
  sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending
  }))
  sunGlow.scale.set(0.72, 0.72, 1)
  instrument.add(sunGlow)

  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 2.55, 0], 3))
  sunLine = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false }))
  instrument.add(sunLine)

  secondHand = new THREE.Group()
  const secondGeometry = new THREE.BufferGeometry()
  secondGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.02, 0, 2.48, 0.02], 3))
  secondHand.add(new THREE.Line(secondGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, depthWrite: false })))
  instrument.add(secondHand)

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()
  initialized = true
  renderStatic()
}

function resize() {
  if (!renderer || !canvasHost.value) return
  const width = canvasHost.value.clientWidth
  const height = canvasHost.value.clientHeight
  if (!width || !height) return
  const compact = width < 800
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.25 : 1.75))
  renderer.setSize(width, height, false)
  composer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  instrument.position.set(compact ? 0.35 : 1.85, compact ? 0.75 : 0, 0)
  baseScale = compact ? 0.76 : 1
  instrument.scale.setScalar(baseScale)
  bloom.strength = compact ? 0.58 : 0.75
}

function updateSolarPosition() {
  if (!sun) return
  const azimuth = position.value.azimuth * Math.PI / 180
  const elevation = position.value.elevation * Math.PI / 180
  const x = Math.sin(azimuth) * 2.55
  const y = Math.cos(azimuth) * 2.55
  const z = Math.sin(elevation) * 1.4
  sun.position.set(x, y, z)
  sunGlow.position.copy(sun.position)
  const attribute = sunLine.geometry.attributes.position
  attribute.setXYZ(1, x, y, z)
  attribute.needsUpdate = true
}

function renderStatic() {
  if (!initialized) return
  updateSolarPosition()
  timeTicks.rotation.z = -(getTrueSolarTime(now.value, store.location.longitude) / 1440) * Math.PI * 2
  secondHand.rotation.z = -(now.value.getSeconds() / 60) * Math.PI * 2
  composer.render()
}

function animate() {
  if (!animationActive || document.hidden) return
  timer.update()
  const elapsed = timer.getElapsed()
  const progress = motion.progress
  pointer.x += (targetPointer.x - pointer.x) * 0.035
  pointer.y += (targetPointer.y - pointer.y) * 0.035

  instrument.rotation.x = 0.12 + progress * 0.62 + pointer.y * 0.08
  instrument.rotation.y = -0.16 + progress * 1.28 + elapsed * 0.018 + pointer.x * 0.1
  instrument.rotation.z = progress * 0.28
  instrument.scale.setScalar(baseScale * (1 + progress * 0.3))
  orbitA.rotation.z = 0.2 + elapsed * 0.065
  orbitB.rotation.z = -0.35 - elapsed * 0.05
  outerRing.rotation.z = elapsed * 0.012
  core.rotation.y = elapsed * 0.12
  flowA.rotation.z = elapsed * 0.045
  flowB.rotation.z = -elapsed * 0.035
  timeTicks.rotation.z = -(getTrueSolarTime(now.value, store.location.longitude) / 1440) * Math.PI * 2 - progress * 0.5
  secondHand.rotation.z = -(now.value.getSeconds() / 60) * Math.PI * 2
  starfield.rotation.y = elapsed * 0.003 + progress * 0.18
  starfield.rotation.x = progress * 0.08
  sunGlow.material.opacity = 0.72 + Math.sin(elapsed * 1.8) * 0.12
  updateSolarPosition()

  camera.position.x += (pointer.x * 0.32 - camera.position.x) * 0.035
  camera.position.y += (-pointer.y * 0.24 + progress * 0.35 - camera.position.y) * 0.035
  camera.position.z = 10 - progress * 2.25
  camera.lookAt(instrument.position.x * 0.2, 0, 0)
  composer.render()
}

function setupMotion() {
  if (motionQuery.matches) return
  const hero = root.value
  introTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from(hero.querySelector('.hero-kicker'), { y: 18, opacity: 0, duration: 0.8 }, 0.15)
    .from(hero.querySelectorAll('.line-inner'), { yPercent: 115, duration: 1.25, stagger: 0.12 }, 0.2)
    .from(hero.querySelectorAll('.hero-description, .hero-actions, .hero-telemetry, .scroll-cue'), {
      y: 24, opacity: 0, duration: 0.9, stagger: 0.09
    }, 0.65)
  scrollTween = gsap.to(motion, {
    progress: 1,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 1.1 }
  })
}

function start() {
  if (!initialized || animationActive) return
  animationActive = true
  if (motionQuery.matches) {
    renderStatic()
    return
  }
  timer.reset()
  scrollTween?.scrollTrigger.enable()
  renderer.setAnimationLoop(animate)
}

function stop() {
  if (!initialized) return
  animationActive = false
  renderer.setAnimationLoop(null)
  scrollTween?.scrollTrigger.disable(false)
}

function handlePointer(event) {
  if (motionQuery?.matches || event.pointerType === 'touch') return
  const bounds = root.value.getBoundingClientRect()
  targetPointer.x = (event.clientX / bounds.width - 0.5) * 2
  targetPointer.y = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2
}

function resetPointer() {
  targetPointer.x = 0
  targetPointer.y = 0
}

function handleMotionChange() {
  introTimeline?.progress(1).kill()
  stop()
  if (!motionQuery.matches && !scrollTween) setupMotion()
  start()
}

watch(position, () => {
  if (animationActive && motionQuery?.matches) renderStatic()
})

function scrollToProfile() {
  document.querySelector('.home-profile')?.scrollIntoView({ behavior: motionQuery?.matches ? 'auto' : 'smooth' })
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change', handleMotionChange)
  timer.connect(document)
  nowTimer = window.setInterval(() => { now.value = new Date() }, 1000)
  try {
    initScene()
    setupMotion()
    start()
  } catch {
    webglFailed.value = true
  }
})

onActivated(start)
onDeactivated(stop)

onBeforeUnmount(() => {
  window.clearInterval(nowTimer)
  motionQuery?.removeEventListener('change', handleMotionChange)
  timer.dispose()
  stop()
  introTimeline?.kill()
  scrollTween?.scrollTrigger.kill()
  scrollTween?.kill()
  resizeObserver?.disconnect()
  if (scene) {
    scene.traverse(object => {
      object.geometry?.dispose()
      const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []
      materials.forEach(material => {
        material.map?.dispose()
        material.dispose()
      })
    })
  }
  composer?.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <section ref="root" class="cosmic-hero" aria-labelledby="cosmic-title" @pointermove="handlePointer" @pointerleave="resetPointer">
    <div class="hero-stage">
      <div ref="canvasHost" class="webgl-stage" aria-hidden="true"></div>
      <div class="hero-vignette" aria-hidden="true"></div>
      <div class="hero-grain" aria-hidden="true"></div>
      <div class="hero-content">
        <div class="hero-copy">
          <p class="hero-kicker"><span></span>CELESTIAL INSTRUMENT · 001</p>
          <h2 id="cosmic-title" class="hero-title">
            <span class="hero-line"><span class="line-inner">观天象</span></span>
            <span class="hero-line hero-line-indent"><span class="line-inner">定此刻</span></span>
          </h2>
          <p class="hero-description">以时间为针，以天地为盘。<br>在星辰与方位之间，重新感知此刻。</p>
          <div class="hero-actions">
            <button class="hero-cta" type="button" @click="scrollToProfile">进入今日<span aria-hidden="true">↘</span></button>
            <span class="hero-action-note">SCROLL TO CALIBRATE</span>
          </div>
        </div>

        <div class="hero-telemetry" aria-label="罗盘实时数据">
          <div><span>LOCAL TIME</span><strong>{{ localTime }}</strong></div>
          <div><span>SOLAR AZIMUTH</span><strong>{{ position.azimuth.toFixed(1) }}°</strong></div>
          <div><span>POSITION</span><strong>{{ coordinateText }}</strong><small>{{ sourceLabel }}</small></div>
        </div>
      </div>
      <span class="hero-edition">TIANJI / 2026</span>
      <button class="scroll-cue" type="button" aria-label="滚动到今日内容" @click="scrollToProfile"><span>向下探索</span><i></i></button>
      <p v-if="webglFailed" class="webgl-fallback">当前设备未启用 WebGL，已切换为静态星图。</p>
    </div>
  </section>
</template>

<style scoped>
.cosmic-hero { position: relative; height: 175vh; min-height: 1000px; background: #030304; }
.hero-stage { position: sticky; top: 0; height: 100svh; min-height: 640px; overflow: hidden; background: #030304; }
.webgl-stage {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 28%, rgba(255,255,255,0.4) 0 1px, transparent 1.5px),
    radial-gradient(circle at 74% 62%, rgba(255,255,255,0.25) 0 1px, transparent 1.5px),
    #030304;
  background-size: 173px 181px, 229px 237px, auto;
}
.webgl-stage :deep(canvas) { display: block; width: 100%; height: 100%; }
.hero-vignette {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(3,3,4,0.96) 0%, rgba(3,3,4,0.72) 30%, transparent 62%),
    linear-gradient(0deg, rgba(3,3,4,0.9) 0%, transparent 35%),
    radial-gradient(circle at 50% 45%, transparent 35%, rgba(3,3,4,0.55) 100%);
  pointer-events: none;
}
.hero-grain {
  position: absolute;
  inset: -50%;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E");
  pointer-events: none;
  animation: grain-shift 0.35s steps(2) infinite;
}
.hero-content {
  position: relative;
  z-index: 2;
  display: flex;
  width: min(100%, 1600px);
  height: 100%;
  margin: 0 auto;
  padding: 150px 64px 70px;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}
.hero-copy { max-width: 660px; }
.hero-kicker { display: flex; margin-bottom: 30px; align-items: center; gap: 12px; color: rgba(255,255,255,0.52); font-size: 10px; letter-spacing: 0.28em; }
.hero-kicker span { width: 32px; height: 1px; background: rgba(255,255,255,0.5); }
.hero-title { font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: clamp(76px, 9.5vw, 154px); font-weight: 400; letter-spacing: -0.055em; line-height: 0.94; }
.hero-line { display: block; overflow: hidden; padding: 0 0.08em 0.12em 0; }
.hero-line-indent { padding-left: 0.72em; color: rgba(255,255,255,0.54); }
.line-inner { display: block; }
.hero-description { margin-top: 28px; color: rgba(255,255,255,0.58); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 15px; letter-spacing: 0.12em; line-height: 2; }
.hero-actions { display: flex; margin-top: 34px; align-items: center; gap: 22px; pointer-events: auto; }
.hero-cta {
  display: inline-flex;
  min-height: 54px;
  padding: 0 22px;
  align-items: center;
  gap: 42px;
  border: 1px solid rgba(255,255,255,0.32);
  border-radius: 0;
  background: rgba(255,255,255,0.04);
  color: #f5f5f3;
  cursor: pointer;
  font-size: 13px;
  letter-spacing: 0.12em;
  backdrop-filter: blur(8px);
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease;
}
.hero-cta span { font-size: 18px; transition: transform 200ms ease; }
.hero-cta:hover { border-color: #f5f5f3; background: #f5f5f3; color: #080809; }
.hero-cta:hover span { transform: translate(3px, 3px); }
.hero-action-note { color: rgba(255,255,255,0.3); font-size: 9px; letter-spacing: 0.22em; }
.hero-telemetry {
  display: grid;
  width: min(680px, 56%);
  margin-left: auto;
  grid-template-columns: 0.9fr 0.8fr 1.5fr;
  border-top: 1px solid rgba(255,255,255,0.16);
  pointer-events: auto;
}
.hero-telemetry > div { display: flex; min-width: 0; padding: 18px 18px 0; flex-direction: column; gap: 7px; }
.hero-telemetry > div:first-child { padding-left: 0; }
.hero-telemetry > div + div { border-left: 1px solid rgba(255,255,255,0.1); }
.hero-telemetry span { color: rgba(255,255,255,0.35); font-size: 8px; letter-spacing: 0.22em; }
.hero-telemetry strong { overflow: hidden; font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif; font-size: 17px; font-weight: 400; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.hero-telemetry small { color: rgba(255,255,255,0.35); font-size: 8px; letter-spacing: 0.12em; }
.hero-edition { position: absolute; z-index: 2; top: 50%; right: 24px; color: rgba(255,255,255,0.28); font-size: 8px; letter-spacing: 0.28em; writing-mode: vertical-rl; }
.scroll-cue {
  position: absolute;
  z-index: 3;
  bottom: 38px;
  left: 64px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 0;
  background: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  font-size: 10px;
  letter-spacing: 0.18em;
}
.scroll-cue i { position: relative; display: block; width: 48px; height: 1px; overflow: hidden; background: rgba(255,255,255,0.16); }
.scroll-cue i::after { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.75); animation: scroll-line 2s ease-in-out infinite; }
.webgl-fallback { position: absolute; z-index: 4; right: 28px; bottom: 24px; color: rgba(255,255,255,0.4); font-size: 10px; }

@keyframes scroll-line { 0% { transform: translateX(-100%); } 55%, 100% { transform: translateX(100%); } }
@keyframes grain-shift { 0% { transform: translate(0, 0); } 25% { transform: translate(2%, -1%); } 50% { transform: translate(-1%, 2%); } 75% { transform: translate(1%, 1%); } }

@media (max-width: 1000px) {
  .hero-content { padding-inline: 36px; }
  .hero-title { font-size: clamp(70px, 11vw, 110px); }
  .hero-telemetry { width: min(650px, 78%); }
  .scroll-cue { left: 36px; }
}

@media (max-height: 760px) and (min-width: 701px) {
  .hero-content { padding: 112px 48px 38px; }
  .hero-title { font-size: clamp(68px, 8vw, 108px); }
  .hero-kicker { margin-bottom: 20px; }
  .hero-description { margin-top: 18px; }
  .hero-actions { margin-top: 22px; }
  .scroll-cue { bottom: 24px; left: 48px; }
}

@media (max-width: 700px) {
  .cosmic-hero { height: 145vh; min-height: 850px; }
  .hero-stage { min-height: 600px; }
  .hero-vignette { background: linear-gradient(0deg, rgba(3,3,4,0.96) 0%, rgba(3,3,4,0.35) 60%, rgba(3,3,4,0.5) 100%); }
  .hero-content { padding: 108px 22px 32px; justify-content: flex-end; }
  .hero-copy { max-width: 100%; }
  .hero-kicker { margin-bottom: 16px; font-size: 8px; }
  .hero-title { font-size: clamp(58px, 18vw, 84px); line-height: 0.98; }
  .hero-description { margin-top: 16px; font-size: 12px; line-height: 1.8; }
  .hero-actions { margin-top: 20px; }
  .hero-action-note { display: none; }
  .hero-telemetry { width: 100%; margin-top: 28px; grid-template-columns: 1fr 1fr; }
  .hero-telemetry > div { padding: 14px 10px 0; }
  .hero-telemetry > div:nth-child(3) { display: none; }
  .hero-telemetry strong { font-size: 14px; }
  .hero-edition { display: none; }
  .scroll-cue { display: none; }
  .webgl-fallback { top: 118px; right: 22px; bottom: auto; left: 22px; text-align: right; }
}

@media (max-width: 700px) and (max-height: 620px) {
  .hero-content { padding-bottom: 57px; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-grain, .scroll-cue i::after { animation: none; }
}
</style>
