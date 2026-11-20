<script setup>
import { ref, computed } from 'vue'
import { store, bazi } from '../store.js'
import { getDayInfo, todayStr } from '../lib/calendar.js'

const EVENTS = [
  { name: '嫁娶', icon: '🏮', terms: ['嫁娶', '订婚', '纳采'] },
  { name: '搬家', icon: '🏠', terms: ['入宅', '移徙'] },
  { name: '开业', icon: '🧧', terms: ['开市', '开张', '开业', '立券', '交易'] },
  { name: '出行', icon: '🧳', terms: ['出行'] },
  { name: '签约', icon: '📜', terms: ['立券', '交易', '纳财'] },
  { name: '动土', icon: '⛏️', terms: ['动土', '修造', '起基', '上梁'] },
  { name: '祈福', icon: '🙏', terms: ['祈福', '祭祀'] },
  { name: '安床', icon: '🛏️', terms: ['安床'] },
  { name: '理发', icon: '✂️', terms: ['理发', '剃头'] },
  { name: '入学', icon: '🎓', terms: ['入学'] }
]

const event = ref(EVENTS[0])
const range = ref(30)
const avoidChong = ref(true)

const profileBazi = computed(() => bazi())

const results = computed(() => {
  const base = new Date(todayStr() + 'T00:00:00')
  const sx = profileBazi.value?.shengXiao
  const out = []
  for (let i = 0; i < range.value; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const info = getDayInfo(ds)
    const matched = event.value.terms.filter(t => info.yi.includes(t))
    if (!matched.length) continue
    const chongMe = sx && info.chong.endsWith(sx)
    if (avoidChong.value && chongMe) continue
    out.push({ info, matched, chongMe })
  }
  return out
})

function gotoDay(ds) {
  store.dateStr = ds
  store.tabRequest = 'almanac'
}
</script>

<template>
  <div>
    <div class="card">
      <div class="card-title">择吉日</div>
      <p class="muted" style="line-height: 1.9; margin-bottom: 12px">
        选定要办的事，为你扫描未来宜此事项的吉日。民俗择吉仅供参考，重要日子还请结合实际安排。
      </p>
      <div class="row" style="margin-bottom: 12px">
        <button v-for="e in EVENTS" :key="e.name" class="btn ghost small"
          :style="event.name === e.name ? 'background: var(--cinnabar); color: #fff8ee' : ''"
          style="padding: 5px 12px" @click="event = e">{{ e.icon }} {{ e.name }}</button>
      </div>
      <div class="row">
        <span class="muted">范围</span>
        <button v-for="r in [30, 60, 90]" :key="r" class="btn ghost small"
          :style="range === r ? 'background: var(--gold); color: #fff8ee; border-color: var(--gold)' : ''"
          style="padding: 4px 12px" @click="range = r">{{ r }} 天</button>
        <label v-if="profileBazi" class="row small muted" style="margin-left: auto">
          <input type="checkbox" v-model="avoidChong"> 避开冲我生肖（{{ profileBazi.shengXiao }}）
        </label>
      </div>
    </div>

    <div class="card">
      <div class="card-title">宜「{{ event.name }}」的吉日 · {{ results.length }} 天</div>
      <p v-if="!results.length" class="muted" style="line-height: 1.9">
        未来 {{ range }} 天内未寻得宜「{{ event.name }}」之日，可扩大范围再试。
      </p>
      <div v-for="r in results" :key="r.info.dateStr" class="kv" style="cursor: pointer; align-items: flex-start" @click="gotoDay(r.info.dateStr)">
        <div style="min-width: 118px">
          <div style="font-size: 15px">{{ r.info.dateStr.slice(5).replace('-', '月') }}日 <span class="muted small">周{{ r.info.week }}</span></div>
          <div class="muted small">{{ r.info.lunar.getMonthInChinese() }}月{{ r.info.lunar.getDayInChinese() }} · {{ r.info.dayGanZhi }}日</div>
        </div>
        <div style="flex: 1">
          <span v-for="t in r.matched" :key="t" class="tag yi small" style="margin: 1px 3px 1px 0">{{ t }}</span>
          <div class="muted small" style="margin-top: 3px">冲{{ r.info.chong }} · 煞{{ r.info.sha }}</div>
        </div>
        <span class="muted small" style="align-self: center">详情 ›</span>
      </div>
      <p v-if="results.length" class="muted small" style="margin-top: 10px">点击任意吉日可跳转黄历详情。吉日依传统历法宜忌推得，仅供民俗参考。</p>
    </div>
  </div>
</template>