<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { store } from '../store.js'
import { formatSolarTime, getSolarPosition, getTrueSolarTime } from '../lib/solar.js'

const now = ref(new Date())
const location = store.location
const draft = reactive({ latitude: String(location.latitude), longitude: String(location.longitude) })
const locating = ref(false)
const status = ref('')
let timer

const position = computed(() => getSolarPosition(now.value, location.latitude, location.longitude))
const solarTime = computed(() => formatSolarTime(getTrueSolarTime(now.value, location.longitude)))
const localTime = computed(() => now.value.toLocaleTimeString('zh-CN', { hour12: false }))
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
const solarDirection = computed(() => directions[Math.round(position.value.azimuth / 45) % 8])
const sourceLabel = computed(() => ({ default: '默认位置 · 北京', gps: '浏览器定位', manual: '手动位置' })[location.source])
const coordinateText = computed(() => {
  const lat = `${Math.abs(location.latitude).toFixed(4)}°${location.latitude >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(location.longitude).toFixed(4)}°${location.longitude >= 0 ? 'E' : 'W'}`
  return `${lat} · ${lon}`
})
const azimuthScale = computed(() => `${Math.max(0.5, position.value.azimuth / 3.6)}%`)
const elevationScale = computed(() => `${Math.max(0.5, Math.abs(position.value.elevation) / 0.9)}%`)

function locate() {
  status.value = ''
  if (!navigator.geolocation) {
    status.value = '当前浏览器不支持定位，请手动输入经纬度。'
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    location.latitude = coords.latitude
    location.longitude = coords.longitude
    location.source = 'gps'
    draft.latitude = String(coords.latitude)
    draft.longitude = String(coords.longitude)
    locating.value = false
    status.value = '位置已更新，首屏与读数已按当前位置重新计算。'
  }, () => {
    locating.value = false
    status.value = '未能获取定位。你仍可手动输入经纬度，当前罗盘继续可用。'
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
}

function applyManualLocation() {
  const latitude = Number(draft.latitude)
  const longitude = Number(draft.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    status.value = '请输入有效范围：纬度 -90 至 90，经度 -180 至 180。'
    return
  }
  location.latitude = latitude
  location.longitude = longitude
  location.source = 'manual'
  status.value = '坐标已应用，首屏太阳指针已同步校准。'
}

onMounted(() => {
  timer = window.setInterval(() => { now.value = new Date() }, 1000)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <section class="telemetry-panel" aria-labelledby="telemetry-title">
    <div class="panel-heading">
      <div>
        <span class="panel-code">圭表 / LIVE TELEMETRY</span>
        <h2 id="telemetry-title">时空遥测</h2>
      </div>
      <span class="live-indicator"><i></i>{{ position.elevation >= 0 ? '昼间追踪' : '夜间追踪' }}</span>
    </div>

    <div class="location-console" aria-label="位置与坐标校准">
      <div class="location-row">
        <div class="location-copy">
          <strong>{{ sourceLabel }}</strong>
          <span>{{ coordinateText }}</span>
        </div>
        <button class="btn ghost small" type="button" :disabled="locating" @click="locate">
          {{ locating ? '定位中…' : '使用当前位置' }}
        </button>
      </div>

      <form class="location-editor" novalidate @submit.prevent="applyManualLocation">
        <div class="location-editor-heading">
          <span>MANUAL COORDINATE</span>
          <span>手动坐标</span>
        </div>
        <div class="location-editor-grid">
          <label>纬度
            <input v-model="draft.latitude" type="number" inputmode="decimal" min="-90" max="90" step="0.0001" required>
          </label>
          <label>经度
            <input v-model="draft.longitude" type="number" inputmode="decimal" min="-180" max="180" step="0.0001" required>
          </label>
          <button class="btn ghost small" type="submit">应用坐标</button>
        </div>
      </form>

      <p class="location-note">{{ timeZone }} · 采用近似天文算法，首屏太阳指针与本面板同步更新。</p>
      <p v-if="status" class="location-status" role="status">{{ status }}</p>
    </div>

    <div class="telemetry-main">
      <div class="azimuth-block">
        <span class="metric-label">太阳方位角 / AZIMUTH</span>
        <div class="azimuth-value">{{ position.azimuth.toFixed(1) }}<sup>°</sup></div>
        <p>{{ solarDirection }}方 · 北起顺时针</p>
      </div>
      <div class="metric-rulers">
        <div class="ruler-item">
          <div class="ruler-label"><span>方位</span><span>000° — 360°</span></div>
          <div class="ruler-track"><i :style="{ width: azimuthScale }"></i></div>
        </div>
        <div class="ruler-item">
          <div class="ruler-label"><span>高度角绝对值</span><span>{{ position.elevation.toFixed(1) }}°</span></div>
          <div class="ruler-track"><i :style="{ width: elevationScale }"></i></div>
        </div>
        <p class="horizon-state">{{ position.elevation >= 0 ? '太阳位于地平线上' : '太阳位于地平线下' }}</p>
      </div>
    </div>

    <div class="telemetry-grid">
      <div><span>本地时间</span><strong>{{ localTime }}</strong></div>
      <div><span>真太阳时</span><strong>{{ solarTime }}</strong></div>
      <div><span>太阳高度</span><strong>{{ position.elevation.toFixed(1) }}°</strong></div>
    </div>
  </section>
</template>

<style scoped>
.telemetry-panel { padding: 22px 0; border-block: 1px solid rgba(255,255,255,0.16); }
.panel-heading,
.location-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.panel-code { display: block; margin-bottom: 8px; color: rgba(255,255,255,0.34); font-size: 10px; letter-spacing: 0.24em; }
.panel-heading h2 { font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 26px; font-weight: 400; letter-spacing: 0.14em; }
.live-indicator { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.45); font-size: 10px; letter-spacing: 0.12em; }
.live-indicator i { width: 5px; height: 5px; border-radius: 50%; background: #f5f5f3; box-shadow: 0 0 12px rgba(255,255,255,0.75); animation: live-pulse 2s ease-in-out infinite; }
.location-console { padding: 14px 0 16px; border-top: 1px solid rgba(255,255,255,0.1); }
.location-row { align-items: flex-start; }
.location-copy { display: flex; min-width: 0; flex-direction: column; gap: 5px; }
.location-copy strong { font-size: 12px; font-weight: 500; }
.location-copy span { color: rgba(255,255,255,0.62); font-size: 12px; font-variant-numeric: tabular-nums; }
.location-row .btn { flex-shrink: 0; }
.location-editor { margin-top: 12px; padding: 10px 12px 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.018); }
.location-editor-heading { display: flex; justify-content: space-between; gap: 12px; color: rgba(255,255,255,0.58); font-size: 10px; letter-spacing: 0.16em; }
.location-editor-grid { display: grid; margin-top: 8px; grid-template-columns: 1fr 1fr auto; align-items: end; gap: 10px; }
.location-editor label { display: flex; min-width: 0; flex-direction: column; gap: 5px; color: rgba(255,255,255,0.62); font-size: 12px; }
.location-editor input { width: 100%; }
.location-note,
.location-status { margin-top: 9px; color: rgba(255,255,255,0.55); font-size: 12px; line-height: 1.7; }
.location-status { color: rgba(255,255,255,0.72); }
.telemetry-main { display: grid; margin: 22px 0 20px; grid-template-columns: 1.05fr 0.95fr; align-items: end; gap: 30px; }
.metric-label { color: rgba(255,255,255,0.36); font-size: 10px; letter-spacing: 0.18em; }
.azimuth-value { margin-top: 6px; font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif; font-size: clamp(56px, 5vw, 88px); font-weight: 300; font-variant-numeric: tabular-nums; letter-spacing: -0.065em; line-height: 1; }
.azimuth-value sup { margin-left: 4px; color: rgba(255,255,255,0.42); font-size: 0.28em; font-weight: 300; vertical-align: top; }
.azimuth-block p { margin-top: 8px; color: rgba(255,255,255,0.45); font-size: 11px; letter-spacing: 0.12em; }
.metric-rulers { display: flex; padding-bottom: 4px; flex-direction: column; gap: 18px; }
.ruler-label { display: flex; margin-bottom: 8px; justify-content: space-between; gap: 12px; color: rgba(255,255,255,0.38); font-size: 10px; letter-spacing: 0.1em; }
.ruler-track { height: 2px; background: rgba(255,255,255,0.1); }
.ruler-track i { display: block; height: 100%; background: rgba(255,255,255,0.8); box-shadow: 0 0 10px rgba(255,255,255,0.24); transition: width 800ms linear; }
.horizon-state { color: rgba(255,255,255,0.55); font-size: 11px; }
.telemetry-grid { display: grid; margin-bottom: 0; grid-template-columns: repeat(3, 1fr); border-block: 1px solid rgba(255,255,255,0.1); }
.telemetry-grid > div { display: flex; padding: 13px 12px; flex-direction: column; gap: 5px; }
.telemetry-grid > div:first-child { padding-left: 0; }
.telemetry-grid > div + div { border-left: 1px solid rgba(255,255,255,0.1); }
.telemetry-grid span { color: rgba(255,255,255,0.5); font-size: 12px; letter-spacing: 0.1em; }
.telemetry-grid strong { font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif; font-size: 17px; font-weight: 400; font-variant-numeric: tabular-nums; }

@keyframes live-pulse { 50% { opacity: 0.25; box-shadow: 0 0 4px rgba(255,255,255,0.25); } }

@media (max-width: 520px) {
  .telemetry-main { grid-template-columns: 1fr; gap: 20px; }
  .azimuth-value { font-size: 72px; }
  .telemetry-grid strong { font-size: 14px; }
  .location-row { align-items: flex-start; }
  .location-editor-grid { grid-template-columns: 1fr 1fr; }
  .location-editor-grid .btn { grid-column: 1 / -1; }
  .location-editor-heading span:first-child { letter-spacing: 0.12em; }
}

@media (prefers-reduced-motion: reduce) {
  .live-indicator i { animation: none; }
  .ruler-track i { transition: none; }
}
</style>
