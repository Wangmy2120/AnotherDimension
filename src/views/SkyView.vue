<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import DateBar from '../components/DateBar.vue'
import { openAi, store } from '../store.js'
import { describePosition, formatClock, getNightForecast, getSkyMoment } from '../lib/sky.js'
import { formatSolarTime, getTrueSolarTime } from '../lib/solar.js'

const DEG = Math.PI / 180
const CHART = { size: 440, cx: 220, cy: 220, radius: 168 }

function project(azimuth, altitude) {
  const radius = (90 - Math.max(0, Math.min(90, altitude))) / 90 * CHART.radius
  return {
    x: CHART.cx - radius * Math.sin(azimuth * DEG),
    y: CHART.cy - radius * Math.cos(azimuth * DEG)
  }
}

function starRadius(magnitude) {
  return Math.max(1.1, Math.min(4.6, 3.2 - magnitude * 0.75))
}

/** 照明面以外半圆为界，再串一条长短轴随相位收放的椭圆弧。 */
function moonLitPath(radius, illumination, waxing) {
  const value = Math.max(0.002, Math.min(0.998, illumination))
  const semi = Math.abs(1 - 2 * value) * radius
  const outer = waxing ? 1 : 0
  const inner = waxing ? (value > 0.5 ? 1 : 0) : (value > 0.5 ? 0 : 1)
  return `M 0 ${-radius} A ${radius} ${radius} 0 0 ${outer} 0 ${radius} A ${semi.toFixed(2)} ${radius} 0 0 ${inner} 0 ${-radius} Z`
}

const now = ref(new Date())
const locating = ref(false)
const locationStatus = ref('')
const draft = reactive({ latitude: String(store.location.latitude), longitude: String(store.location.longitude) })
let timer

const location = store.location
const moment = computed(() => getSkyMoment(now.value, location.latitude, location.longitude))
const forecast = computed(() => getNightForecast(store.dateStr, location.latitude, location.longitude))
const score = computed(() => moment.value.score)
const sun = computed(() => moment.value.bodies.find(body => body.key === 'sun'))
const moon = computed(() => moment.value.moon)
const planets = computed(() => moment.value.bodies.filter(body => body.kind === 'planet'))
const stars = computed(() => moment.value.bodies.filter(body => body.kind === 'star').sort((a, b) => b.elevation - a.elevation))
const localClock = computed(() => now.value.toLocaleTimeString('zh-CN', { hour12: false }))
const solarClock = computed(() => formatSolarTime(getTrueSolarTime(now.value, location.longitude)))
const sourceLabel = computed(() => ({ default: '默认位置 · 北京', gps: '浏览器定位', manual: '手动位置' })[location.source])
const coordinateText = computed(() => {
  const lat = `${location.latitude >= 0 ? '北纬' : '南纬'} ${Math.abs(location.latitude).toFixed(4)}°`
  const lon = `${location.longitude >= 0 ? '东经' : '西经'} ${Math.abs(location.longitude).toFixed(4)}°`
  return `${lat} · ${lon}`
})

const spokes = computed(() => {
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return [0, 45, 90, 135, 180, 225, 270, 315].map((azimuth, index) => {
    const angle = azimuth * DEG
    const span = CHART.radius * (index % 2 ? 1.045 : 1.115)
    return {
      azimuth,
      x2: CHART.cx - CHART.radius * Math.sin(angle),
      y2: CHART.cy - CHART.radius * Math.cos(angle),
      x: CHART.cx - span * Math.sin(angle),
      y: CHART.cy - span * Math.cos(angle),
      label: labels[index]
    }
  })
})
const altitudeRings = [30, 60].map(altitude => ({ altitude, radius: (90 - altitude) / 90 * CHART.radius }))
const eclipticLines = computed(() => moment.value.eclipticPath.map(segment => segment
  .map(point => {
    const projected = project(point.azimuth, point.elevation)
    return `${projected.x.toFixed(1)},${projected.y.toFixed(1)}`
  }).join(' ')))
/** 标注按「日月 → 行星 → 亮星」优先占位，撞框则换侧，换侧仍挤则不标，避免星名堆叠。 */
const plotItems = computed(() => {
  const priority = { sun: 0, moon: 1, planet: 2, star: 3 }
  const placed = []
  const bodies = moment.value.bodies
    .filter(body => body.elevation > -0.3)
    .sort((a, b) => priority[a.kind] - priority[b.kind] || a.magnitude - b.magnitude)
  return bodies.map(body => {
    const point = project(body.azimuth, Math.max(0, body.elevation))
    const radius = body.kind === 'sun' ? 9 : body.kind === 'moon' ? 6.4 : starRadius(body.magnitude)
    const name = body.name.split('·')[0]
    const width = name.length * 10 + 3
    const options = [
      { x: point.x + radius + 5, anchor: 'start' },
      { x: point.x - radius - 5, anchor: 'end' }
    ].map(option => ({
      ...option,
      left: option.anchor === 'start' ? option.x : option.x - width,
      right: option.anchor === 'start' ? option.x + width : option.x
    }))
    const chosen = options.find(option => option.left > 4 && option.right < CHART.size - 4
      && placed.every(rect => rect.bottom <= point.y - 9 || rect.top >= point.y + 3
        || rect.right <= option.left || option.right <= rect.left))
    if (chosen) placed.push({ left: chosen.left, right: chosen.right, top: point.y - 9, bottom: point.y + 3 })
    return {
      key: body.key || body.name,
      kind: body.kind,
      x: point.x,
      y: point.y,
      radius,
      name,
      textX: chosen?.x ?? point.x,
      textY: point.y + 3,
      anchor: chosen?.anchor ?? 'start',
      showLabel: Boolean(chosen),
      tip: `${body.name} · ${describePosition(body)}`
    }
  })
})
const moonDisc = computed(() => moonLitPath(52, moon.value.illumination, moon.value.waxing))

const nightRows = computed(() => {
  const { arcs, sunset, sunrise } = forecast.value
  const from = sunset ? sunset.getTime() : new Date(`${store.dateStr}T12:00:00`).getTime()
  const to = sunrise ? sunrise.getTime() : from + 43200000
  const rows = []
  for (const item of arcs) {
    if (item.kind === 'star' || item.arc.neverUp) continue
    if (!item.arc.circumpolar) {
      if (item.arc.rise) rows.push({ time: item.arc.rise, name: item.name, kind: item.kind, event: '升起' })
      if (item.arc.set) rows.push({ time: item.arc.set, name: item.name, kind: item.kind, event: '落下' })
    }
    rows.push({ time: item.arc.transit, name: item.name, kind: item.kind, event: '中天', note: `最高 ${item.arc.peak.toFixed(0)}°` })
  }
  return rows
    .filter(row => row.time.getTime() >= from && row.time.getTime() <= to)
    .sort((a, b) => a.time - b.time)
})

function locate() {
  locationStatus.value = ''
  if (!navigator.geolocation) {
    locationStatus.value = '当前浏览器不支持定位，请手动输入经纬度。'
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
    locationStatus.value = '星图已按当前位置重绘。'
  }, () => {
    locating.value = false
    locationStatus.value = '未能获取定位，星图继续使用原有坐标。'
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
}

function applyManualLocation() {
  const latitude = Number(draft.latitude)
  const longitude = Number(draft.longitude)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    locationStatus.value = '请输入有效范围：纬度 -90 至 90，经度 -180 至 180。'
    return
  }
  location.latitude = latitude
  location.longitude = longitude
  location.source = 'manual'
  locationStatus.value = '坐标已应用，星图与今夜轨迹同步更新。'
}

function openSkyReading() {
  const current = moment.value
  store.skySession = {
    dateStr: store.dateStr,
    clock: localClock.value,
    location: { latitude: location.latitude, longitude: location.longitude, source: location.source },
    score: { total: current.score.total, label: current.score.label, darkness: current.score.darknessLabel },
    sun: { azimuth: +current.sun.azimuth.toFixed(1), elevation: +current.sun.elevation.toFixed(1) },
    moon: {
      phase: current.moon.phaseName,
      hint: current.moon.phaseHint,
      illumination: Math.round(current.moon.illumination * 100),
      elevation: +current.moon.elevation.toFixed(1),
      direction: current.moon.direction,
      distance: Math.round(current.moon.distance)
    },
    planets: planets.value.map(planet => ({
      名称: planet.name,
      高度: +planet.elevation.toFixed(1),
      方位: planet.direction,
      星等: +planet.magnitude.toFixed(1),
      距日: +planet.elongation.toFixed(0),
      提示: planet.note
    })),
    stars: current.visible
      .filter(body => body.kind === 'star')
      .sort((a, b) => b.elevation - a.elevation)
      .slice(0, 10)
      .map(star => ({ 星名: star.name, 宿: star.mansion || star.symbol, 高度: +star.elevation.toFixed(1), 方位: star.direction })),
    events: nightRows.value.slice(0, 14).map(row => ({ 时刻: formatClock(row.time), 天体: row.name, 事件: row.event, 备注: row.note || '' }))
  }
  openAi('sky')
}

onMounted(() => {
  timer = window.setInterval(() => { now.value = new Date() }, 1000)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="sky-view">
    <DateBar />

    <section class="card chart-card" aria-labelledby="chart-title">
      <div class="section-heading">
        <h2 id="chart-title" class="card-title">星空罗盘</h2>
        <span class="section-note">{{ localClock }} · 北在上 东在左</span>
      </div>
      <svg
        class="compass"
        :viewBox="`0 0 ${CHART.size} ${CHART.size}`"
        role="img"
        :aria-label="`星空方位图：圆心为天顶，外圈为地平线，此刻有 ${moment.visible.length} 个目标升起`"
      >
        <g class="grid">
          <circle class="rim" :cx="CHART.cx" :cy="CHART.cy" :r="CHART.radius" />
          <circle
            v-for="ring in altitudeRings"
            :key="ring.altitude"
            class="ring"
            :cx="CHART.cx"
            :cy="CHART.cy"
            :r="ring.radius"
          />
          <line v-for="spoke in spokes" :key="spoke.azimuth" class="spoke" :x1="CHART.cx" :y1="CHART.cy" :x2="spoke.x2" :y2="spoke.y2" />
          <text v-for="ring in altitudeRings" :key="`label-${ring.altitude}`" class="grid-text" :x="CHART.cx + 4" :y="CHART.cy - ring.radius + 10">{{ ring.altitude }}°</text>
          <text v-for="spoke in spokes" :key="`dir-${spoke.azimuth}`" class="grid-text is-direction" :x="spoke.x" :y="spoke.y + 4" text-anchor="middle">{{ spoke.label }}</text>
        </g>
        <g class="ecliptic">
          <polyline v-for="(points, index) in eclipticLines" :key="index" :points="points" />
        </g>
        <g class="bodies">
          <g v-for="item in plotItems" :key="item.key" class="plot" :class="`is-${item.kind}`">
            <circle :cx="item.x" :cy="item.y" :r="item.radius" />
            <text v-if="item.showLabel" class="plot-label" :x="item.textX" :y="item.textY" :text-anchor="item.anchor">{{ item.name }}</text>
            <title>{{ item.tip }}</title>
          </g>
        </g>
      </svg>
      <p class="chart-legend muted small">
        <i class="legend-sun"></i>太阳
        <i class="legend-moon"></i>月亮
        <i class="legend-planet"></i>行星
        <i class="legend-star"></i>亮星（点径随亮度）
        <i class="legend-line"></i>黄道
      </p>
      <p class="card-footnote muted small">圆心即天顶，外圈即地平线；本图为抬头仰视，故东在左、西在右。位置与亮度由本机近似算法推算，供观星参考。</p>
    </section>

    <section class="card" aria-labelledby="reading-title">
      <div class="section-heading">
        <h2 id="reading-title" class="card-title">观测读数</h2>
        <span class="section-note">{{ score.label }}</span>
      </div>
      <div class="reading-top">
        <div class="score-block">
          <span class="score-ring">{{ score.total }}</span>
          <span class="muted small">/ 100 暗夜指数</span>
        </div>
        <ul class="meters">
          <li v-for="factor in score.factors" :key="factor.name">
            <div class="meter-line"><span>{{ factor.name }}</span><strong>{{ factor.value }}</strong></div>
            <div class="meter-track"><i :style="{ width: `${factor.value}%` }"></i></div>
            <span class="muted small">{{ factor.note }}</span>
          </li>
        </ul>
      </div>
      <div class="kv"><span class="k">此刻</span><span>{{ localClock }} · 真太阳时 {{ solarClock }} · 太阳 {{ sun.elevation.toFixed(1) }}°（{{ sun.direction }}）</span></div>
      <div class="kv"><span class="k">昏影</span><span>日落 {{ formatClock(forecast.sunset) }} → 天文黑天 {{ formatClock(forecast.darkStart) }}；黑天尽于 {{ formatClock(forecast.darkEnd) }}，日出 {{ formatClock(forecast.sunrise) }}</span></div>
      <div class="kv"><span class="k">月况</span><span>{{ moon.phaseName }} · 照明 {{ Math.round(moon.illumination * 100) }}% · {{ moon.elevation > 0 ? `天上 ${moon.elevation.toFixed(0)}°` : '地平线下' }}</span></div>
      <div class="kv"><span class="k">位置</span><span>{{ sourceLabel }} · {{ coordinateText }}</span></div>
      <button class="btn block ai-trigger" type="button" @click="openSkyReading">智能观星解读</button>
    </section>

    <section class="card moon-card" aria-labelledby="moon-title">
      <h2 id="moon-title" class="card-title">月相</h2>
      <div class="moon-layout">
        <svg class="moon-disc" viewBox="-64 -64 128 128" role="img" :aria-label="`${moon.phaseName}，照明度 ${Math.round(moon.illumination * 100)}%`">
          <circle class="moon-body" cx="0" cy="0" r="52" />
          <path class="moon-lit" :d="moonDisc" />
          <circle class="moon-rim" cx="0" cy="0" r="52" />
        </svg>
        <div class="moon-facts">
          <p class="moon-name">{{ moon.phaseName }}<span class="muted small">{{ moon.waxing ? '盈' : '亏' }}</span></p>
          <p class="muted">{{ moon.phaseHint }}</p>
          <div class="grid2">
            <div class="kv"><span class="k">照明</span><span>{{ (moon.illumination * 100).toFixed(1) }}%</span></div>
            <div class="kv"><span class="k">距日</span><span>{{ moon.elongation.toFixed(1) }}°</span></div>
            <div class="kv"><span class="k">地月距离</span><span>{{ moon.distance.toFixed(0) }} 千米</span></div>
            <div class="kv"><span class="k">视差</span><span>{{ (moon.parallax * 3600).toFixed(0) }}″</span></div>
            <div class="kv"><span class="k">地平</span><span>{{ describePosition(moon) }}</span></div>
            <div class="kv"><span class="k">黄道经</span><span>{{ moon.eclipticLongitude.toFixed(1) }}°</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="card" aria-labelledby="events-title">
      <div class="section-heading">
        <h2 id="events-title" class="card-title">今夜事件</h2>
        <span class="section-note">{{ store.dateStr }} 夜</span>
      </div>
      <table v-if="nightRows.length" class="sky-table">
        <thead><tr><th>时刻</th><th>天体</th><th>事件</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in nightRows" :key="`${row.name}-${row.event}-${index}`" :class="{ 'is-day': row.kind === 'sun' }">
            <td class="tabular">{{ formatClock(row.time) }}</td>
            <td>{{ row.name }}</td>
            <td class="muted">{{ row.note ? `${row.event} · ${row.note}` : row.event }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">今夜太阳不没落，无升降记录；请更换日期或查看极昼说明。</p>
    </section>

    <section class="card" aria-labelledby="planets-title">
      <div class="section-heading">
        <h2 id="planets-title" class="card-title">行星一览</h2>
        <span class="section-note">距角自太阳起算</span>
      </div>
      <div v-for="planet in planets" :key="planet.key" class="body-row">
        <div class="body-main">
          <strong>{{ planet.name }}</strong>
          <span class="muted small">{{ planet.magnitude.toFixed(1) }} 等 · 距日 {{ planet.elongation.toFixed(0) }}° · 地距 {{ planet.earthDistance.toFixed(2) }} 天文单位</span>
        </div>
        <div class="body-state" :class="{ 'is-up': planet.elevation > 0 }">
          <span class="tabular">{{ planet.elevation.toFixed(1) }}°</span>
          <span class="muted small">{{ planet.direction }}</span>
        </div>
        <p class="body-note muted small">{{ planet.note }}</p>
      </div>
    </section>

    <section class="card" aria-labelledby="stars-title">
      <div class="section-heading">
        <h2 id="stars-title" class="card-title">亮星清单</h2>
        <span class="section-note">按高度排序 · 已升起 {{ stars.filter(item => item.up).length }} / {{ stars.length }}</span>
      </div>
      <div class="star-grid">
        <div v-for="star in stars" :key="star.name" class="star-cell" :class="{ 'is-down': !star.up }">
          <span class="star-name-cell">{{ star.name }}</span>
          <span class="muted small">{{ star.asterism || star.symbol }} · {{ star.mansion ? `${star.mansion}宿` : star.symbol }}</span>
          <span class="star-alt tabular">{{ star.elevation > -0.5 ? `${star.elevation.toFixed(0)}°` : '线下' }}</span>
          <span class="muted small">{{ star.direction }} · {{ star.magnitude.toFixed(2) }} 等</span>
        </div>
      </div>
      <p class="card-footnote muted small">星表取公元 2000 年历元视位置，按总岁差平移到当日；星名与二十八宿归属并列，仅作文化索引。</p>
    </section>

    <section class="card" aria-labelledby="location-title">
      <div class="section-heading">
        <h2 id="location-title" class="card-title">位置校准</h2>
        <span class="section-note">{{ sourceLabel }}</span>
      </div>
      <div class="kv"><span class="k">当前坐标</span><span>{{ coordinateText }}</span></div>
      <div class="row location-actions">
        <button class="btn ghost small" type="button" :disabled="locating" @click="locate">{{ locating ? '定位中…' : '使用当前位置' }}</button>
        <span class="muted small">经纬度仅保存在本次会话，星图计算全部在本机完成。</span>
      </div>
      <form class="location-editor" novalidate @submit.prevent="applyManualLocation">
        <label>纬度
          <input v-model="draft.latitude" type="number" inputmode="decimal" min="-90" max="90" step="0.0001" required>
        </label>
        <label>经度
          <input v-model="draft.longitude" type="number" inputmode="decimal" min="-180" max="180" step="0.0001" required>
        </label>
        <button class="btn ghost small" type="submit">应用坐标</button>
      </form>
      <p v-if="locationStatus" class="location-status muted small" role="status">{{ locationStatus }}</p>
    </section>
  </div>
</template>

<style scoped>
.sky-view { min-width: 0; }
.sky-view .card { min-width: 0; }
.section-heading { display: flex; margin-bottom: 18px; align-items: center; justify-content: space-between; gap: 16px; }
.section-heading .card-title { margin-bottom: 0; }
.section-note { color: var(--muted); font-size: 10px; letter-spacing: 0.16em; }
.tabular { font-variant-numeric: tabular-nums; }

.chart-card { text-align: center; }
.compass { display: block; width: 100%; max-width: 440px; margin: 0 auto; color: oklch(0.94 0 0); overflow: visible; }
.grid { color: oklch(0.94 0 0); }
.rim { fill: oklch(0.97 0 0 / 0.02); stroke: currentColor; stroke-width: 0.8; opacity: 0.5; }
.ring { fill: none; stroke: currentColor; stroke-width: 0.6; stroke-dasharray: 3 5; opacity: 0.22; }
.spoke { stroke: currentColor; stroke-width: 0.5; opacity: 0.14; }
.grid-text { fill: currentColor; font-size: 9px; letter-spacing: 0.1em; opacity: 0.5; }
.is-direction { font-size: 11px; opacity: 0.72; }
.ecliptic polyline { fill: none; stroke: currentColor; stroke-width: 0.9; stroke-dasharray: 6 4; opacity: 0.4; }
.plot.is-sun circle { fill: currentColor; filter: drop-shadow(0 0 14px oklch(0.97 0 0 / 0.85)); }
.plot.is-moon circle { fill: currentColor; filter: drop-shadow(0 0 9px oklch(0.97 0 0 / 0.6)); }
.plot.is-planet circle { fill: none; stroke: currentColor; stroke-width: 1.4; opacity: 0.95; }
.plot.is-star circle { fill: currentColor; opacity: 0.82; }
.plot-label { fill: currentColor; font-size: 9.5px; letter-spacing: 0.06em; opacity: 0.72; }
.chart-legend { display: flex; margin-top: 16px; flex-wrap: wrap; justify-content: center; gap: 8px 16px; }
.chart-legend i { display: inline-block; width: 9px; height: 9px; margin-right: 6px; border-radius: 50%; vertical-align: middle; background: currentColor; }
.chart-legend { color: var(--muted); }
.legend-sun { box-shadow: 0 0 8px oklch(0.97 0 0 / 0.6); }
.legend-moon { width: 8px; height: 8px; opacity: 0.75; }
.legend-planet { background: transparent; border: 1.2px solid currentColor; }
.legend-star { width: 5px; height: 5px; opacity: 0.6; }
.legend-line { width: 16px; height: 0; border-radius: 0; border-top: 1px dashed currentColor; }

.reading-top { display: grid; margin-bottom: 18px; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 28px; }
.score-block { display: flex; flex-direction: column; }
.meters { display: grid; gap: 13px; }
.meters li { display: grid; gap: 5px; }
.meter-line { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; letter-spacing: 0.08em; }
.meter-line strong { font-weight: 400; font-variant-numeric: tabular-nums; }
.meter-track { height: 2px; background: oklch(0.97 0 0 / 0.1); }
.meter-track i { display: block; height: 100%; background: var(--glow); box-shadow: 0 0 10px oklch(0.97 0 0 / 0.3); transition: width 600ms ease; }
.ai-trigger { margin-top: 22px; }

.moon-layout { display: grid; grid-template-columns: 132px minmax(0, 1fr); align-items: center; gap: 26px; }
.moon-disc { width: 132px; height: 132px; color: oklch(0.94 0 0); }
.moon-body { fill: oklch(0.97 0 0 / 0.05); }
.moon-lit { fill: currentColor; opacity: 0.92; filter: drop-shadow(0 0 12px oklch(0.97 0 0 / 0.28)); }
.moon-rim { fill: none; stroke: currentColor; stroke-width: 0.7; opacity: 0.45; }
.moon-name { display: flex; align-items: baseline; gap: 10px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 24px; letter-spacing: 0.14em; }
.moon-facts > .muted { margin: 8px 0 16px; line-height: 1.9; }

.sky-table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; }
.sky-table th { padding: 8px 6px; color: var(--muted); font-weight: 400; letter-spacing: 0.12em; border-bottom: 1px solid var(--line); }
.sky-table td { padding: 9px 6px; border-bottom: 1px dashed var(--line); }
.sky-table tr:last-child td { border-bottom: none; }
.sky-table tr.is-day td { opacity: 0.55; }

.body-row { display: grid; padding: 12px 0; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 16px; border-bottom: 1px dashed var(--line); }
.body-row:last-child { border-bottom: none; }
.body-main { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.body-main strong { font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 15px; font-weight: 400; letter-spacing: 0.12em; }
.body-state { display: flex; align-items: baseline; gap: 8px; justify-self: end; font-size: 14px; }
.body-state.is-up span:first-child { color: var(--glow); }
.body-note { grid-column: 1 / -1; line-height: 1.8; }

.star-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 8px; }
.star-cell { display: flex; min-width: 0; padding: 10px 11px; flex-direction: column; gap: 3px; border: 1px solid var(--line); background: oklch(0.97 0 0 / 0.02); }
.star-cell.is-down { opacity: 0.42; }
.star-name-cell { font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 14px; letter-spacing: 0.08em; }
.star-alt { font-size: 14px; font-variant-numeric: tabular-nums; }
.star-cell .muted { overflow-wrap: anywhere; }

.location-actions { margin: 16px 0 12px; }
.location-editor { display: grid; padding: 12px; grid-template-columns: 1fr 1fr auto; align-items: end; gap: 10px; border: 1px solid var(--line); background: oklch(0.97 0 0 / 0.018); }
.location-editor label { display: flex; flex-direction: column; gap: 5px; color: var(--muted); font-size: 12px; }
.location-editor input { width: 100%; }
.location-status { margin-top: 10px; }

@media (max-width: 760px) {
  .reading-top { grid-template-columns: 1fr; gap: 18px; }
  .moon-layout { grid-template-columns: 1fr; justify-items: start; gap: 18px; }
  .location-editor { grid-template-columns: 1fr 1fr; }
  .location-editor .btn { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) {
  .meter-track i { transition: none; }
}
</style>
