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
  <div>
    <div class="card">
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
        <table class="gz-table">
          <tbody>
          <tr><th v-for="p in chart.pillars" :key="p.label">{{ p.label }}</th></tr>
          <tr><td v-for="p in chart.pillars" :key="p.label" class="gz">{{ p.gz }}</td></tr>
          <tr><td v-for="p in chart.pillars" :key="p.label" class="muted small">{{ p.wx }}</td></tr>
          <tr><td v-for="p in chart.pillars" :key="p.label" class="muted small">{{ p.ny }}</td></tr>
          </tbody>
        </table>
        <div class="kv" style="margin-top: 10px"><span class="k">日主</span><span>{{ chart.dayGan }}（{{ chart.dayMasterWuXing }}）· 属{{ chart.shengXiao }}</span></div>
        <div class="kv"><span class="k">农历</span><span>{{ chart.lunarText }} · 公历 {{ chart.solar.toYmd() }}</span></div>
        <div class="kv"><span class="k">胎元/命宫</span><span>{{ chart.taiYuan }} / {{ chart.mingGong }}（身宫 {{ chart.shenGong }}）</span></div>
        <div class="kv"><span class="k">日柱旬空</span><span>{{ chart.xunKong }}</span></div>
      </div>

      <div class="card">
        <div class="card-title">五行分布</div>
        <div v-for="(n, wx) in chart.wxCount" :key="wx" class="wx-bar">
          <span style="width: 24px">{{ wx }}</span>
          <div class="track"><div class="fill" :class="'wx-' + wx" :style="{ width: (n / 8 * 100) + '%' }"></div></div>
          <span class="muted small" style="width: 20px">{{ n }}</span>
        </div>
        <p class="muted small" style="margin-top: 10px">
          {{ chart.missingWuXing.length ? '八字五行缺：' + chart.missingWuXing.join('、') + '。民俗认为可通过方位、颜色等日常偏好调和，仅供趣谈。' : '五行俱全，气机周流。' }}
        </p>
      </div>
    </template>
  </div>
</template>