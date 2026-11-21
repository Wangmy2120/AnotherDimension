<script setup>
import { computed, ref } from 'vue'
import { store } from '../store.js'
import { findKindred, catalogStats } from '../lib/tongxiang.js'

const KINDS = [
  { key: 'all', label: '不限' },
  { key: 'history', label: '史载' },
  { key: 'fiction', label: '演义' }
]

const kind = ref('all')
const limit = ref(3)
const stats = catalogStats()

const result = computed(() => findKindred(store.dateStr, { kind: kind.value, limit: limit.value + 2 }))
const shown = computed(() => result.value.list.slice(0, limit.value))

function setKind(key) {
  kind.value = key
  limit.value = 3
}

// 强度只描述重合了几条历法坐标，不描述吉凶。
function strength(hit) {
  if (hit.score >= 50) return '3'
  return hit.score >= 20 ? '2' : '1'
}
function strengthLabel(hit) {
  return { 1: '弱', 2: '中', 3: '强' }[strength(hit)]
}
</script>

<template>
  <section class="card kindred-card" aria-labelledby="kindred-title">
    <h2 id="kindred-title" class="card-title">同象</h2>
    <p class="kindred-axis">{{ result.today.summary }}</p>

    <div class="kindred-filter" role="group" aria-label="按记载类型筛选">
      <button
        v-for="item in KINDS"
        :key="item.key"
        type="button"
        :class="{ active: kind === item.key }"
        :aria-pressed="kind === item.key"
        @click="setKind(item.key)"
      >{{ item.label }}</button>
      <p class="kindred-count muted small">坐标库 {{ stats.total }} 条 · 史载 {{ stats.history }} · 演义 {{ stats.fiction }}</p>
    </div>

    <ol v-if="shown.length" class="kindred-list">
      <li v-for="hit in shown" :key="hit.event.id" class="kindred-item">
        <div class="kindred-head">
          <span class="kindred-kind" :class="hit.event.kind">{{ hit.event.kind === 'history' ? '史载' : '演义' }}</span>
          <h3>{{ hit.event.title }}</h3>
          <span v-if="hit.event.star" class="kindred-star">{{ hit.event.star }}</span>
          <span class="kindred-strength" :aria-label="`坐标重合 ${hit.reasons.length} 条，同象 ${strengthLabel(hit)}`" :title="`重合 ${hit.reasons.length} 条历法坐标`">
            <i v-for="n in 3" :key="n" :class="{ on: Number(strength(hit)) >= n }"></i>
            <em>{{ strengthLabel(hit) }}</em>
          </span>
        </div>
        <p class="kindred-figure">{{ hit.event.figure }}<span v-if="hit.event.role"> · {{ hit.event.role }}</span></p>

        <div class="kindred-mirror">
          <div>
            <span class="muted small">此刻</span>
            <strong>{{ result.today.dayGanZhi }}日</strong>
            <em>{{ result.today.xiuFull }}</em>
          </div>
          <svg class="kindred-link" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M15 6l6 6-6 6" /></svg>
          <div>
            <span class="muted small">彼时 · 相隔 {{ hit.yearsAgo }} 年</span>
            <strong>{{ hit.coord.dayGanZhi }}日</strong>
            <em>{{ hit.coord.xiuFull }}</em>
          </div>
        </div>

        <ul class="kindred-reasons">
          <li v-for="reason in hit.reasons" :key="reason.key">
            <b>{{ reason.label }}</b><span>{{ reason.detail }}</span>
          </li>
        </ul>

        <p class="kindred-when">{{ hit.label }}</p>
        <p class="kindred-place muted small">{{ hit.event.era }} · {{ hit.event.place }}</p>
        <p class="kindred-scene">{{ hit.event.scene }}</p>
        <figure v-if="hit.event.quote" class="kindred-quote">
          <blockquote>{{ hit.event.quote }}</blockquote>
          <figcaption>{{ hit.event.quoteSource }}</figcaption>
        </figure>
        <p v-if="hit.event.date.precision !== 'full'" class="kindred-basis muted small">系日依据：{{ hit.precisionLabel }}。{{ hit.basis }}</p>
      </li>
    </ol>
    <p v-else class="muted">此类坐标下暂无可核之事件。</p>

    <button v-if="shown.length < result.list.length" class="kindred-more" type="button" @click="limit += 2">再看一位</button>

    <p class="card-footnote muted small">同象只陈述历法坐标是否重合——同一值日星宿、同一日支、同一岁时——不据以推断任何人的际遇。标注「演义」者出自古典小说，其日期系依史实系年推定，不作为史实陈述。</p>
  </section>
</template>

<style scoped>
.kindred-axis { margin: 0 0 18px; padding-left: 32px; color: var(--silver); font-size: 13px; letter-spacing: 0.06em; }
.kindred-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
.kindred-filter button { min-height: 30px; padding: 0 12px; border: 1px solid var(--line); border-radius: 0; background: transparent; color: var(--muted); font-family: inherit; font-size: 12px; letter-spacing: 0.12em; cursor: pointer; transition: color 200ms ease, border-color 200ms ease, background 200ms ease; }
.kindred-filter button:hover { color: var(--glow); border-color: var(--silver); }
.kindred-filter button.active { color: var(--void); background: var(--silver); border-color: var(--silver); }
.kindred-count { margin: 0 0 0 auto; }
.kindred-list { margin: 0; padding: 0; list-style: none; }
.kindred-item { padding: 24px 0; border-bottom: 1px solid var(--line); }
.kindred-item:last-child { border-bottom: 0; }
.kindred-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; }
.kindred-head h3 { margin: 0; color: var(--glow); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 17px; font-weight: 400; letter-spacing: 0.1em; }
.kindred-kind { padding: 2px 7px; border: 1px solid var(--line-strong); color: var(--silver); font-size: 10px; letter-spacing: 0.16em; }
.kindred-kind.fiction { border-style: dashed; }
.kindred-star { color: var(--muted); font-size: 11px; letter-spacing: 0.14em; }
.kindred-strength { display: flex; margin-left: auto; align-items: center; gap: 3px; color: var(--muted); font-size: 10px; letter-spacing: 0.14em; }
.kindred-strength i { width: 3px; height: 9px; background: var(--mist); transition: background 200ms ease; }
.kindred-strength i.on { background: var(--silver); }
.kindred-strength em { margin-left: 5px; font-style: normal; }
.kindred-place { margin: 6px 0 0; letter-spacing: 0.04em; }
.kindred-figure { margin: 8px 0 0; color: var(--silver); font-size: 13px; letter-spacing: 0.04em; }
.kindred-figure span { color: var(--muted); }
.kindred-mirror { display: grid; margin-top: 16px; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 14px; }
.kindred-mirror div { display: grid; gap: 3px; }
.kindred-mirror div:last-child { text-align: right; }
.kindred-mirror strong { color: var(--glow); font-weight: 400; font-size: 15px; letter-spacing: 0.08em; }
.kindred-mirror em { color: var(--silver); font-size: 12px; font-style: normal; letter-spacing: 0.06em; }
.kindred-link { width: 24px; height: 24px; fill: none; stroke: var(--mist); stroke-width: 1.2; stroke-linecap: round; }
.kindred-reasons { display: flex; flex-wrap: wrap; margin: 16px 0 0; padding: 0; list-style: none; gap: 6px; }
.kindred-reasons li { display: flex; padding: 5px 10px; border: 1px solid var(--line); gap: 7px; font-size: 11px; letter-spacing: 0.06em; }
.kindred-reasons b { color: var(--glow); font-weight: 400; }
.kindred-reasons span { color: var(--muted); }
.kindred-when { margin: 16px 0 0; color: var(--silver); font-size: 12px; letter-spacing: 0.05em; }
.kindred-scene { margin: 10px 0 0; color: var(--muted); font-size: 13px; line-height: 1.9; }
.kindred-quote { margin: 16px 0 0; padding: 12px 0 12px 16px; border-left: 1px solid var(--line-strong); }
.kindred-quote blockquote { margin: 0; color: var(--silver); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 14px; line-height: 1.9; }
.kindred-quote figcaption { margin-top: 6px; color: var(--muted); font-size: 11px; letter-spacing: 0.1em; }
.kindred-basis { margin: 12px 0 0; padding-top: 10px; border-top: 1px dashed var(--line); line-height: 1.8; }
.kindred-more { display: block; width: 100%; margin-top: 18px; padding: 12px; border: 1px solid var(--line); border-radius: 0; background: transparent; color: var(--silver); font-family: inherit; font-size: 12px; letter-spacing: 0.16em; cursor: pointer; transition: color 200ms ease, border-color 200ms ease; }
.kindred-more:hover { color: var(--glow); border-color: var(--silver); }
</style>
