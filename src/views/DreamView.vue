<script setup>
import { ref, computed, watch } from 'vue'
import dreams from '../data/dreams.json'
import { store, openAi } from '../store.js'

const STORAGE_KEY = 'tianji.dream.selection'
const query = ref('')
const activeCat = ref('全部')

function restoreSelection() {
  const fromSession = dreams.find(d => d.keyword === store.dreamSession?.keyword)
  if (fromSession) return fromSession
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.date && saved.date !== store.dateStr) return null
    const keyword = typeof saved === 'string' ? saved : saved?.keyword
    return dreams.find(d => d.keyword === keyword) || null
  } catch {
    return null
  }
}

const selected = ref(restoreSelection())
if (selected.value) store.dreamSession = selected.value
watch(query, () => { selected.value = null })

const cats = ['全部', ...new Set(dreams.map(d => d.cat))]
const HOT = ['蛇', '掉牙', '飞翔', '被追赶', '考试', '洪水', '捡钱', '已故亲人']
const hotDreams = HOT.map(keyword => dreams.find(d => d.keyword === keyword)).filter(Boolean)
const categoryCounts = new Map(cats.slice(1).map(cat => [cat, dreams.filter(d => d.cat === cat).length]))

const results = computed(() => {
  const q = query.value.trim()
  let list = dreams
  if (activeCat.value !== '全部') list = list.filter(d => d.cat === activeCat.value)
  if (q) {
    list = list.filter(d =>
      d.keyword.includes(q) || q.includes(d.keyword) ||
      d.alias.some(a => a.includes(q) || q.includes(a)))
  }
  return list
})

const normalizedQuery = computed(() => query.value.trim())
const showResults = computed(() => Boolean(normalizedQuery.value) || activeCat.value !== '全部')
const showHot = computed(() => !showResults.value)
const resultKey = computed(() => `${activeCat.value}:${normalizedQuery.value}`)
const resultTitle = computed(() => normalizedQuery.value
  ? `“${normalizedQuery.value}”的解梦结果`
  : `${activeCat.value}梦境`)

function pick(d) {
  selected.value = d
  store.dreamSession = d
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: store.dateStr, keyword: d.keyword, text: d.text, luck: d.luck, cat: d.cat }))
  } catch { /* 存储不可用时仍保留当前会话 */ }
}

function selectCategory(cat) {
  activeCat.value = cat
  selected.value = null
}

function resetBrowse() {
  query.value = ''
  activeCat.value = '全部'
  selected.value = null
}

function askAi() {
  store.dreamSession = selected.value
  openAi('dream')
}
</script>

<template>
  <div class="dream-view">
    <section class="card dream-hero" aria-labelledby="dream-title">
      <span class="eyebrow">梦有所映 · 心有所答</span>
      <h2 id="dream-title" class="card-title">周公解梦</h2>
      <p class="muted intro">
        梦者，心之影也。输入梦中关键词，查传统民俗释义，亦可请 AI 结合你的近况细细道来。仅供娱乐参考。
      </p>
      <div class="search-box">
        <label class="sr-only" for="dream-search">输入梦境关键词</label>
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
        <input id="dream-search" v-model="query" type="search" placeholder="输入梦境关键词，如：蛇、掉牙、飞翔…" autocomplete="off">
        <button v-if="query" type="button" class="clear-search" aria-label="清空搜索" @click="query = ''">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
        </button>
      </div>
      <div class="search-meta">
        <span>{{ normalizedQuery ? `正在搜索“${normalizedQuery}”` : '输入即搜，也可从热门梦境与分类进入' }}</span>
        <span v-if="activeCat !== '全部'">范围：{{ activeCat }}</span>
      </div>
    </section>

    <Transition name="dream-detail" mode="out-in">
      <section v-if="selected" :key="selected.keyword" class="card selected-dream" aria-live="polite">
        <div class="selected-heading">
          <div>
            <span class="eyebrow">当前梦境 · {{ selected.cat }}</span>
            <h2>梦见{{ selected.keyword }}</h2>
          </div>
          <span class="tag" :class="selected.luck === '吉' ? 'yi' : selected.luck === '凶' ? 'ji' : 'plain'">{{ selected.luck }}</span>
        </div>
        <p class="dream-interpretation">{{ selected.text }}</p>
        <button type="button" class="btn block ai-button" @click="askAi">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" />
          </svg>
          AI 深度解梦
        </button>
      </section>
    </Transition>

    <section v-if="showHot" class="card hot-section" aria-labelledby="hot-title">
      <div class="section-heading">
        <h2 id="hot-title" class="card-title">热门梦境</h2>
        <span class="section-note">精选 8 梦</span>
      </div>
      <div class="hot-grid">
        <button
          v-for="(d, index) in hotDreams"
          :key="d.keyword"
          type="button"
          class="hot-card"
          :class="{ 'is-selected': selected?.keyword === d.keyword }"
          :aria-pressed="selected?.keyword === d.keyword"
          @click="pick(d)"
        >
          <span class="hot-topline">
            <svg viewBox="0 0 28 28" aria-hidden="true">
              <path d="M18.8 4.5a9.5 9.5 0 1 0 4.7 15.2A10 10 0 0 1 18.8 4.5z" />
              <path d="M20 4v5M17.5 6.5h5" />
            </svg>
            <span class="hot-index">{{ String(index + 1).padStart(2, '0') }}</span>
          </span>
          <span class="hot-name">梦见{{ d.keyword }}</span>
          <span class="hot-summary">{{ d.text }}</span>
          <span class="hot-footer"><span>{{ d.cat }}</span><span class="luck-text">{{ d.luck }}</span></span>
        </button>
      </div>
    </section>

    <section class="card category-section" aria-labelledby="category-title">
      <div class="section-heading">
        <h2 id="category-title" class="card-title">分类浏览</h2>
        <button v-if="showResults" type="button" class="text-button" @click="resetBrowse">返回热门</button>
        <span v-else class="section-note">按意象寻梦</span>
      </div>
      <div class="category-list" aria-label="梦境分类">
        <button
          v-for="c in cats"
          :key="c"
          type="button"
          class="category-button"
          :class="{ 'is-active': activeCat === c }"
          :aria-pressed="activeCat === c"
          @click="selectCategory(c)"
        >
          <span>{{ c }}</span>
          <span v-if="c !== '全部'" class="category-count">{{ categoryCounts.get(c) }}</span>
        </button>
      </div>
      <p class="category-note">{{ activeCat === '全部' ? '选择分类展开对应梦境；选择“全部”返回热门导览。' : `当前仅浏览“${activeCat}”分类，搜索也会在此范围内进行。` }}</p>
    </section>

    <section v-if="showResults" class="card search-results" aria-labelledby="search-results-title">
      <div class="section-heading results-title-row">
        <h2 id="search-results-title" class="card-title">{{ resultTitle }}</h2>
        <span class="result-total">{{ results.length }} 条</span>
      </div>
      <Transition name="result-page" mode="out-in">
        <div :key="resultKey" class="result-page-body">
          <div v-if="!results.length" class="empty-state" role="status">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="14" cy="14" r="9" />
              <path d="m21 21 7 7M10 14h8" />
            </svg>
            <p>未找到相关梦境，换个关键词试试（如“蛇”“水”“飞”）。</p>
          </div>
          <TransitionGroup v-else tag="div" name="dream-result" class="result-grid" appear>
            <button
              v-for="(d, index) in results"
              :key="d.keyword"
              type="button"
              class="result-card"
              :style="{ '--dream-order': Math.min(index, 12) }"
              @click="pick(d)"
            >
              <span class="result-card-head">
                <span class="result-keyword">{{ d.keyword }}</span>
                <span class="tag" :class="d.luck === '吉' ? 'yi' : d.luck === '凶' ? 'ji' : 'plain'">{{ d.luck }}</span>
              </span>
              <span class="result-excerpt">{{ d.text }}</span>
              <span class="result-card-foot">
                <span>{{ d.cat }}梦境</span>
                <span class="read-result">查看释义<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg></span>
              </span>
            </button>
          </TransitionGroup>
        </div>
      </Transition>
    </section>
  </div>
</template>

<style scoped>
.dream-view { min-width: 0; }
.dream-view .card { min-width: 0; }
.dream-hero { background: radial-gradient(circle at 94% 8%, oklch(0.96 0 0 / 0.05), transparent 32%), var(--card); }
.eyebrow,
.section-note { color: var(--muted); font-size: 10px; letter-spacing: 0.16em; }
.dream-hero .card-title { margin-top: 8px; margin-bottom: 12px; }
.intro { max-width: 720px; margin-bottom: 18px; font-size: 13px; line-height: 1.9; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.search-box { position: relative; display: flex; min-width: 0; align-items: center; }
.search-box input { width: 100%; min-width: 0; min-height: 52px; padding: 12px 48px 12px 44px; background: oklch(0.96 0 0 / 0.035); font-size: 14px; }
.search-box input::-webkit-search-cancel-button { display: none; }
.search-icon { position: absolute; z-index: 1; left: 15px; width: 19px; height: 19px; fill: none; stroke: var(--ink-soft); stroke-width: 1.4; stroke-linecap: round; pointer-events: none; }
.clear-search { position: absolute; right: 4px; display: grid; width: 44px; height: 44px; padding: 0; place-items: center; border: 0; background: transparent; color: var(--ink-soft); cursor: pointer; }
.clear-search:hover { color: var(--ink); }
.clear-search svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; }
.search-meta { display: flex; margin-top: 10px; justify-content: space-between; flex-wrap: wrap; gap: 6px 14px; color: var(--muted); font-size: 10px; line-height: 1.7; }
.search-meta span { min-width: 0; overflow-wrap: anywhere; }
.selected-dream { transform-origin: 50% 0; background: linear-gradient(135deg, oklch(0.96 0 0 / 0.045), transparent 60%), var(--card); }
.dream-detail-enter-active { transition: opacity 300ms ease-out, transform 360ms cubic-bezier(0.22, 1, 0.36, 1); }
.dream-detail-leave-active { transition: opacity 130ms ease-in, transform 130ms ease-in; }
.dream-detail-enter-from { opacity: 0; transform: scale(0.92); }
.dream-detail-leave-to { opacity: 0; transform: scale(0.98); }
.selected-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.selected-heading h2 { margin-top: 8px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 24px; font-weight: 400; letter-spacing: 0.12em; overflow-wrap: anywhere; }
.selected-heading .tag { flex: 0 0 auto; margin: 0; }
.dream-interpretation { margin-top: 18px; font-size: 14px; line-height: 2; overflow-wrap: anywhere; }
.ai-button { margin-top: 20px; gap: 10px; }
.ai-button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.25; stroke-linecap: round; stroke-linejoin: round; }
.section-heading { display: flex; margin-bottom: 18px; align-items: center; justify-content: space-between; gap: 14px; }
.section-heading .card-title { min-width: 0; margin-bottom: 0; }
.hot-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.hot-card {
  display: flex;
  min-width: 0;
  min-height: 190px;
  padding: 16px;
  flex-direction: column;
  align-items: stretch;
  border: 1px solid var(--line);
  border-radius: 0;
  background: oklch(0.96 0 0 / 0.018);
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  transition: border-color 180ms ease, background-color 180ms ease, transform 200ms ease, box-shadow 200ms ease;
}
.hot-card:hover { border-color: var(--line-strong); background: oklch(0.96 0 0 / 0.045); transform: translateY(-3px); }
.hot-card.is-selected { border-color: var(--ink-soft); background: oklch(0.96 0 0 / 0.065); box-shadow: inset 0 0 0 1px oklch(0.96 0 0 / 0.06), 0 0 20px oklch(0.96 0 0 / 0.05); }
.hot-topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; color: var(--ink-soft); }
.hot-topline svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.1; stroke-linecap: round; stroke-linejoin: round; }
.hot-index { color: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; letter-spacing: 0.1em; }
.hot-name { margin-top: 14px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 17px; letter-spacing: 0.06em; overflow-wrap: anywhere; }
.hot-summary { display: -webkit-box; margin-top: 8px; overflow: hidden; color: var(--ink-soft); font-size: 12px; line-height: 1.75; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.hot-footer { display: flex; margin-top: auto; padding-top: 14px; align-items: center; justify-content: space-between; color: var(--muted); font-size: 10px; }
.luck-text { color: var(--ink-soft); }
.text-button { min-height: 44px; padding: 6px 0 6px 12px; border: 0; background: transparent; color: var(--ink-soft); cursor: pointer; font-size: 12px; text-decoration: underline; text-underline-offset: 4px; white-space: nowrap; }
.text-button:hover { color: var(--ink); }
.category-list { display: flex; flex-wrap: wrap; gap: 8px; }
.category-button { display: inline-flex; min-height: 44px; padding: 8px 13px; align-items: center; gap: 9px; border: 1px solid var(--line); border-radius: 0; background: transparent; color: var(--ink-soft); cursor: pointer; font-size: 12px; transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease; }
.category-button:hover { border-color: var(--ink-soft); color: var(--ink); }
.category-button.is-active { border-color: var(--ink); background: var(--ink); color: var(--paper); }
.category-count { color: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.category-button.is-active .category-count { color: oklch(0.2 0 0 / 0.62); }
.category-note { margin-top: 14px; color: var(--muted); font-size: 12px; line-height: 1.8; }
.results-title-row { align-items: flex-end; }
.results-title-row .card-title { overflow-wrap: anywhere; }
.result-total { flex: 0 0 auto; color: var(--muted); font-size: 12px; white-space: nowrap; }
.result-page-enter-active { transition: opacity 140ms ease-out; }
.result-page-leave-active { transition: opacity 100ms ease-in; }
.result-page-enter-from,
.result-page-leave-to { opacity: 0; }
.result-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.result-grid .dream-result-enter-active { transition: opacity 340ms ease-out, transform 360ms cubic-bezier(0.22, 1, 0.36, 1); transition-delay: calc(var(--dream-order, 0) * 36ms); }
.dream-result-enter-from { opacity: 0; transform: scale(0.92); }
.result-grid .dream-result-leave-active { transition: opacity 90ms ease-in; }
.dream-result-leave-to { opacity: 0; }
.result-card {
  display: flex;
  min-width: 0;
  min-height: 170px;
  padding: 17px;
  flex-direction: column;
  align-items: stretch;
  border: 1px solid var(--line);
  border-radius: 0;
  background: oklch(0.96 0 0 / 0.018);
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  transform-origin: center;
  transition: border-color 180ms ease, background-color 180ms ease;
}
.result-card:hover { border-color: var(--ink-soft); background: oklch(0.96 0 0 / 0.045); }
.result-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.result-keyword { min-width: 0; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 18px; letter-spacing: 0.08em; overflow-wrap: anywhere; }
.result-card-head .tag { flex: 0 0 auto; margin: 0; padding: 3px 8px; }
.result-excerpt { display: -webkit-box; margin-top: 12px; overflow: hidden; color: var(--ink-soft); font-size: 12px; line-height: 1.85; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.result-card-foot { display: flex; margin-top: auto; padding-top: 14px; align-items: center; justify-content: space-between; gap: 8px; color: var(--muted); font-size: 10px; }
.read-result { display: inline-flex; align-items: center; gap: 3px; color: var(--ink-soft); white-space: nowrap; }
.read-result svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.empty-state { display: flex; min-height: 180px; padding: 26px 12px; align-items: center; justify-content: center; flex-direction: column; gap: 14px; color: var(--ink-soft); text-align: center; }
.empty-state svg { width: 30px; height: 30px; fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; opacity: 0.65; }
.empty-state p { max-width: 440px; font-size: 13px; line-height: 1.9; }

@media (max-width: 820px) {
  .hot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hot-card { min-height: 176px; }
}
@media (max-width: 640px) {
  .dream-view .card { padding: 22px; }
  .result-grid { grid-template-columns: minmax(0, 1fr); }
  .result-card { min-height: 158px; }
}
@media (max-width: 380px) {
  .dream-view .card { padding: 18px; }
  .hot-grid { gap: 8px; }
  .hot-card { min-height: 184px; padding: 13px; }
  .hot-name { font-size: 16px; }
  .selected-heading h2 { font-size: 21px; }
  .category-list { gap: 7px; }
  .category-button { padding-inline: 11px; }
}
@media (prefers-reduced-motion: reduce) {
  .hot-card,
  .category-button,
  .result-card,
  .dream-detail-enter-active,
  .dream-detail-leave-active,
  .result-page-enter-active,
  .result-page-leave-active,
  .result-grid .dream-result-enter-active,
  .result-grid .dream-result-leave-active { transition: none; }
  .hot-card:hover,
  .dream-detail-enter-from,
  .dream-detail-leave-to,
  .dream-result-enter-from { transform: none; }
  .result-grid .dream-result-enter-active { transition-delay: 0ms; }
}
</style>
