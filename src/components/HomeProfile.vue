<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { bazi, store } from '../store.js'
import { getBazi } from '../lib/calendar.js'
import DateBar from './DateBar.vue'
import TimeCompass from './TimeCompass.vue'

const emit = defineEmits(['continue'])
const form = reactive({
  calendar: store.profile?.calendar || 'solar',
  solarDate: '',
  lunarYear: '',
  lunarMonth: '',
  lunarDay: '',
  leap: false,
  time: '',
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
  if (!form.time) {
    error.value = '请填写出生时间。'
    return
  }
  const [hour, minute] = form.time.split(':').map(Number)
  let candidate
  if (form.calendar === 'solar') {
    const [year, month, day] = form.solarDate.split('-').map(Number)
    if (!year || !month || !day) {
      error.value = '请填写完整的出生日期。'
      return
    }
    if (year < 1901 || year > 2099) {
      error.value = '出生日期超出支持范围（1901—2099）。'
      return
    }
    candidate = { calendar: 'solar', year, month, day, hour, minute, gender: form.gender }
  } else {
    const { lunarYear: year, lunarMonth: month, lunarDay: day, leap } = form
    if (year < 1901 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 30) {
      error.value = '农历日期超出支持范围，请核对后重试。'
      return
    }
    candidate = { calendar: 'lunar', year, month, day, leap, hour, minute, gender: form.gender }
  }
  try {
    getBazi(candidate)
    store.profile = candidate
    emit('continue')
  } catch {
    error.value = '该日期不存在，请核对农历日期与闰月设置。'
  }
}
</script>

<template>
  <section class="home-profile" aria-labelledby="profile-title">
    <div class="profile-heading">
      <div>
        <span class="profile-code">今日 / 起源</span>
        <h2 id="profile-title">校准你的时空</h2>
        <p>位置与生辰，在同一屏完成校准；资料仅保存在此浏览器。</p>
      </div>
      <div class="profile-tools">
        <DateBar />
        <a class="settings-link" href="#/settings">
          校准与设置<span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>

    <div class="profile-grid">
      <TimeCompass />
      <form class="birth-panel" novalidate @submit.prevent="submit">
        <div class="birth-heading">
          <span class="profile-code">生辰 / 本地档案</span>
          <h3>录入生辰</h3>
          <p>资料仅保存在此浏览器，只有主动生成智能解读时才会使用。</p>
        </div>

        <div class="calendar-choice" role="radiogroup" aria-label="历法">
          <label><input v-model="form.calendar" type="radio" value="solar">公历</label>
          <label><input v-model="form.calendar" type="radio" value="lunar">农历</label>
        </div>

        <label v-if="form.calendar === 'solar'" class="field">
          <span>出生日期</span>
          <input v-model="form.solarDate" type="date" min="1901-01-01" max="2099-12-31" required>
        </label>
        <div v-else class="lunar-fields">
          <label class="field"><span>年</span><input v-model.number="form.lunarYear" type="number" min="1901" max="2099" required></label>
          <label class="field"><span>月</span><input v-model.number="form.lunarMonth" type="number" min="1" max="12" required></label>
          <label class="field"><span>日</span><input v-model.number="form.lunarDay" type="number" min="1" max="30" required></label>
          <label class="leap-field"><input v-model="form.leap" type="checkbox">闰月</label>
        </div>

        <div class="birth-time-row">
          <label class="field"><span>出生时间</span><input v-model="form.time" type="time" required></label>
          <label class="field"><span>性别（可选）</span>
            <select v-model="form.gender">
              <option value="">不设置</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </label>
        </div>

        <div v-if="chart" class="chart-preview" aria-label="当前四柱">
          <span v-for="pillar in chart.pillars" :key="pillar.label">
            <small>{{ pillar.label }}</small>{{ pillar.gz }}
          </span>
        </div>
        <p v-if="error" class="birth-error" role="alert">{{ error }}</p>
        <div class="birth-actions">
          <button class="btn" type="submit">保存并展开命轨<span aria-hidden="true">↓</span></button>
          <button class="btn ghost" type="button" @click="emit('continue')">暂不录入，只看今日</button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.home-profile {
  max-width: 1600px;
  min-height: calc(100svh - var(--header-h));
  margin: 0 auto;
  padding: 38px 64px 46px;
  border-bottom: 1px solid var(--line);
  scroll-margin-top: var(--header-h);
}
.profile-heading { display: flex; margin-bottom: 26px; align-items: flex-end; justify-content: space-between; gap: 32px; }
.profile-code { display: block; color: var(--muted); font-size: 10px; letter-spacing: 0.24em; }
.profile-heading h2 { margin-top: 10px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: clamp(34px, 3.2vw, 48px); font-weight: 400; letter-spacing: 0.1em; line-height: 1.12; }
.profile-heading h2 + p { margin-top: 10px; color: var(--muted); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 12px; letter-spacing: 0.08em; line-height: 1.7; }
.profile-tools { display: flex; align-items: flex-end; flex-direction: column; gap: 8px; }
.profile-tools :deep(.date-bar) { margin-bottom: 0; }
.settings-link { display: inline-flex; min-height: 44px; padding: 0; align-items: center; gap: 14px; border: 0; background: transparent; color: var(--muted); cursor: pointer; font-size: 12px; letter-spacing: 0.1em; text-decoration: none; }
.settings-link:hover { color: var(--ink); }
.profile-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; gap: clamp(40px, 6vw, 96px); }
.profile-grid :deep(.telemetry-panel) { align-self: start; }
.birth-panel { padding: 20px 0; align-self: start; border-block: 1px solid var(--line-strong); }
.birth-heading { margin-bottom: 18px; }
.birth-heading h3 { margin-top: 8px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 24px; font-weight: 400; letter-spacing: 0.14em; }
.birth-heading p { margin-top: 8px; color: var(--muted); font-size: 10.5px; line-height: 1.65; }
.calendar-choice { display: flex; margin-bottom: 12px; gap: 24px; }
.calendar-choice label,
.leap-field { display: flex; min-height: 44px; align-items: center; gap: 8px; color: var(--ink-soft); font-size: 12px; }
.field { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 6px; color: var(--muted); font-size: 12px; letter-spacing: 0.08em; }
.field input,
.field select { width: 100%; }
.lunar-fields { display: grid; grid-template-columns: 1.2fr 0.8fr 0.8fr auto; align-items: end; gap: 10px; }
.birth-time-row { display: flex; margin-top: 12px; gap: 10px; }
.chart-preview { display: grid; margin-top: 16px; grid-template-columns: repeat(4, 1fr); border-block: 1px solid var(--line); }
.chart-preview span { display: flex; padding: 12px 6px; align-items: center; flex-direction: column; gap: 5px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 20px; }
.chart-preview span + span { border-left: 1px solid var(--line); }
.chart-preview small { color: var(--muted); font-family: 'DM Sans', sans-serif; font-size: 10px; }
.birth-error { margin-top: 10px; color: var(--ink); font-size: 12px; }
.birth-actions { display: flex; margin-top: 18px; flex-wrap: wrap; gap: 10px; }

@media (max-width: 900px) {
  .home-profile { min-height: calc(100svh - var(--header-h)); padding: 30px 28px 54px; }
  .profile-heading { margin-bottom: 28px; align-items: flex-start; flex-direction: column; gap: 22px; }
  .profile-tools { width: 100%; align-items: flex-start; }
  .profile-grid { grid-template-columns: 1fr; gap: 38px; }
  .birth-panel { order: -1; }
}
@media (max-width: 520px) {
  .home-profile { padding: 24px 22px 48px; }
  .profile-heading h2 { font-size: 36px; }
  .lunar-fields { grid-template-columns: 1.2fr 0.8fr 0.8fr; }
  .leap-field { grid-column: 1 / -1; }
  .birth-time-row { flex-direction: column; }
  .birth-actions { align-items: stretch; flex-direction: column; }
}
</style>
