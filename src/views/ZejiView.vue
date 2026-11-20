<script setup>
import { ref, computed, defineComponent, h } from 'vue'
import { store, bazi } from '../store.js'
import { getDayInfo, todayStr } from '../lib/calendar.js'

const EVENTS = [
  { name: '嫁娶', icon: 'lantern', terms: ['嫁娶', '订婚', '纳采'] },
  { name: '搬家', icon: 'home', terms: ['入宅', '移徙'] },
  { name: '开业', icon: 'store', terms: ['开市', '开张', '开业', '立券', '交易'] },
  { name: '出行', icon: 'journey', terms: ['出行'] },
  { name: '签约', icon: 'contract', terms: ['立券', '交易', '纳财'] },
  { name: '动土', icon: 'ground', terms: ['动土', '修造', '起基', '上梁'] },
  { name: '祈福', icon: 'blessing', terms: ['祈福', '祭祀'] },
  { name: '安床', icon: 'bed', terms: ['安床'] },
  { name: '理发', icon: 'scissors', terms: ['理发', '剃头'] },
  { name: '入学', icon: 'study', terms: ['入学'] }
]

const ICON_PATHS = {
  lantern: 'M8 3h8M9 6h6M7 9h10v7H7zM9 16v3M15 16v3M12 1v2M12 19v2M9 12h6',
  home: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10M9.5 20v-6h5v6',
  store: 'M4 9h16M5 9v11h14V9M3 9l2-5h14l2 5M9 20v-6h6v6M8 4v5M16 4v5',
  journey: 'M7 7h10a2 2 0 0 1 2 2v11H5V9a2 2 0 0 1 2-2zM9 7V4h6v3M7 20v1M17 20v1M9 11h6M12 11v5',
  contract: 'M6 3h9l3 3v15H6zM15 3v4h4M9 12h6M9 16h4M4 7v15',
  ground: 'M14 4l6 6M4 20 16 8M3 8c5-5 13-5 18 0M8 5 5 9M16 5l3 4',
  blessing: 'M12 3v7M8 5l2 4M16 5l-2 4M5 14h14M7 14v6h10v-6M9 17h6',
  bed: 'M3 19V6M3 15h18v4M7 15v-5h5a4 4 0 0 1 4 4v1M3 19h18M7 19v2M19 19v2',
  scissors: 'M8 8l12 12M20 8 8 20M7 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM23 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  study: 'M3 9l9-5 9 5-9 5zM7 12v4c3 2 7 2 10 0v-4M21 9v6'
}

const EventIcon = defineComponent({
  name: 'EventIcon',
  props: { name: { type: String, default: 'contract' } },
  setup(props) {
    return () => h('svg', {
      class: 'event-icon',
      width: 18,
      height: 18,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.45,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    }, [h('path', { d: ICON_PATHS[props.name] || ICON_PATHS.contract })])
  }
})

const event = ref(EVENTS[0])
const range = ref(30)
const avoidChong = ref(true)

const profileBazi = computed(() => bazi())
const resultKey = computed(() => [
  event.value.name,
  range.value,
  avoidChong.value,
  profileBazi.value?.shengXiao || 'none'
].join(':'))

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
  <div class="zeji-view">
    <section class="card filter-card" aria-labelledby="zeji-title">
      <div class="filter-heading">
        <div>
          <span class="eyebrow">择事 · 观日 · 避冲</span>
          <div id="zeji-title" class="card-title">择吉日</div>
        </div>
        <span class="scan-note">未来 {{ range }} 天</span>
      </div>
      <p class="muted intro">
        选定要办的事，为你扫描未来宜此事项的吉日。民俗择吉仅供参考，重要日子还请结合实际安排。
      </p>

      <div class="event-grid" aria-label="选择事项">
        <button
          v-for="e in EVENTS"
          :key="e.name"
          type="button"
          class="event-button"
          :class="{ 'is-selected': event.name === e.name }"
          :aria-pressed="event.name === e.name"
          @click="event = e"
        >
          <EventIcon :name="e.icon" />
          <span>{{ e.name }}</span>
        </button>
      </div>

      <div class="filter-options">
        <span class="option-label">范围</span>
        <div class="range-options" aria-label="选择查询范围">
          <button
            v-for="r in [30, 60, 90]"
            :key="r"
            type="button"
            class="range-button"
            :class="{ 'is-selected': range === r }"
            :aria-pressed="range === r"
            @click="range = r"
          >{{ r }} 天</button>
        </div>
        <label v-if="profileBazi" class="avoid-option">
          <input v-model="avoidChong" type="checkbox">
          <span>避开冲我生肖（{{ profileBazi.shengXiao }}）</span>
        </label>
      </div>
    </section>

    <section class="card results-card" aria-labelledby="results-title">
      <div class="results-heading">
        <div id="results-title" class="card-title">宜「{{ event.name }}」的吉日</div>
        <span class="result-count"><strong>{{ results.length }}</strong> 天</span>
      </div>

      <Transition name="result-swap" mode="out-in">
        <div :key="resultKey" class="result-page">
          <div v-if="!results.length" class="empty-state" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v5M12 16h.01M4 4l16 16" />
            </svg>
            <p>未来 {{ range }} 天内未寻得宜「{{ event.name }}」之日，可扩大范围再试。</p>
          </div>
          <TransitionGroup v-else tag="div" name="day-list" class="day-list" appear>
            <button
              v-for="(r, index) in results"
              :key="r.info.dateStr"
              type="button"
              class="day-result"
              :style="{ '--result-order': Math.min(index, 12) }"
              :aria-label="`查看 ${r.info.dateStr} 黄历详情`"
              @click="gotoDay(r.info.dateStr)"
            >
              <span class="day-date">
                <span class="solar-date">{{ r.info.dateStr.slice(5).replace('-', '月') }}日 <small>周{{ r.info.week }}</small></span>
                <span class="lunar-date">{{ r.info.lunar.getMonthInChinese() }}月{{ r.info.lunar.getDayInChinese() }} · {{ r.info.dayGanZhi }}日</span>
              </span>
              <span class="day-main">
                <span class="matched-tags">
                  <span v-for="t in r.matched" :key="t" class="tag yi">{{ t }}</span>
                </span>
                <span class="day-caution">冲{{ r.info.chong }} · 煞{{ r.info.sha }}</span>
              </span>
              <span class="day-link">
                详情
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
              </span>
            </button>
          </TransitionGroup>
        </div>
      </Transition>
      <p v-if="results.length" class="result-footnote">点击任意吉日可跳转黄历详情。吉日依传统历法宜忌推得，仅供民俗参考。</p>
    </section>
  </div>
</template>

<style scoped>
.zeji-view { min-width: 0; }
.zeji-view .card { min-width: 0; }
.filter-card { background: radial-gradient(circle at 100% 0, oklch(0.96 0 0 / 0.05), transparent 34%), var(--card); }
.filter-heading,
.results-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.filter-heading { margin-bottom: 14px; }
.filter-heading .card-title { margin: 7px 0 0; }
.eyebrow,
.scan-note,
.option-label { color: var(--muted); font-size: 10px; letter-spacing: 0.16em; }
.scan-note { white-space: nowrap; }
.intro { max-width: 700px; margin-bottom: 22px; font-size: 13px; line-height: 1.9; }
.event-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.event-button {
  display: flex;
  min-width: 0;
  min-height: 64px;
  padding: 10px 8px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid var(--line);
  border-radius: 0;
  background: oklch(0.96 0 0 / 0.018);
  color: var(--ink-soft);
  cursor: pointer;
  font-size: 12px;
  letter-spacing: 0.08em;
  transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 220ms ease, transform 180ms ease;
}
.event-button:hover { border-color: var(--line-strong); background: oklch(0.96 0 0 / 0.055); color: var(--ink); transform: translateY(-2px); }
.event-button:active { transform: translateY(0); }
.event-icon { width: 18px; height: 18px; flex: 0 0 auto; }
.event-button.is-selected,
.range-button.is-selected {
  border-color: oklch(0.98 0 0);
  background: linear-gradient(135deg, oklch(0.99 0 0), oklch(0.82 0 0));
  box-shadow: 0 0 0 1px oklch(0.96 0 0 / 0.12), 0 0 24px oklch(0.9 0 0 / 0.2);
  color: oklch(0.16 0 0);
}
.event-button.is-selected { font-weight: 500; }
.filter-options { display: flex; margin-top: 22px; padding-top: 18px; align-items: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid var(--line); }
.range-options { display: flex; flex-wrap: wrap; gap: 7px; }
.range-button {
  min-width: 66px;
  min-height: 40px;
  padding: 8px 13px;
  border: 1px solid var(--line-strong);
  border-radius: 0;
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
  font-size: 12px;
  transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 220ms ease;
}
.range-button:hover { border-color: var(--ink-soft); color: var(--ink); }
.avoid-option { display: inline-flex; min-height: 40px; margin-left: auto; align-items: center; gap: 9px; color: var(--ink-soft); cursor: pointer; font-size: 12px; line-height: 1.6; }
.avoid-option input { flex: 0 0 auto; }
.results-heading { margin-bottom: 14px; }
.results-heading .card-title { min-width: 0; margin-bottom: 0; }
.result-count { display: inline-flex; align-items: baseline; flex: 0 0 auto; gap: 5px; color: var(--muted); font-size: 12px; }
.result-count strong { color: var(--ink); font-size: 24px; font-weight: 300; font-variant-numeric: tabular-nums; }
.result-page { min-height: 60px; }
.result-swap-enter-active { transition: opacity 160ms ease-out; }
.result-swap-leave-active { transition: opacity 130ms ease-in; }
.result-swap-enter-from,
.result-swap-leave-to { opacity: 0; }
.day-list { display: flex; flex-direction: column; }
.day-list .day-list-enter-active { transition: opacity 340ms ease-out, transform 340ms cubic-bezier(0.22, 1, 0.36, 1); transition-delay: calc(var(--result-order, 0) * 38ms); }
.day-list-enter-from { opacity: 0; transform: translateY(10px); }
.day-list .day-list-leave-active { transition: opacity 100ms ease-in; }
.day-list-leave-to { opacity: 0; }
.day-result {
  display: grid;
  width: 100%;
  min-width: 0;
  padding: 17px 4px;
  grid-template-columns: 150px minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  border: 0;
  border-bottom: 1px dashed var(--line);
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  transition: background-color 180ms ease, padding 180ms ease;
}
.day-result:last-child { border-bottom: 0; }
.day-result:hover { padding-inline: 12px; background: oklch(0.96 0 0 / 0.035); }
.day-date,
.day-main { display: flex; min-width: 0; flex-direction: column; }
.day-date { gap: 5px; }
.solar-date { font-size: 16px; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.solar-date small { margin-left: 5px; color: var(--ink-soft); font-size: 12px; font-weight: 400; }
.lunar-date,
.day-caution { color: var(--ink-soft); font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
.day-main { align-items: flex-start; gap: 7px; }
.matched-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.matched-tags .tag { margin: 0; padding: 3px 8px; }
.day-link { display: inline-flex; align-items: center; align-self: center; gap: 4px; color: var(--ink-soft); font-size: 12px; white-space: nowrap; }
.day-link svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; transition: transform 180ms ease; }
.day-result:hover .day-link { color: var(--ink); }
.day-result:hover .day-link svg { transform: translateX(3px); }
.result-footnote { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); color: var(--ink-soft); font-size: 12px; line-height: 1.8; }
.empty-state { display: flex; min-height: 150px; padding: 24px 12px; align-items: center; justify-content: center; flex-direction: column; gap: 14px; color: var(--ink-soft); text-align: center; }
.empty-state svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; opacity: 0.65; }
.empty-state p { max-width: 430px; font-size: 13px; line-height: 1.9; }

@media (max-width: 700px) {
  .zeji-view .card { padding: 22px; }
  .event-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .event-button { min-height: 52px; justify-content: flex-start; padding-inline: 16px; }
  .avoid-option { width: 100%; margin-left: 0; }
  .day-result { grid-template-columns: minmax(0, 1fr) auto; gap: 10px 14px; }
  .day-date { grid-column: 1; grid-row: 1; }
  .day-main { grid-column: 1 / -1; grid-row: 2; }
  .day-link { grid-column: 2; grid-row: 1; }
}
@media (max-width: 380px) {
  .zeji-view .card { padding: 18px; }
  .filter-heading { align-items: flex-start; }
  .scan-note { padding-top: 4px; }
  .event-button { padding-inline: 12px; }
  .range-button { min-width: 60px; padding-inline: 10px; }
  .results-heading { align-items: flex-end; gap: 10px; }
  .results-heading .card-title { font-size: 16px; letter-spacing: 0.08em; }
}
@media (prefers-reduced-motion: reduce) {
  .event-button,
  .range-button,
  .day-result,
  .day-link svg,
  .result-swap-enter-active,
  .result-swap-leave-active,
  .day-list .day-list-enter-active,
  .day-list .day-list-leave-active { transition: none; }
  .event-button:hover,
  .day-result:hover .day-link svg,
  .day-list-enter-from { transform: none; }
  .day-list .day-list-enter-active { transition-delay: 0ms; }
}
</style>
