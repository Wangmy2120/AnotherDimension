<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Lenis from 'lenis'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { store, dayInfo, bazi, fortune } from './store.js'
import { subscribeMotion } from './lib/motion.js'
import { sound } from './lib/sound.js'
import { chapterByKey, chapterFromHash, chapters, readingChapters } from './data/chapters.js'
import HomeView from './views/HomeView.vue'
import SynthesisView from './views/SynthesisView.vue'
import CelestialLoader from './components/CelestialLoader.vue'
import AiPanel from './components/AiPanel.vue'
import InkField from './components/InkField.vue'
import NextChapter from './components/NextChapter.vue'

const loaders = {
  home: () => Promise.resolve({ default: HomeView }),
  almanac: () => import('./views/AlmanacView.vue'),
  zeji: () => import('./views/ZejiView.vue'),
  fortune: () => import('./views/FortuneView.vue'),
  bazi: () => import('./views/BaziView.vue'),
  gua: () => import('./views/DivinationView.vue'),
  dream: () => import('./views/DreamView.vue'),
  sky: () => import('./views/SkyView.vue'),
  kindred: () => import('./views/KindredView.vue'),
  synthesis: () => Promise.resolve({ default: SynthesisView }),
  settings: () => import('./views/SettingsView.vue')
}

const componentCache = new Map([
  ['home', HomeView],
  ['synthesis', SynthesisView]
])
const loadingPromises = new Map()
const initialChapter = chapterFromHash(window.location.hash)
const active = ref(initialChapter.key)
const requestedKey = ref(initialChapter.key)
const current = shallowRef(componentCache.get(initialChapter.key) || null)
const showLoader = ref(true)
const viewReady = ref(false)
const viewPending = ref(false)
const loadError = ref('')
const requestSequence = ref(0)
const indexOpen = ref(false)
const indexPanel = ref(null)
const indexTrigger = ref(null)
const activeTab = computed(() => chapterByKey[active.value] || chapterByKey.home)
const info = computed(() => dayInfo())
const chart = computed(() => bazi())
const todayFortune = computed(() => fortune())
const readingIndex = computed(() => readingChapters.findIndex(chapter => chapter.key === active.value))
const prevChapter = computed(() => readingIndex.value > 0 ? readingChapters[readingIndex.value - 1] : null)
const nextChapter = computed(() => readingIndex.value >= 0 ? readingChapters[readingIndex.value + 1] || null : null)

const chapterMeta = computed(() => ({
  home: `${info.value.dayGanZhi}日 · ${info.value.lunarText}`,
  almanac: `宜${info.value.yi[0] || '静'} · 忌${info.value.ji[0] || '躁'}`,
  zeji: `${info.value.dateStr} · ${info.value.chongLabel}`,
  fortune: `综合 ${todayFortune.value.overall} / 100`,
  bazi: chart.value ? `${chart.value.dayGan}日主 · ${chart.value.shengXiao}` : '等待录入生辰',
  gua: store.hexSession?.result?.primaryName || '尚未起卦',
  dream: store.dreamSession?.keyword || '尚未记录',
  sky: `${info.value.xiuName}值宿 · 今夜观星`,
  kindred: `${info.value.dayGanZhi}日 · ${info.value.xiuName}`,
  synthesis: '历法 · 命盘 · 卦象 · 梦境',
  settings: '隐私 · 数据 · 声音'
}))

const indexItems = computed(() => chapters.map(chapter => ({
  ...chapter,
  meta: chapterMeta.value[chapter.key]
})))

const activeFacts = computed(() => {
  switch (active.value) {
    case 'almanac':
      return [
        { label: '日期', value: info.value.dateStr },
        { label: '干支', value: `${info.value.dayGanZhi}日` },
        { label: '值宿', value: `${info.value.xiuName} · ${info.value.xiuLuck}` }
      ]
    case 'zeji':
      return [
        { label: '今日', value: info.value.dateStr },
        { label: '冲煞', value: info.value.chongLabel }
      ]
    case 'fortune':
      return [
        { label: '日期', value: info.value.dateStr },
        { label: '综合', value: `${todayFortune.value.overall} / 100` },
        { label: '关系', value: todayFortune.value.relation || '通用' }
      ]
    case 'bazi':
      return chart.value
        ? [
            { label: '日主', value: `${chart.value.dayGan} · ${chart.value.dayMasterWuXing}` },
            { label: '生肖', value: chart.value.shengXiao },
            { label: '四柱', value: chart.value.pillars.map(item => item.gz).join(' ') }
          ]
        : [
            { label: '生辰', value: '待录入' },
            { label: '资料', value: '仅保存在此浏览器' }
          ]
    case 'gua':
      return store.hexSession
        ? [
            { label: '本卦', value: store.hexSession.result.primaryName },
            { label: '变卦', value: store.hexSession.result.changedName || '六爻安静' }
          ]
        : [
            { label: '卦象', value: '尚未起卦' },
            { label: '仪式', value: '三钱六爻' }
          ]
    case 'dream':
      return store.dreamSession
        ? [
            { label: '关键词', value: store.dreamSession.keyword },
            { label: '传统吉凶', value: store.dreamSession.luck || '已记录' }
          ]
        : [
            { label: '梦境', value: '尚未记录' },
            { label: '记录', value: '仅保存在此浏览器' }
          ]
    case 'sky':
      return [
        { label: '日期', value: info.value.dateStr },
        { label: '值宿', value: `${info.value.xiu} · ${info.value.xiuLuck}` },
        { label: '观测点', value: { default: '默认 · 北京', gps: '浏览器定位', manual: '手动坐标' }[store.location.source] }
      ]
    case 'kindred':
      return [
        { label: '日期', value: info.value.dateStr },
        { label: '日柱', value: info.value.dayGanZhi },
        { label: '值宿', value: info.value.xiu }
      ]
    case 'synthesis':
      return [
        { label: '日期', value: info.value.dateStr },
        { label: '资料范围', value: '历法 · 命盘 · 卦象 · 梦境' }
      ]
    case 'settings':
      return [
        { label: '存储', value: '浏览器本地' },
        { label: '动效', value: reducedMotion() ? '已减少动态' : '完整动态' }
      ]
    default:
      return []
  }
})

const activeCode = computed(() => activeTab.value.number ? `${activeTab.value.number} / ${activeTab.value.code}` : activeTab.value.code)

let errorTimer
let initialReadyTimer
let prefetchTimer
let homeScroll = 0
let pendingScroll = 0
let lenis
let unsubscribeLenis
let motionQuery
let returnFocus
let cardObserver
let cardMutation
let scrollStateTimer

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function scrollTo(top, immediate = false) {
  if (lenis) {
    lenis.scrollTo(top, immediate ? { immediate: true, force: true } : { duration: 1.05 })
  } else {
    window.scrollTo({ top, behavior: immediate || reducedMotion() ? 'auto' : 'smooth' })
  }
}

function documentTitle(chapter) {
  return chapter.key === 'home' ? '天机历 · 观天象，定此刻' : `${chapter.label} · 天机历`
}

async function ensureChapter(key) {
  if (componentCache.has(key)) return componentCache.get(key)
  if (!loaders[key]) throw new Error(`Unknown chapter: ${key}`)
  if (!loadingPromises.has(key)) {
    const promise = loaders[key]().then(module => {
      componentCache.set(key, module.default)
      return module.default
    }).finally(() => loadingPromises.delete(key))
    loadingPromises.set(key, promise)
  }
  return loadingPromises.get(key)
}

function markInitialReady() {
  window.clearTimeout(initialReadyTimer)
  initialReadyTimer = window.setTimeout(() => { viewReady.value = true }, 280)
}

function showLoadError(message) {
  loadError.value = message
  window.clearTimeout(errorTimer)
  errorTimer = window.setTimeout(() => { loadError.value = '' }, 5000)
}

async function activateChapter(chapter, { initial = false, updateHash = true } = {}) {
  if (!chapter) return false
  const sequence = ++requestSequence.value
  requestedKey.value = chapter.key
  viewPending.value = !componentCache.has(chapter.key)
  window.clearTimeout(errorTimer)
  loadError.value = ''
  if (active.value === 'home' && chapter.key !== 'home') homeScroll = window.scrollY

  let component
  try {
    component = await ensureChapter(chapter.key)
  } catch {
    viewPending.value = false
    if (initial) {
      active.value = 'home'
      requestedKey.value = 'home'
      current.value = HomeView
      history.replaceState(null, '', '#/')
      document.title = documentTitle(chapterByKey.home)
      markInitialReady()
    } else {
      requestedKey.value = active.value
      history.replaceState(null, '', activeTab.value.path)
      showLoadError(`${chapter.label}页面加载失败，请稍后再试。`)
    }
    return false
  }

  if (sequence !== requestSequence.value) return false
  viewPending.value = false
  active.value = chapter.key
  pendingScroll = chapter.key === 'home' ? homeScroll : 0
  current.value = component
  document.title = documentTitle(chapter)
  if (updateHash && window.location.hash !== chapter.path) {
    history.pushState(null, '', chapter.path)
  }
  await nextTick()
  if (initial) markInitialReady()
  return true
}

function navigateTo(key) {
  const chapter = chapterByKey[key]
  if (!chapter) return
  if (window.location.hash === chapter.path) {
    if (chapter.key === active.value) {
      if (chapter.key === 'home') scrollTo(0)
      return
    }
    activateChapter(chapter, { updateHash: false })
    return
  }
  window.location.hash = chapter.path
}

function handleHashChange() {
  if (window.location.hash && !window.location.hash.startsWith('#/')) return
  const chapter = chapterFromHash(window.location.hash)
  if (window.location.hash !== chapter.path) {
    history.replaceState(null, '', chapter.path)
  }
  if (chapter.key === active.value && current.value) return
  activateChapter(chapter, { updateHash: false })
}

function restoreScroll() {
  scrollTo(pendingScroll, true)
  requestAnimationFrame(() => ScrollTrigger.refresh())
}

function finishLoading() {
  showLoader.value = false
  window.clearTimeout(prefetchTimer)
  prefetchTimer = window.setTimeout(preloadChapters, 700)
}

function preloadChapters() {
  const run = () => {
    for (const chapter of chapters) {
      if (componentCache.has(chapter.key)) continue
      ensureChapter(chapter.key).catch(() => {})
    }
  }
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2500 })
  else run()
}

function openIndex() {
  returnFocus = document.activeElement
  indexOpen.value = true
  document.documentElement.classList.add('index-open')
  lenis?.stop()
  sound.sweep()
  nextTick(() => indexPanel.value?.querySelector('.index-link')?.focus())
}

function closeIndex(restoreFocus = true) {
  if (!indexOpen.value) return
  indexOpen.value = false
  document.documentElement.classList.remove('index-open')
  if (!reducedMotion() && !window.matchMedia('(pointer: coarse)').matches) lenis?.start()
  sound.sweep()
  if (restoreFocus) nextTick(() => (returnFocus || indexTrigger.value)?.focus())
}

function handleIndexKeys(event) {
  if (!indexOpen.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeIndex()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = [...(indexPanel.value?.querySelectorAll('button, a[href]') || [])].filter(element => !element.disabled)
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// 章节是扁平的：今日为上一层，左右键在同级之间移动。
function isTyping() {
  const element = document.activeElement
  return !element || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable
}

function siblingChapter(offset) {
  const index = chapters.findIndex(chapter => chapter.key === active.value)
  if (index < 0) return null
  return chapters[index + offset] || null
}

function handleShortcuts(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || store.aiOpen || isTyping()) return
  if (event.key === 'Backspace') {
    event.preventDefault()
    if (active.value !== 'home') navigateTo('home')
    return
  }
  if (indexOpen.value) return
  if (event.key === 'Escape') {
    if (active.value !== 'home') navigateTo('home')
    return
  }
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    const target = siblingChapter(event.key === 'ArrowRight' ? 1 : -1)
    if (!target) return
    event.preventDefault()
    navigateTo(target.key)
    return
  }
  if (event.key.toLowerCase() === 'i' && !event.shiftKey) {
    event.preventDefault()
    openIndex()
  }
}

function setupLenis() {
  if (lenis || reducedMotion() || window.matchMedia('(pointer: coarse)').matches) return
  lenis = new Lenis({ autoRaf: false, lerp: 0.09, smoothWheel: true, syncTouch: false, anchors: false })
  lenis.on('scroll', ScrollTrigger.update)
  unsubscribeLenis = subscribeMotion(time => lenis?.raf(time))
  ScrollTrigger.refresh()
}

function destroyLenis() {
  unsubscribeLenis?.()
  unsubscribeLenis = undefined
  lenis?.destroy()
  lenis = undefined
}

function handleMotionPreference() {
  destroyLenis()
  setupLenis()
}

function observeCards() {
  if (!cardObserver) return
  document.querySelectorAll('main .card:not([data-reveal])').forEach((card, index) => {
    card.dataset.reveal = ''
    card.style.setProperty('--reveal-order', String(index % 6))
    cardObserver.observe(card)
  })
}

function setupCardReveal() {
  cardObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      cardObserver.unobserve(entry.target)
    })
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 })
  observeCards()
  cardMutation = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.removedNodes.forEach(node => {
        if (!(node instanceof Element)) return
        if (node.matches('.card')) cardObserver.unobserve(node)
        node.querySelectorAll?.('.card').forEach(card => cardObserver.unobserve(card))
      })
    })
    observeCards()
  })
  cardMutation.observe(document.querySelector('main'), { childList: true, subtree: true })
}

function handleScrollState() {
  document.documentElement.classList.add('is-scrolling')
  window.clearTimeout(scrollStateTimer)
  scrollStateTimer = window.setTimeout(() => document.documentElement.classList.remove('is-scrolling'), 650)
}

function handleMagneticMove(event) {
  if (reducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
  const button = event.target instanceof Element ? event.target.closest('.btn:not(:disabled), .back-top') : null
  if (!button) return
  const rect = button.getBoundingClientRect()
  const x = Math.max(-3, Math.min(3, (event.clientX - rect.left - rect.width / 2) * 0.08))
  const y = Math.max(-3, Math.min(3, (event.clientY - rect.top - rect.height / 2) * 0.08))
  button.style.transform = `translate3d(${x}px,${y}px,0)`
}

function handleMagneticLeave(event) {
  const button = event.target instanceof Element ? event.target.closest('.btn, .back-top') : null
  if (!button || (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) return
  button.style.transform = ''
}

watch(() => store.tabRequest, key => {
  if (!key) return
  navigateTo(key)
  store.tabRequest = null
})

watch(() => store.aiOpen, open => {
  if (open) {
    lenis?.stop()
  } else if (!indexOpen.value && !reducedMotion() && !window.matchMedia('(pointer: coarse)').matches) {
    lenis?.start()
  }
})

onMounted(async () => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change', handleMotionPreference)
  setupLenis()
  setupCardReveal()
  window.addEventListener('keydown', handleIndexKeys)
  window.addEventListener('keydown', handleShortcuts)
  window.addEventListener('scroll', handleScrollState, { passive: true })
  window.addEventListener('pointermove', handleMagneticMove, { passive: true })
  window.addEventListener('pointerout', handleMagneticLeave, { passive: true })
  window.addEventListener('hashchange', handleHashChange)

  if (window.location.hash !== initialChapter.path) {
    history.replaceState(null, '', initialChapter.path)
  }
  document.title = documentTitle(initialChapter)
  if (initialChapter.key === 'home') {
    await nextTick()
    markInitialReady()
  } else {
    await activateChapter(initialChapter, { initial: true, updateHash: false })
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(errorTimer)
  window.clearTimeout(initialReadyTimer)
  window.clearTimeout(prefetchTimer)
  window.clearTimeout(scrollStateTimer)
  window.removeEventListener('keydown', handleIndexKeys)
  window.removeEventListener('keydown', handleShortcuts)
  window.removeEventListener('scroll', handleScrollState)
  window.removeEventListener('pointermove', handleMagneticMove)
  window.removeEventListener('pointerout', handleMagneticLeave)
  window.removeEventListener('hashchange', handleHashChange)
  motionQuery?.removeEventListener('change', handleMotionPreference)
  cardObserver?.disconnect()
  cardMutation?.disconnect()
  document.documentElement.classList.remove('index-open', 'is-scrolling')
  destroyLenis()
})
</script>

<template>
  <div class="app" :class="{ 'is-home': active === 'home', 'is-synthesis': active === 'synthesis', 'has-index': indexOpen }">
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <InkField :home="active === 'home'" :index-open="indexOpen" />
    <CelestialLoader v-if="showLoader" :ready="viewReady" @finished="finishLoading" />

    <header class="app-header">
      <div class="header-inner">
        <a class="brand" href="#/" aria-label="返回今日首页">
          <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="currentColor" />
            <path d="M32 3 A29 29 0 0 1 32 61 A14.5 14.5 0 0 1 32 32 A14.5 14.5 0 0 0 32 3" fill="var(--void)" />
            <circle cx="32" cy="17.5" r="4" fill="currentColor" />
            <circle cx="32" cy="46.5" r="4" fill="var(--void)" />
          </svg>
          <span class="brand-copy"><span class="app-title">天机历</span><span class="app-sub">TIANJI CALENDAR</span></span>
        </a>
        <div class="hud-actions">
          <button class="hud-button sound-toggle" type="button" :aria-pressed="sound.enabled" :aria-label="sound.enabled ? '关闭交互声音' : '开启交互声音'" @click="sound.toggle()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4Z" /><path v-if="sound.enabled" d="M16 9c1.7 1.7 1.7 4.3 0 6M18.5 6.5c3 3 3 8 0 11" /><path v-else d="m16 9 5 6m0-6-5 6" /></svg>
            <span>声音 {{ sound.enabled ? '开' : '关' }} <em class="hud-en">SOUND</em></span>
          </button>
          <a class="hud-button conclusion-trigger" href="#/synthesis" aria-label="前往合参">
            <span>合参 <em class="hud-en">SYNTH</em></span>
          </a>
          <button ref="indexTrigger" class="hud-button index-trigger" type="button" aria-haspopup="dialog" :aria-expanded="indexOpen" @click="indexOpen ? closeIndex() : openIndex()">
            <span>索引 <em class="hud-en">INDEX</em></span><i aria-hidden="true"></i><i aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </header>

    <main id="main-content" :aria-busy="showLoader || viewPending">
      <div class="view-shell" :class="{ 'is-home': active === 'home', 'is-synthesis': active === 'synthesis' }">
        <section v-if="active !== 'home' && activeTab.intro" class="case-intro" :aria-labelledby="`page-${active}`">
          <div class="case-topline">
            <a class="back-home" href="#/">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4M9 5l-5 5 5 5" /></svg>
              <span>返回今日</span>
            </a>
            <div class="chapter-pager" aria-label="章节切换">
              <a v-if="prevChapter" class="chapter-step" :href="prevChapter.path">← {{ prevChapter.label }}</a>
              <button class="chapter-step" type="button" @click="openIndex">章节索引</button>
              <a v-if="nextChapter" class="chapter-step" :href="nextChapter.path">{{ nextChapter.label }} →</a>
            </div>
            <p class="case-code">{{ activeCode }}</p>
          </div>
          <p class="case-kicker">{{ activeTab.label }} / {{ activeTab.code }}</p>
          <h1 :id="`page-${active}`">{{ activeTab.title }}</h1>
          <dl class="case-meta">
            <div v-for="fact in activeFacts" :key="fact.label">
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}</dd>
            </div>
          </dl>
        </section>
        <Transition name="view" mode="out-in" @after-enter="restoreScroll">
          <KeepAlive>
            <component v-if="current" :is="current" :key="active" />
          </KeepAlive>
        </Transition>
        <NextChapter v-if="activeTab.group === 'chapter'" :current="active" :items="readingChapters" />
      </div>
    </main>

    <Transition name="index-menu">
      <div v-if="indexOpen" class="index-mask" @click.self="closeIndex()">
        <section ref="indexPanel" class="index-panel" role="dialog" aria-modal="true" aria-label="全站章节索引">
          <header class="index-head"><span>TIANJI / INDEX</span><button type="button" aria-label="关闭索引" @click="closeIndex()">关闭 ×</button></header>
          <div class="index-word" aria-hidden="true">INDEX</div>
          <nav class="index-list" aria-label="全部章节与偏好">
            <a v-for="(item, index) in indexItems" :key="item.key" class="index-link" :class="{ active: active === item.key }" :style="{ '--i': index }" :href="item.path" :aria-current="active === item.key ? 'page' : undefined" @click="closeIndex(false)">
              <span class="index-number">{{ item.number || '—' }}</span>
              <strong>{{ item.label }}</strong>
              <span class="index-meta">{{ item.meta }}</span>
              <span class="index-arrow" aria-hidden="true">↗</span>
            </a>
          </nav>
          <footer class="index-foot">
            <p class="index-keys"><kbd>←</kbd><kbd>→</kbd>换章 · <kbd>Backspace</kbd>回今日 · <kbd>I</kbd>索引 · <kbd>Esc</kbd>关闭</p>
            <p>观时 · 知位 · 见天地</p>
          </footer>
        </section>
      </div>
    </Transition>

    <div v-if="viewPending" class="route-pending" role="status">正在载入章节…</div>
    <div v-if="loadError" class="view-load-error" role="alert">{{ loadError }}</div>
    <footer class="footer-note">
      <div class="footer-brand-row">
        <span class="footer-brand">天机历</span>
        <div class="footer-actions">
          <a v-if="active !== 'home'" class="back-top footer-home" href="#/">返回今日 <span aria-hidden="true">↖</span></a>
          <button class="back-top" type="button" @click="scrollTo(0)">回到顶部 <span aria-hidden="true">↑</span></button>
        </div>
      </div>
      <p>内容源于《周易》、传统历法与民俗文化，仅供文化体验与娱乐参考。</p>
      <p>不构成医疗、投资、法律或人生决策建议。命自我立，福自己求。</p>
    </footer>
    <AiPanel />
  </div>
</template>
