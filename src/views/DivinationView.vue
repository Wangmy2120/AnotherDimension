<script setup>
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { store, openAi } from '../store.js'
import { tossOne, buildResult } from '../lib/hexagram.js'
import { sound } from '../lib/sound.js'

const LATEST_KEY = 'tianji.gua.latest'
const LINE_LABELS = { 6: '老阴 ⚋×', 7: '少阳 ⚊', 8: '少阴 ⚋', 9: '老阳 ⚊○' }
const POS_NAME = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']

const question = ref('')
const phase = ref('idle')
const lines = ref([])
const result = ref(null)
const spinning = ref(false)
const displayCoins = ref([3, 3, 3])
const round = ref(0)
const coinArea = ref(null)
const impacts = ref([])
const storageWarning = ref('')
const motionQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null
const reducedMotion = ref(motionQuery?.matches ?? false)

const scheduled = new Map()
let tossVersion = 0
let impactSequence = 0
let skipNextQuestionLoad = false

function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h.toString(36)
}

function storageKey() {
  return `tianji.gua.${store.dateStr}.${hash(question.value.trim() || '默认')}`
}

function normalizeLines(candidate) {
  if (!Array.isArray(candidate) || candidate.length !== 6) return null
  const normalized = []
  for (const line of candidate) {
    if (!line || !Array.isArray(line.coins) || line.coins.length !== 3) return null
    const coins = line.coins.map(Number)
    if (coins.some(coin => coin !== 2 && coin !== 3)) return null
    const value = coins.reduce((sum, coin) => sum + coin, 0)
    normalized.push({
      coins,
      value,
      yang: value === 7 || value === 9,
      moving: value === 6 || value === 9,
      label: LINE_LABELS[value]
    })
  }
  return normalized
}

function readStored(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data) return null
    const legacyArray = Array.isArray(data)
    return {
      date: legacyArray || typeof data.date !== 'string' ? null : data.date,
      question: legacyArray || typeof data.question !== 'string' ? '' : data.question,
      lines: normalizeLines(legacyArray ? data : data.lines)
    }
  } catch {
    return null
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function updateStorageWarning(failed) {
  storageWarning.value = failed ? '浏览器未允许本地存储，本次卦象仅在当前页面保留。' : ''
}

function persistLatest() {
  const saved = writeStored(LATEST_KEY, {
    version: 2,
    date: store.dateStr,
    question: question.value,
    lines: lines.value.length === 6 ? lines.value : []
  })
  updateStorageWarning(!saved)
}

function persistCompleted() {
  // 保留旧 key 与原始六爻数组格式，旧版本和其他历史记录读取逻辑仍可兼容。
  const legacySaved = writeStored(storageKey(), lines.value)
  const latestSaved = writeStored(LATEST_KEY, {
    version: 2,
    date: store.dateStr,
    question: question.value,
    lines: lines.value
  })
  updateStorageWarning(!legacySaved || !latestSaved)
}

function syncHexSession() {
  store.hexSession = result.value
    ? { result: result.value, question: question.value.trim() }
    : null
}

function clearReading() {
  phase.value = 'idle'
  lines.value = []
  result.value = null
  spinning.value = false
  displayCoins.value = [3, 3, 3]
  round.value = 0
  impacts.value = []
  syncHexSession()
}

function applyReading(savedLines) {
  lines.value = savedLines.map(line => ({ ...line, coins: [...line.coins] }))
  result.value = buildResult(lines.value)
  displayCoins.value = [...lines.value[5].coins]
  round.value = 6
  spinning.value = false
  phase.value = 'done'
  syncHexSession()
}

function loadSaved() {
  if (phase.value === 'tossing') return
  const saved = readStored(storageKey())
  if (saved?.lines) applyReading(saved.lines)
  else clearReading()
  persistLatest()
}

function restoreInitial() {
  const latest = readStored(LATEST_KEY)
  if (latest && (!latest.date || latest.date === store.dateStr)) {
    question.value = latest.question.slice(0, 40)
    if (latest.lines) {
      applyReading(latest.lines)
      persistCompleted()
      return
    }
  }
  loadSaved()
}

restoreInitial()

watch([() => store.dateStr, question], () => {
  if (skipNextQuestionLoad) {
    skipNextQuestionLoad = false
    return
  }
  if (phase.value === 'tossing') {
    cancelToss()
    clearReading()
  }
  loadSaved()
})

function schedule(callback, ms) {
  const id = window.setTimeout(() => {
    scheduled.delete(id)
    callback(true)
  }, ms)
  scheduled.set(id, callback)
  return id
}

function settleScheduled(completed) {
  const pending = [...scheduled.values()]
  scheduled.forEach((callback, id) => window.clearTimeout(id))
  scheduled.clear()
  pending.forEach(callback => callback(completed))
}

function waitFor(ms) {
  if (reducedMotion.value) return Promise.resolve(true)
  const version = tossVersion
  return new Promise(resolve => {
    schedule(completed => resolve(completed && version === tossVersion), ms)
  })
}

function cancelToss() {
  tossVersion += 1
  spinning.value = false
  impacts.value = []
  settleScheduled(false)
}

function playCoin() {
  try {
    const playback = sound.coin()
    playback?.catch?.(() => {})
  } catch { /* 音频不可用时不妨碍成卦 */ }
}

function playBell() {
  try {
    const playback = sound.bell()
    playback?.catch?.(() => {})
  } catch { /* 音频不可用时不妨碍成卦 */ }
}

function emitImpact() {
  const rect = coinArea.value?.getBoundingClientRect()
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
  window.dispatchEvent(new CustomEvent('tianji:ink-pulse', { detail: { x, y } }))
  if (!rect || reducedMotion.value) return

  const count = 8 + Math.floor(Math.random() * 5)
  const id = ++impactSequence
  const impact = {
    id,
    x: x - rect.left,
    y: y - rect.top,
    particles: Array.from({ length: count }, (_, index) => {
      const angle = (Math.PI * 2 * index) / count + (Math.random() - 0.5) * 0.34
      const distance = 46 + Math.random() * 58
      return {
        id: `${id}-${index}`,
        style: {
          '--dx': `${Math.cos(angle) * distance}px`,
          '--dy': `${Math.sin(angle) * distance * 0.78}px`,
          '--size': `${1.5 + Math.random() * 1.8}px`,
          '--delay': `${Math.random() * 45}ms`
        }
      }
    })
  }
  impacts.value = [...impacts.value, impact]
  schedule(() => {
    impacts.value = impacts.value.filter(item => item.id !== id)
  }, 700)
}

async function startToss() {
  if (phase.value === 'tossing') return

  const existing = readStored(storageKey())
  if (existing?.lines) {
    applyReading(existing.lines)
    persistLatest()
    return
  }

  cancelToss()
  const version = tossVersion
  clearReading()
  round.value = 1
  phase.value = 'tossing'
  persistLatest()
  await nextTick()
  if (version !== tossVersion) return

  for (let i = 0; i < 6; i++) {
    if (version !== tossVersion) return
    round.value = i + 1
    spinning.value = !reducedMotion.value
    if (!reducedMotion.value && !await waitFor(700)) return
    if (version !== tossVersion) return

    const toss = tossOne()
    displayCoins.value = toss.coins
    spinning.value = false
    lines.value = [...lines.value, toss]
    playCoin()
    emitImpact()

    // 最后一爻保留完整的粒子衰减时间，其余爻落定后进入下一次摇钱。
    if (!reducedMotion.value && !await waitFor(i === 5 ? 700 : 420)) return
  }

  if (version !== tossVersion) return
  result.value = buildResult(lines.value)
  spinning.value = false
  phase.value = 'done'
  persistCompleted()
  syncHexSession()
  playBell()
}

function newQuestion() {
  cancelToss()
  skipNextQuestionLoad = question.value !== ''
  question.value = ''
  clearReading()
  persistLatest()
}

function askAi() {
  syncHexSession()
  openAi('hexagram')
}

function handleMotionChange(event) {
  reducedMotion.value = event.matches
  if (event.matches) {
    spinning.value = false
    impacts.value = []
    // 正在等待的摇卦立即继续，不因减少动态效果而延迟功能。
    settleScheduled(true)
  }
}

if (motionQuery?.addEventListener) motionQuery.addEventListener('change', handleMotionChange)
else motionQuery?.addListener?.(handleMotionChange)

onActivated(() => {
  if (phase.value !== 'tossing') loadSaved()
})

onDeactivated(() => {
  const wasTossing = phase.value === 'tossing'
  cancelToss()
  if (wasTossing) {
    clearReading()
    loadSaved()
  }
})

onBeforeUnmount(() => {
  cancelToss()
  if (motionQuery?.removeEventListener) motionQuery.removeEventListener('change', handleMotionChange)
  else motionQuery?.removeListener?.(handleMotionChange)
})
</script>

<template>
  <div class="divination-view">
    <div class="card">
      <h2 class="card-title">周易摇卦 · 三钱法</h2>
      <p class="muted intro-copy">
        心中默念所问之事，摇动三枚铜钱，凡六次而成一卦。老阳老阴为动爻，动则生变卦。
        「初筮告，再三渎」——同一日同一事，只取初卦。
      </p>
      <input v-model="question" :disabled="phase !== 'idle'" placeholder="所问何事？（可留空，问今日整体运势）"
        class="question-input" maxlength="40">
      <button v-if="phase === 'idle'" class="btn block" @click="startToss">诚心摇卦</button>
      <button v-if="phase === 'done'" class="btn ghost block" @click="newQuestion">另问新事</button>
    </div>

    <div v-if="phase === 'tossing'" class="card toss-card">
      <p class="muted round-label">第 {{ round }} / 6 爻 · {{ POS_NAME[round - 1] }}</p>
      <div ref="coinArea" class="coins" aria-label="三枚铜钱">
        <div v-for="(coin, index) in displayCoins" :key="index" class="coin-unit">
          <div class="metal-coin" :class="{ spinning }">
            <span class="coin-edge" aria-hidden="true"></span>
            <div class="coin-face coin-front">
              <span class="coin-mark">{{ coin === 3 ? '背' : '字' }}</span>
              <span class="coin-hole" aria-hidden="true"></span>
            </div>
            <div class="coin-face coin-back" aria-hidden="true">
              <span class="coin-mark">{{ coin === 3 ? '字' : '背' }}</span>
              <span class="coin-hole"></span>
            </div>
          </div>
        </div>

        <div v-if="impacts.length" class="impact-layer" aria-hidden="true">
          <div v-for="impact in impacts" :key="impact.id" class="impact"
            :style="{ left: `${impact.x}px`, top: `${impact.y}px` }">
            <i class="ripple"></i>
            <i class="ripple ripple-secondary"></i>
            <i v-for="particle in impact.particles" :key="particle.id" class="spark" :style="particle.style"></i>
          </div>
        </div>
      </div>
      <div class="yao-list live-lines">
        <div v-for="(line, index) in lines" :key="index" class="yao" :class="{ moving: line.moving }">
          <span class="yao-label">{{ line.label }}</span>
          <div class="yao-bar">
            <div v-if="line.yang" class="seg"></div>
            <template v-else><div class="seg"></div><div class="seg"></div></template>
          </div>
        </div>
      </div>
    </div>

    <template v-if="phase === 'done' && result">
      <div class="card result-card">
        <div class="spread hex-summary">
          <div class="primary-result">
            <div class="hex-symbol" aria-hidden="true">{{ result.primary.symbol }}</div>
            <div class="hex-name primary-name">{{ result.primaryName }}</div>
          </div>
          <div v-if="result.changed" class="changed-result">
            <div class="muted small">变卦</div>
            <div class="changed-symbol" aria-hidden="true">{{ result.changed.symbol }}</div>
            <div class="changed-name">{{ result.changedName }}</div>
          </div>
          <div v-else class="muted small quiet-result">六爻安静<br>以本卦卦辞断</div>
        </div>
        <div class="yao-list result-lines">
          <div v-for="(line, index) in lines" :key="index" class="yao" :class="{ moving: line.moving }"
            :style="{ '--line-delay': `${index * 120}ms` }">
            <span class="yao-label">{{ result.primary.lines[index].name }}{{ line.moving ? ' · 动' : '' }}</span>
            <div class="yao-bar">
              <div v-if="line.yang" class="seg"></div>
              <template v-else><div class="seg"></div><div class="seg"></div></template>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">卦辞</h2>
        <p class="scripture primary-scripture">{{ result.primary.scripture }}</p>
      </div>

      <div v-if="result.movingTexts.length" class="card">
        <h2 class="card-title">动爻爻辞</h2>
        <div v-for="text in result.movingTexts" :key="text.name" class="kv">
          <span class="k moving-name">{{ text.name }}</span>
          <span class="scripture">{{ text.scripture }}</span>
        </div>
      </div>

      <div v-if="result.changed" class="card">
        <h2 class="card-title">变卦卦辞 · {{ result.changedName }}</h2>
        <p class="scripture">{{ result.changed.scripture }}</p>
      </div>

      <div class="card">
        <button class="btn block" @click="askAi">AI 解卦</button>
        <p class="muted small storage-note">卦象已记入今日卦簿，同日重问同事不再重摇。</p>
        <p class="card-footnote muted small">动爻取本卦变爻爻辞；无动爻时以本卦卦辞为主。卦爻辞引自《周易》公版原文。</p>
        <p v-if="storageWarning" class="storage-warning" role="status">{{ storageWarning }}</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.divination-view { --coin-size: 76px; }
.intro-copy { margin-bottom: 12px; line-height: 1.9; }
.question-input { width: 100%; margin-bottom: 12px; }
.toss-card { overflow: hidden; text-align: center; }
.round-label { margin-bottom: 2px; }

.coins {
  position: relative;
  display: flex;
  min-height: 154px;
  padding: 28px 20px 38px;
  align-items: center;
  justify-content: center;
  gap: clamp(18px, 5vw, 30px);
  perspective: 850px;
  isolation: isolate;
}
.coin-unit {
  width: var(--coin-size);
  height: var(--coin-size);
  flex: 0 0 var(--coin-size);
  transform-style: preserve-3d;
}
.metal-coin {
  position: relative;
  width: 100%;
  height: 100%;
  transform: rotateX(9deg) rotateY(-8deg);
  transform-style: preserve-3d;
}
.coin-unit:nth-child(2) .metal-coin { transform: rotateX(7deg) rotateY(7deg); }
.coin-unit:nth-child(3) .metal-coin { transform: rotateX(10deg) rotateY(-3deg); }
.coin-unit:nth-child(2) .metal-coin.spinning { animation-delay: -170ms; }
.coin-unit:nth-child(3) .metal-coin.spinning { animation-delay: -310ms; }
.metal-coin.spinning {
  animation: coin-roll 620ms linear infinite;
  will-change: transform;
}
.coin-edge {
  position: absolute;
  inset: 2px;
  border: 3px solid #3d3d3d;
  border-radius: 50%;
  background: #191919;
  box-shadow: 0 10px 22px rgb(0 0 0 / 45%);
  transform: translateZ(-1px);
}
.coin-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border: 1px solid #a8a8a8;
  border-radius: 50%;
  background:
    radial-gradient(circle at 29% 23%, rgb(255 255 255 / 78%) 0, rgb(255 255 255 / 15%) 20%, transparent 39%),
    conic-gradient(from 215deg, #151515, #dedede 9%, #555 23%, #ededed 38%, #272727 55%, #919191 72%, #101010 89%, #151515);
  box-shadow:
    inset 0 0 0 3px rgb(255 255 255 / 13%),
    inset 0 0 12px rgb(0 0 0 / 68%),
    0 8px 20px rgb(0 0 0 / 35%);
  backface-visibility: hidden;
}
.coin-face::before {
  content: '';
  position: absolute;
  inset: 6px;
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 38%);
}
.coin-face::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(118deg, transparent 28%, rgb(255 255 255 / 20%) 44%, transparent 57%);
  transform: rotate(-12deg);
}
.coin-front { transform: translateZ(2px); }
.coin-back { transform: rotateX(180deg) translateZ(2px); }
.coin-mark {
  position: absolute;
  z-index: 2;
  top: 10px;
  right: 0;
  left: 0;
  color: #f2f2f2;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 12px;
  line-height: 1;
  text-align: center;
  text-shadow: 0 1px 2px #000;
}
.coin-hole {
  position: absolute;
  z-index: 3;
  top: 50%;
  left: 50%;
  width: 19px;
  height: 19px;
  border: 1px solid #888;
  background: linear-gradient(135deg, #050505, #292929);
  box-shadow:
    inset 2px 2px 4px #000,
    inset -1px -1px 2px rgb(255 255 255 / 17%),
    0 0 0 2px rgb(0 0 0 / 25%);
  transform: translate(-50%, -50%);
}

.impact-layer { position: absolute; z-index: 4; inset: 0; pointer-events: none; }
.impact { position: absolute; width: 0; height: 0; }
.spark {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: #f7f7f7;
  box-shadow: 0 0 5px rgb(255 255 255 / 75%);
  animation: spark-fly 600ms cubic-bezier(0.16, 0.72, 0.28, 1) both;
  animation-delay: var(--delay);
}
.ripple {
  position: absolute;
  top: 0;
  left: 0;
  width: 30px;
  height: 30px;
  margin: -15px;
  border: 1px solid rgb(255 255 255 / 55%);
  border-radius: 50%;
  animation: ripple-expand 600ms ease-out both;
}
.ripple-secondary { animation-delay: 80ms; }

.live-lines { max-width: 340px; margin: 0 auto; }
.result-card { overflow: hidden; }
.hex-summary { align-items: center; }
.hex-symbol { font-size: 44px; line-height: 1; }
.hex-name {
  margin-top: 8px;
  color: var(--ink);
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 21px;
  letter-spacing: 2px;
}
.primary-name { animation: name-glow 900ms ease-out 160ms both; }
.changed-result { text-align: right; animation: changed-slide 720ms cubic-bezier(0.2, 0.75, 0.25, 1) 420ms both; }
.changed-symbol { margin-top: 3px; font-size: 34px; line-height: 1.2; }
.changed-name { color: var(--ink-soft); font-size: 14px; letter-spacing: 1px; }
.quiet-result { line-height: 1.8; text-align: right; }
.result-lines { margin-top: 20px; padding: 12px 0; }
.result-lines .yao { min-height: 18px; }
.result-lines .yao-label { min-width: 76px; }
.result-lines .yao.moving .yao-label { color: var(--ink-soft); }
.result-lines .yao-bar { position: relative; height: 12px; }
.result-lines .seg {
  transform-origin: left center;
  animation: line-grow 440ms cubic-bezier(0.2, 0.72, 0.25, 1) both;
  animation-delay: var(--line-delay);
}
.result-lines .yao.moving .yao-bar::after {
  content: '';
  position: absolute;
  inset: -4px 0;
  background: rgb(255 255 255 / 5%);
  box-shadow: 0 0 13px rgb(255 255 255 / 20%);
  opacity: 0.16;
  pointer-events: none;
  animation: moving-breathe 3.4s ease-in-out infinite both;
  animation-delay: calc(var(--line-delay) + 440ms);
}
.scripture { line-height: 2; }
.primary-scripture { font-size: 16px; }
.moving-name { color: var(--ink-soft); }
.storage-note { margin-top: 10px; text-align: center; }
.storage-warning { margin-top: 10px; color: var(--ink-soft); font-size: 12px; line-height: 1.7; text-align: center; }

@keyframes coin-roll {
  0% { transform: translate3d(0, 0, 0) rotateX(0deg) rotateZ(0deg); }
  18% { transform: translate3d(-3px, -9px, 16px) rotateX(146deg) rotateZ(-4deg); }
  36% { transform: translate3d(3px, 1px, 4px) rotateX(288deg) rotateZ(3deg); }
  58% { transform: translate3d(-2px, -6px, 12px) rotateX(470deg) rotateZ(-3deg); }
  78% { transform: translate3d(2px, 0, 2px) rotateX(612deg) rotateZ(2deg); }
  100% { transform: translate3d(0, 0, 0) rotateX(720deg) rotateZ(0deg); }
}
@keyframes spark-fly {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.35); }
  12% { opacity: 1; }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.12); }
}
@keyframes ripple-expand {
  0% { opacity: 0.65; transform: scale(0.35); }
  100% { opacity: 0; transform: scale(5.5); }
}
@keyframes line-grow {
  0% { opacity: 0.15; transform: scaleX(0); }
  100% { opacity: 1; transform: scaleX(1); }
}
@keyframes moving-breathe {
  0%, 100% { opacity: 0.16; }
  50% { opacity: 0.58; }
}
@keyframes name-glow {
  0% { opacity: 0; text-shadow: 0 0 0 rgb(255 255 255 / 0%); transform: translateY(5px); }
  62% { opacity: 1; text-shadow: 0 0 20px rgb(255 255 255 / 28%); }
  100% { opacity: 1; text-shadow: 0 0 10px rgb(255 255 255 / 12%); transform: translateY(0); }
}
@keyframes changed-slide {
  0% { opacity: 0; transform: translateX(30px); }
  100% { opacity: 1; transform: translateX(0); }
}

@media (max-width: 700px) {
  .divination-view { --coin-size: 66px; }
  .coins { min-height: 142px; padding-inline: 12px; }
  .changed-symbol { font-size: 30px; }
  .changed-name { font-size: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .divination-view *,
  .divination-view *::before,
  .divination-view *::after {
    animation: none !important;
    transition: none !important;
  }
  .impact-layer { display: none !important; }
  .result-lines .seg { opacity: 1 !important; transform: none !important; }
  .primary-name,
  .changed-result { opacity: 1 !important; text-shadow: none !important; transform: none !important; }
}
</style>
