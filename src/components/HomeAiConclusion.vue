<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { bazi, dayInfo, fortune, store } from '../store.js'
import { buildContext, streamInterpret } from '../lib/ai.js'
import { chapterByKey } from '../data/chapters.js'
import { formatSolarTime, getSolarPosition, getTrueSolarTime } from '../lib/solar.js'

const text = ref('')
const loading = ref(false)
const error = ref('')
const started = ref(false)
const generatedSignature = ref('')
let controller

const inputsSignature = computed(() => JSON.stringify([
  store.dateStr,
  store.profile,
  store.location,
  store.hexSession,
  store.dreamSession
]))
const stale = computed(() => Boolean(generatedSignature.value) && generatedSignature.value !== inputsSignature.value)
const included = computed(() => [
  '当日黄历',
  '太阳时空',
  '今日运势',
  bazi() ? '个人八字' : null,
  store.hexSession ? '本次卦象' : null,
  store.dreamSession ? '本次梦境' : null
].filter(Boolean))
const sourceItems = computed(() => {
  const day = dayInfo()
  const chart = bazi()
  const items = [
    {
      label: '黄历',
      text: `宜${day.yi.slice(0, 4).join('、')}；忌${day.ji.slice(0, 4).join('、')}；${day.chongLabel}。`,
      source: '《协纪辨方书》体例'
    }
  ]
  if (chart) {
    items.push({
      label: '四柱',
      text: `${chart.pillars.map(item => `${item.label}${item.gz}`).join(' · ')}；日主${chart.dayGan}（${chart.dayMasterWuXing}）。`,
      source: '《渊海子平》四柱法'
    })
  }
  if (store.hexSession) {
    const result = store.hexSession.result
    items.push({
      label: '卦象',
      text: `${result.primaryName}${result.changedName ? ` → ${result.changedName}` : '（六爻安静）'}${result.movingTexts.length ? `；动爻：${result.movingTexts.map(item => item.name).join('、')}` : ''}。`,
      source: '《周易》公版原文'
    })
  }
  return items
})

async function generate() {
  if (loading.value) return
  started.value = true
  text.value = ''
  error.value = ''

  const now = new Date()
  const position = getSolarPosition(now, store.location.latitude, store.location.longitude)
  const context = {
    dayInfo: dayInfo(),
    bazi: bazi(),
    fortune: fortune(),
    solar: {
      trueSolarTime: formatSolarTime(getTrueSolarTime(now, store.location.longitude)),
      azimuth: position.azimuth,
      elevation: position.elevation
    }
  }
  if (store.hexSession) {
    context.hexResult = store.hexSession.result
    context.question = store.hexSession.question
  }
  if (store.dreamSession) context.dream = store.dreamSession

  generatedSignature.value = inputsSignature.value
  loading.value = true
  controller = new AbortController()
  try {
    await streamInterpret(buildContext(context), delta => {
      text.value += delta
    }, controller.signal)
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message || 'AI 解读暂时不可用，请稍后再试。'
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="ai-conclusion" aria-labelledby="conclusion-title">
    <div class="conclusion-intro">
      <div class="conclusion-orbit" aria-hidden="true">
        <i></i><i></i><span>合</span>
      </div>
      <div class="conclusion-copy">
        <span class="conclusion-code">{{ chapterByKey.synthesis.number }} / {{ chapterByKey.synthesis.code }}</span>
        <h1 id="conclusion-title">万轨归一</h1>
        <p class="conclusion-lead">将此刻的历法、太阳方位与你的个人资料汇聚成一份综合解读。</p>
        <div class="context-list" aria-label="本次解读包含的信息">
          <span v-for="item in included" :key="item">{{ item }}</span>
        </div>
        <p class="conclusion-privacy">点击生成后，解读所需数据才会发送给站点的 AI 解读服务；原始经纬度不随请求发送。</p>
        <button class="btn conclusion-button" type="button" :disabled="loading" @click="generate">
          {{ loading ? '正在综合解读…' : text ? '重新生成天机综述' : '生成我的天机综述' }}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </div>

    <div v-if="started" class="conclusion-result" aria-live="polite">
      <p v-if="stale && !loading" class="stale-note">资料已更新，可重新生成以保持结论一致。</p>
      <p v-if="error" class="conclusion-error" role="alert">{{ error }}</p>
      <div v-else-if="text || loading" class="conclusion-text" :class="{ streaming: loading }">{{ text || '正在汇聚历法与命盘信息…' }}</div>
      <details class="conclusion-sources">
        <summary>原文依据</summary>
        <ul>
          <li v-for="item in sourceItems" :key="item.label">
            <strong>{{ item.label }}</strong>
            <span>{{ item.text }}</span>
            <small>{{ item.source }}</small>
          </li>
        </ul>
      </details>
      <p class="conclusion-disclaimer">AI 生成内容仅供传统文化体验与娱乐参考，不构成人生决策建议。</p>
    </div>
  </section>
</template>

<style scoped>
.ai-conclusion { position: relative; min-height: 100vh; padding: 150px 64px 120px; overflow: hidden; border-top: 1px solid var(--line); background: radial-gradient(circle at 24% 36%, rgba(255,255,255,0.045), transparent 30%); }
.conclusion-intro { display: grid; max-width: 1240px; margin: 0 auto; grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.15fr); align-items: center; gap: clamp(54px, 9vw, 140px); }
.conclusion-orbit { position: relative; display: grid; width: min(30vw, 330px); aspect-ratio: 1; place-items: center; justify-self: center; }
.conclusion-orbit::before,
.conclusion-orbit::after,
.conclusion-orbit i { content: ''; position: absolute; inset: 0; border: 1px solid var(--line-strong); border-radius: 50%; }
.conclusion-orbit::after { inset: 14%; border-style: dashed; opacity: 0.65; }
.conclusion-orbit i:first-child { inset: 30%; border-color: var(--line); }
.conclusion-orbit i:nth-child(2) { inset: -5%; border-color: var(--line); transform: rotateX(66deg) rotateZ(-18deg); }
.conclusion-orbit span { font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 58px; font-weight: 300; }
.conclusion-code { color: var(--muted); font-size: 10px; letter-spacing: 0.24em; }
.conclusion-copy h1 { margin-top: 18px; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: clamp(48px, 5.6vw, 78px); font-weight: 400; letter-spacing: 0.12em; }
.conclusion-lead { max-width: 540px; margin-top: 24px; color: var(--ink-soft); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 15px; line-height: 2; }
.context-list { display: flex; margin-top: 30px; flex-wrap: wrap; gap: 8px; }
.context-list span { padding: 6px 10px; border: 1px solid var(--line); color: var(--ink-soft); font-size: 10px; letter-spacing: 0.08em; }
.conclusion-privacy { max-width: 540px; margin-top: 20px; color: var(--muted); font-size: 10px; line-height: 1.9; }
.conclusion-button { margin-top: 28px; }
.conclusion-result { max-width: 780px; margin: 90px auto 0; padding-top: 42px; border-top: 1px solid var(--line-strong); }
.conclusion-text { color: var(--ink-soft); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 16px; line-height: 2.15; white-space: pre-wrap; }
.conclusion-text.streaming::after { content: ''; display: inline-block; width: 1px; height: 1.1em; margin-left: 5px; background: var(--ink); vertical-align: -0.15em; animation: conclusion-cursor 900ms steps(1) infinite; }
.conclusion-error { margin-bottom: 20px; color: var(--ink); line-height: 1.8; }
.stale-note { margin-bottom: 20px; color: var(--muted); font-size: 11px; }
.conclusion-sources { margin-top: 28px; border-top: 1px solid var(--line); }
.conclusion-sources summary { display: flex; min-height: 44px; align-items: center; color: var(--silver); cursor: pointer; font-size: 12px; letter-spacing: 0.1em; }
.conclusion-sources summary::before { margin-right: 8px; color: var(--muted); content: '+'; }
.conclusion-sources[open] summary::before { content: '−'; }
.conclusion-sources ul { display: grid; padding: 0 0 8px; gap: 12px; list-style: none; }
.conclusion-sources li { display: grid; gap: 3px; padding: 10px 12px; border: 1px solid var(--line); font-size: 12px; line-height: 1.75; }
.conclusion-sources strong { color: var(--glow); font-weight: 400; letter-spacing: 0.1em; }
.conclusion-sources span { color: var(--silver); }
.conclusion-sources small { color: var(--muted); font-size: 11px; }
.conclusion-disclaimer { margin-top: 28px; color: var(--muted); font-size: 10px; line-height: 1.8; }
@keyframes conclusion-cursor { 50% { opacity: 0; } }

@media (max-width: 800px) {
  .ai-conclusion { min-height: 0; padding: 110px 28px 90px; }
  .conclusion-intro { grid-template-columns: 1fr; gap: 54px; }
  .conclusion-orbit { width: 230px; }
  .conclusion-result { margin-top: 64px; }
}
@media (max-width: 480px) {
  .ai-conclusion { padding: 90px 22px 72px; }
  .conclusion-copy h2 { font-size: 48px; }
  .conclusion-orbit { width: 190px; }
  .conclusion-orbit span { font-size: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .conclusion-text.streaming::after { animation: none; }
}
</style>
