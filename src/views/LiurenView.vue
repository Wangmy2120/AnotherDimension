<script setup>
import { computed, ref, watch } from 'vue'
import DateBar from '../components/DateBar.vue'
import { LIUREN_KEY, openAi, store } from '../store.js'
import { todayStr } from '../lib/calendar.js'
import { LIUREN_METHOD, LIUREN_PALACES, getLiurenLesson } from '../lib/liuren.js'

function currentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

const time = ref(currentTime())
const question = ref(store.liurenSession?.question || '')
const lesson = computed(() => {
  const [hour, minute] = time.value.split(':').map(Number)
  return getLiurenLesson({ dateStr: store.dateStr, hour, minute })
})

const stepLabels = computed(() => {
  const map = {}
  lesson.value.steps.forEach(step => {
    if (!map[step.index]) map[step.index] = []
    map[step.index].push(step.label[0])
  })
  return map
})

const dialNodes = computed(() => LIUREN_PALACES.map((palace, index) => {
  const angle = -Math.PI / 2 + index / 6 * Math.PI * 2
  return {
    ...palace,
    index,
    x: 180 + Math.cos(angle) * 121,
    y: 180 + Math.sin(angle) * 121,
    active: index === lesson.value.hourIndex,
    tags: stepLabels.value[index] || []
  }
}))

const tracePoints = computed(() => lesson.value.steps.map(step => {
  const angle = -Math.PI / 2 + step.index / 6 * Math.PI * 2
  return `${(180 + Math.cos(angle) * 121).toFixed(1)},${(180 + Math.sin(angle) * 121).toFixed(1)}`
}).join(' '))

const ticks = Array.from({ length: 60 }, (_, index) => {
  const angle = -Math.PI / 2 + index / 60 * Math.PI * 2
  const outer = 154
  const inner = index % 5 === 0 ? 146 : 150
  return {
    x1: 180 + Math.cos(angle) * inner,
    y1: 180 + Math.sin(angle) * inner,
    x2: 180 + Math.cos(angle) * outer,
    y2: 180 + Math.sin(angle) * outer,
    major: index % 5 === 0
  }
})

function saveSession() {
  const value = lesson.value
  const session = {
    date: value.dateStr,
    time: value.timeLabel,
    lunar: `${value.monthLabel}${value.lunarDay}日`,
    monthPalace: value.steps[0].palace.name,
    dayPalace: value.steps[1].palace.name,
    hourPalace: value.steps[2].palace.name,
    result: value.result.name,
    element: value.result.element,
    verdict: value.result.verdict,
    summary: value.result.summary,
    question: question.value.trim().slice(0, 120),
    method: '小六壬'
  }
  store.liurenSession = session
  try {
    localStorage.setItem(LIUREN_KEY, JSON.stringify(session))
  } catch { /* 浏览器可能禁用本地存储 */ }
}

watch([lesson, question], saveSession, { immediate: true })

function useNow() {
  time.value = currentTime()
  store.dateStr = todayStr()
}

function askAi() {
  saveSession()
  openAi('liuren')
}
</script>

<template>
  <div class="liuren-view">
    <DateBar />

    <section class="card liuren-stage" aria-labelledby="liuren-title">
      <div class="liuren-heading">
        <div>
          <span class="profile-code">六壬 / 小六壬</span>
          <h2 id="liuren-title">月日时三课</h2>
          <p>依农历月、日、时辰落宫，观此刻人事之机。先看课象，再回到自己的选择。</p>
        </div>
        <span class="liuren-stamp">六宫 · 小六壬</span>
      </div>

      <div class="liuren-layout">
        <div class="liuren-dial-wrap">
          <svg
            class="liuren-dial"
            viewBox="0 0 360 360"
            role="img"
            :aria-label="`六课盘，月课${lesson.steps[0].palace.name}，日课${lesson.steps[1].palace.name}，时课${lesson.steps[2].palace.name}，落宫${lesson.result.name}`"
          >
            <circle cx="180" cy="180" r="166" class="dial-ring faint" />
            <circle cx="180" cy="180" r="132" class="dial-ring" />
            <circle cx="180" cy="180" r="72" class="dial-inner" />
            <line x1="180" y1="48" x2="180" y2="312" class="dial-cross" />
            <line x1="48" y1="180" x2="312" y2="180" class="dial-cross" />
            <line
              v-for="tick in ticks"
              :key="`${tick.x1}-${tick.y1}`"
              :x1="tick.x1"
              :y1="tick.y1"
              :x2="tick.x2"
              :y2="tick.y2"
              class="dial-tick"
              :class="{ major: tick.major }"
            />
            <polyline :points="tracePoints" class="dial-trace" />
            <g v-for="node in dialNodes" :key="node.key" :transform="`translate(${node.x} ${node.y})`">
              <circle :r="node.active ? 27 : 23" class="dial-node" :class="{ 'is-result': node.active, 'is-step': node.tags.length }" />
              <text y="5" text-anchor="middle" class="dial-node-name">{{ node.name }}</text>
              <g v-if="node.tags.length" class="dial-step-tags">
                <text
                  v-for="(tag, index) in node.tags"
                  :key="tag"
                  :x="node.tags.length === 1 ? 0 : (index - (node.tags.length - 1) / 2) * 13"
                  y="-34"
                  text-anchor="middle"
                >{{ tag }}</text>
              </g>
            </g>
            <text x="180" y="166" text-anchor="middle" class="dial-core-label">落宫</text>
            <text x="180" y="202" text-anchor="middle" class="dial-core-name">{{ lesson.result.name }}</text>
            <text x="180" y="224" text-anchor="middle" class="dial-core-meta">属{{ lesson.result.element }} · {{ lesson.result.verdict }}</text>
          </svg>
        </div>

        <div class="liuren-reading">
          <span class="liuren-kicker">时课落宫 · {{ lesson.timeLabel }}</span>
          <h3>{{ lesson.result.name }}</h3>
          <p class="liuren-result-meta">属{{ lesson.result.element }} · {{ lesson.result.direction }}方 · {{ lesson.result.main }}</p>
          <p class="liuren-summary">{{ lesson.result.summary }}</p>
          <p class="liuren-advice">{{ lesson.result.advice }}</p>
          <div class="liuren-flags" aria-label="宜忌参考">
            <span class="flag-label">宜</span>
            <span v-for="item in lesson.result.yi" :key="`yi-${item}`">{{ item }}</span>
            <span class="flag-label ji">忌</span>
            <span v-for="item in lesson.result.ji" :key="`ji-${item}`">{{ item }}</span>
          </div>
          <label class="liuren-question">
            <span>所问何事</span>
            <textarea v-model="question" rows="2" maxlength="120" placeholder="可留空，问此刻整体。不必写姓名与隐私。"></textarea>
          </label>
          <p class="liuren-question-note">问题只保存在此浏览器，随课象一起进入智能解读。</p>
          <div class="liuren-controls">
            <label class="liuren-time-field">
              <span>起课时辰</span>
              <input v-model="time" type="time" aria-label="选择起课时辰">
            </label>
            <button class="btn ghost small" type="button" @click="useNow">回到此刻</button>
            <button class="btn small" type="button" @click="askAi">智能解课</button>
            <a class="btn ghost small" href="#/synthesis">带入合参</a>
          </div>
          <p v-if="lesson.leap" class="liuren-leap">本月为闰月，课式按本月月数起课。</p>
        </div>
      </div>

      <div class="liuren-trace" aria-label="三课落宫">
        <div v-for="step in lesson.steps" :key="step.key" class="liuren-trace-item" :class="{ result: step.key === 'hour' }">
          <span>{{ step.label }}</span>
          <strong>{{ step.palace.name }}</strong>
          <small>{{ step.countLabel }}</small>
        </div>
      </div>

      <p class="liuren-note">{{ LIUREN_METHOD }}仅供传统文化体验，不构成事件预测或人生决策建议。</p>
    </section>

    <section class="card liuren-palaces" aria-labelledby="palaces-title">
      <div class="liuren-heading compact">
        <div>
          <span class="profile-code">六宫释义</span>
          <h2 id="palaces-title">六宫取象</h2>
        </div>
        <p>月为起因，日为经过，时为落点。落宫只提示当下的倾向，不替你下结论。</p>
      </div>
      <div class="palace-grid">
        <article
          v-for="palace in LIUREN_PALACES"
          :key="palace.key"
          class="palace-card"
          :class="{ active: palace.key === lesson.result.key }"
        >
          <div class="palace-head">
            <h3>{{ palace.name }}</h3>
            <span>{{ palace.element }} · {{ palace.verdict }}</span>
          </div>
          <p class="palace-main">{{ palace.main }} · {{ palace.tone }}</p>
          <p>{{ palace.summary }}</p>
          <div class="palace-foot">
            <span>宜 {{ palace.yi.slice(0, 2).join('、') }}</span>
            <span>忌 {{ palace.ji.slice(0, 2).join('、') }}</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.liuren-view { display: flex; flex-direction: column; gap: 0; }
.liuren-stage { overflow: hidden; }
.liuren-heading { display: flex; padding-bottom: 22px; align-items: flex-end; justify-content: space-between; gap: 24px; border-bottom: 1px solid var(--line); }
.liuren-heading .profile-code { display: block; color: var(--muted); font-size: 10px; letter-spacing: 0.24em; }
.liuren-heading h2 { margin-top: 10px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: clamp(30px, 3vw, 44px); font-weight: 400; letter-spacing: 0.1em; }
.liuren-heading p { max-width: 46em; margin-top: 8px; color: var(--muted); font-size: 12px; line-height: 1.8; }
.liuren-heading.compact { align-items: flex-start; }
.liuren-heading.compact h2 { font-size: clamp(26px, 2.4vw, 34px); }
.liuren-heading.compact p { max-width: 34em; }
.liuren-stamp { flex: 0 0 auto; padding: 7px 10px; border: 1px solid var(--line-strong); color: var(--silver); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 11px; letter-spacing: 0.16em; }
.liuren-layout { display: grid; margin-top: 30px; grid-template-columns: minmax(280px, 0.96fr) minmax(0, 1.04fr); align-items: center; gap: clamp(26px, 5vw, 72px); }
.liuren-dial-wrap { display: grid; place-items: center; }
.liuren-dial { display: block; width: min(100%, 430px); height: auto; overflow: visible; }
.dial-ring { fill: none; stroke: var(--line); stroke-width: 1; }
.dial-ring.faint { stroke: var(--line); opacity: 0.55; stroke-dasharray: 3 9; }
.dial-inner { fill: none; stroke: var(--line-strong); stroke-width: 1; }
.dial-cross { stroke: var(--line); stroke-width: 0.6; opacity: 0.55; }
.dial-tick { stroke: var(--mist); stroke-width: 0.7; }
.dial-tick.major { stroke: var(--silver); opacity: 0.7; }
.dial-trace { fill: none; stroke: var(--silver); stroke-width: 1; stroke-dasharray: 5 7; opacity: 0.72; }
.dial-node { fill: var(--void); stroke: var(--line-strong); stroke-width: 1; transition: stroke 240ms ease, fill 240ms ease, filter 240ms ease; }
.dial-node.is-step { stroke: var(--silver); stroke-dasharray: 3 3; }
.dial-node.is-result { fill: oklch(0.97 0 0 / 0.08); stroke: var(--glow); stroke-width: 1.4; filter: drop-shadow(0 0 10px oklch(0.97 0 0 / 0.25)); }
.dial-node-name { fill: var(--glow); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 15px; letter-spacing: 0.08em; }
.dial-step-tags text { fill: var(--silver); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 9px; letter-spacing: 0.08em; }
.dial-core-label { fill: var(--muted); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 10px; letter-spacing: 0.24em; }
.dial-core-name { fill: var(--glow); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 27px; letter-spacing: 0.12em; }
.dial-core-meta { fill: var(--silver); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 9px; letter-spacing: 0.12em; }
.liuren-reading { min-width: 0; }
.liuren-kicker { color: var(--muted); font-size: 10px; letter-spacing: 0.2em; }
.liuren-reading h3 { margin-top: 10px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: clamp(46px, 5vw, 72px); font-weight: 400; letter-spacing: 0.12em; line-height: 1; }
.liuren-result-meta { margin-top: 13px; color: var(--silver); font-size: 12px; letter-spacing: 0.1em; }
.liuren-summary { max-width: 36em; margin-top: 20px; color: var(--ink-soft); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 15px; line-height: 2; }
.liuren-advice { max-width: 36em; margin-top: 9px; color: var(--muted); font-size: 12px; line-height: 1.9; }
.liuren-flags { display: flex; margin-top: 18px; flex-wrap: wrap; align-items: center; gap: 7px; }
.liuren-flags span { padding: 4px 7px; border: 1px solid var(--line); color: var(--silver); font-size: 11px; letter-spacing: 0.06em; }
.liuren-flags .flag-label { padding: 0; border: 0; color: var(--muted); }
.liuren-flags .flag-label.ji { margin-left: 6px; }
.liuren-question { display: grid; margin-top: 18px; gap: 7px; color: var(--muted); font-size: 12px; letter-spacing: 0.08em; }
.liuren-question textarea { width: 100%; min-height: 74px; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 0; background: oklch(0.97 0 0 / 0.025); color: var(--glow); font-family: inherit; font-size: 13px; line-height: 1.7; letter-spacing: 0; resize: vertical; }
.liuren-question textarea:focus { border-color: var(--glow); outline: none; }
.liuren-question textarea::placeholder { color: var(--muted); }
.liuren-question-note { margin-top: 7px; color: var(--muted); font-size: 10px; line-height: 1.7; }
.liuren-controls { display: flex; margin-top: 22px; flex-wrap: wrap; align-items: center; gap: 10px; }
.liuren-time-field { display: flex; min-height: 44px; align-items: center; gap: 9px; color: var(--muted); font-size: 12px; }
.liuren-time-field input { min-height: 44px; padding: 7px 10px; color: var(--glow); font-variant-numeric: tabular-nums; }
.liuren-leap { margin-top: 12px; color: var(--muted); font-size: 11px; line-height: 1.8; }
.liuren-trace { display: grid; margin-top: 30px; padding-top: 17px; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--line); }
.liuren-trace-item { display: grid; padding: 0 18px; gap: 5px; border-left: 1px solid var(--line); }
.liuren-trace-item:first-child { padding-left: 0; border-left: 0; }
.liuren-trace-item span { color: var(--muted); font-size: 10px; letter-spacing: 0.16em; }
.liuren-trace-item strong { color: var(--silver); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 20px; font-weight: 400; letter-spacing: 0.1em; }
.liuren-trace-item small { color: var(--muted); font-size: 11px; }
.liuren-trace-item.result strong { color: var(--glow); }
.liuren-note { margin-top: 20px; color: var(--muted); font-size: 11px; line-height: 1.8; }
.liuren-palaces { overflow: hidden; }
.palace-grid { display: grid; margin-top: 22px; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.palace-card { min-width: 0; padding: 16px; border: 1px solid var(--line); background: oklch(0.97 0 0 / 0.014); transition: border-color 200ms ease, background-color 200ms ease; }
.palace-card.active { border-color: var(--line-strong); background: oklch(0.97 0 0 / 0.04); }
.palace-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.palace-head h3 { color: var(--glow); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 21px; font-weight: 400; letter-spacing: 0.12em; }
.palace-head span { color: var(--muted); font-size: 10px; letter-spacing: 0.1em; }
.palace-main { margin-top: 8px; color: var(--silver); font-size: 11px; letter-spacing: 0.08em; }
.palace-card > p:not(.palace-main) { margin-top: 9px; color: var(--muted); font-size: 12px; line-height: 1.8; }
.palace-foot { display: flex; margin-top: 13px; flex-wrap: wrap; gap: 5px 12px; color: var(--silver); font-size: 10px; line-height: 1.7; }
@media (max-width: 900px) {
  .liuren-layout { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .liuren-dial { width: min(78vw, 380px); }
  .palace-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .liuren-reading h3 { font-size: clamp(44px, 9vw, 64px); }
}
@media (max-width: 560px) {
  .liuren-heading { align-items: flex-start; flex-direction: column; gap: 12px; }
  .liuren-stamp { align-self: flex-start; }
  .liuren-dial { width: min(88vw, 340px); }
  .liuren-trace-item { padding-inline: 9px; }
  .liuren-trace-item strong { font-size: 17px; }
  .liuren-trace-item small { font-size: 10px; }
  .palace-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .dial-node { transition: none; }
}
</style>
