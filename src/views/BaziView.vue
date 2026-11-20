<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { store, bazi } from '../store.js'
import { getBazi } from '../lib/calendar.js'

const form = reactive({
  calendar: store.profile?.calendar || 'solar',
  solarDate: '1995-01-01',
  lunarYear: 1995,
  lunarMonth: 1,
  lunarDay: 1,
  leap: false,
  time: '12:00',
  gender: ''
})
function syncForm(p) {
  if (!p) return
  form.calendar = p.calendar
  if (p.calendar === 'solar') {
    form.solarDate = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
  } else {
    form.lunarYear = p.year
    form.lunarMonth = p.month
    form.lunarDay = p.day
    form.leap = !!p.leap
  }
  form.time = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
  form.gender = p.gender || ''
}
syncForm(store.profile)
watch(() => store.profile, syncForm)

const error = ref('')
const chart = computed(() => bazi())

function submit() {
  error.value = ''
  const [hour, minute] = form.time.split(':').map(Number)
  let candidate
  if (form.calendar === 'solar') {
    const [year, month, day] = form.solarDate.split('-').map(Number)
    if (!year || !month || !day) { error.value = '请填写完整的出生日期'; return }
    candidate = { calendar: 'solar', year, month, day, hour, minute, gender: form.gender }
  } else {
    const { lunarYear: year, lunarMonth: month, lunarDay: day, leap } = form
    if (year < 1901 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 30) {
      error.value = '农历日期超出范围（1901-2099 年，月 1-12，日 1-30）'
      return
    }
    candidate = { calendar: 'lunar', year, month, day, leap, hour, minute, gender: form.gender }
  }
  try {
    getBazi(candidate)
    store.profile = candidate
  } catch {
    error.value = '该农历日期不存在（如小月无三十日，或闰月设置有误），请核对。'
  }
}

function clearProfile() {
  store.profile = null
}

const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
function shichen(h) {
  return SHICHEN[Math.floor(((h + 1) % 24) / 2)] + '时'
}
</script>

<template>
  <div class="bazi-view">
    <div class="card birth-card">
      <div class="card-title">录入生辰</div>
      <div class="row" style="margin-bottom: 12px">
        <label class="row"><input type="radio" value="solar" v-model="form.calendar"> 公历</label>
        <label class="row"><input type="radio" value="lunar" v-model="form.calendar"> 农历</label>
      </div>
      <div v-if="form.calendar === 'solar'" class="row" style="margin-bottom: 12px">
        <input type="date" v-model="form.solarDate" min="1901-01-01" max="2099-12-31">
      </div>
      <div v-else class="row" style="margin-bottom: 12px">
        <input type="number" v-model.number="form.lunarYear" min="1901" max="2099" style="width: 90px"> 年
        <input type="number" v-model.number="form.lunarMonth" min="1" max="12" style="width: 64px"> 月
        <input type="number" v-model.number="form.lunarDay" min="1" max="30" style="width: 64px"> 日
        <label class="row small"><input type="checkbox" v-model="form.leap"> 闰月</label>
      </div>
      <div class="row" style="margin-bottom: 12px">
        <input type="time" v-model="form.time">
        <span class="muted small">{{ shichen(Number(form.time.split(':')[0])) }}</span>
        <select v-model="form.gender">
          <option value="">性别（可选）</option>
          <option value="male">男</option>
          <option value="female">女</option>
        </select>
      </div>
      <p v-if="error" class="muted" style="color: var(--cinnabar); margin-bottom: 10px">{{ error }}</p>
      <div class="row">
        <button class="btn" @click="submit">排盘</button>
        <button v-if="store.profile" class="btn ghost" @click="clearProfile">清除生辰</button>
      </div>
      <p class="muted small" style="margin-top: 10px">生辰仅保存在你的浏览器本地，不会上传服务器（AI 解读时除外）。</p>
    </div>

    <template v-if="chart">
      <div class="card">
        <div class="card-title">四柱八字</div>
        <div class="pillar-grid" aria-label="四柱八字">
          <article
            v-for="(p, index) in chart.pillars"
            :key="p.label"
            class="pillar-card"
            :style="{ '--pillar-order': index }"
          >
            <h3 class="pillar-label">{{ p.label }}</h3>
            <div class="pillar-gz">{{ p.gz }}</div>
            <div class="pillar-wx">{{ p.wx }}</div>
            <div class="pillar-ny">{{ p.ny }}</div>
          </article>
        </div>
        <div class="chart-details">
          <div class="kv"><span class="k">日主</span><span>{{ chart.dayGan }}（{{ chart.dayMasterWuXing }}）· 属{{ chart.shengXiao }}</span></div>
          <div class="kv"><span class="k">农历</span><span>{{ chart.lunarText }} · 公历 {{ chart.solar.toYmd() }}</span></div>
          <div class="kv"><span class="k">胎元/命宫</span><span>{{ chart.taiYuan }} / {{ chart.mingGong }}（身宫 {{ chart.shenGong }}）</span></div>
          <div class="kv"><span class="k">日柱旬空</span><span>{{ chart.xunKong }}</span></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">五行分布</div>
        <div
          v-for="(n, wx, index) in chart.wxCount"
          :key="wx"
          class="wx-bar"
          :class="{ 'is-missing': n === 0 }"
          :style="{ '--wx-order': index }"
        >
          <span class="wx-label">{{ wx }}</span>
          <div
            class="track"
            role="progressbar"
            :aria-label="`${wx}行数量`"
            aria-valuemin="0"
            aria-valuemax="8"
            :aria-valuenow="n"
          >
            <div
              v-if="n > 0"
              class="fill"
              :class="'wx-' + wx"
              :style="{ width: (n / 8 * 100) + '%' }"
            ></div>
          </div>
          <span class="wx-count">{{ n }}</span>
        </div>
        <p class="muted small" style="margin-top: 10px">
          {{ chart.missingWuXing.length ? '八字五行缺：' + chart.missingWuXing.join('、') + '。民俗认为可通过方位、颜色等日常偏好调和，仅供趣谈。' : '五行俱全，气机周流。' }}
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bazi-view,
.bazi-view .card {
  min-width: 0;
}

.birth-card input,
.birth-card select {
  max-width: 100%;
}

.pillar-grid {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  perspective: 900px;
}

.pillar-card {
  display: flex;
  min-width: 0;
  min-height: 196px;
  padding: 16px 8px;
  align-items: center;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, oklch(0.96 0 0 / 0.035), transparent 70%), var(--paper-deep);
  text-align: center;
  backface-visibility: hidden;
  transform-origin: center bottom;
  animation: pillar-flip-in 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--pillar-order) * 90ms);
}

.pillar-label {
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.12em;
}

.pillar-gz {
  margin: 18px auto 14px;
  color: var(--ink);
  font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif;
  font-size: 28px;
  letter-spacing: 0.14em;
  line-height: 1;
  text-orientation: upright;
  writing-mode: vertical-rl;
}

.pillar-wx,
.pillar-ny {
  max-width: 100%;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.pillar-ny {
  margin-top: 4px;
  color: var(--muted);
}

.chart-details {
  min-width: 0;
  margin-top: 16px;
}

.chart-details .kv > span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}

.wx-bar {
  min-width: 0;
  padding: 8px 0;
  gap: 12px;
}

.wx-label {
  width: 24px;
  flex: 0 0 24px;
  color: var(--ink);
  font-size: 13px;
}

.wx-count {
  width: 20px;
  flex: 0 0 20px;
  color: var(--ink-soft);
  font-size: 12px;
  text-align: right;
}

.wx-bar .track {
  position: relative;
  height: 8px;
  min-width: 0;
  overflow: visible;
  border: 1px solid transparent;
  background: var(--paper-deep);
}

.wx-bar .fill {
  height: 100%;
  box-shadow: 0 0 7px oklch(0.96 0 0 / 0.08);
  transform-origin: left center;
  animation: wx-grow-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--wx-order) * 90ms);
}

.wx-bar.is-missing .track {
  border-color: var(--line-strong);
  border-style: dashed;
  background: transparent;
  box-shadow: 0 0 10px oklch(0.96 0 0 / 0.07), inset 0 0 8px oklch(0.96 0 0 / 0.035);
}

.wx-bar.is-missing .track::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, oklch(0.96 0 0 / 0.08), transparent);
  content: '';
  filter: blur(2px);
  pointer-events: none;
}

@keyframes pillar-flip-in {
  from {
    opacity: 0;
    transform: rotateY(-76deg) translateY(8px);
  }
  to {
    opacity: 1;
    transform: rotateY(0) translateY(0);
  }
}

@keyframes wx-grow-in {
  from {
    opacity: 0.35;
    transform: scaleX(0);
  }
  to {
    opacity: 1;
    transform: scaleX(1);
  }
}

@media (max-width: 480px) {
  .pillar-grid {
    gap: 6px;
  }

  .pillar-card {
    min-height: 184px;
    padding: 14px 4px;
  }

  .pillar-gz {
    margin-block: 16px 12px;
    font-size: 24px;
  }

  .wx-bar {
    gap: 8px;
  }
}

@media (max-width: 340px) {
  .pillar-grid {
    gap: 4px;
  }

  .pillar-card {
    padding-inline: 2px;
  }

  .pillar-gz {
    font-size: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pillar-card,
  .wx-bar .fill {
    opacity: 1;
    transform: none;
    animation: none;
  }
}
</style>