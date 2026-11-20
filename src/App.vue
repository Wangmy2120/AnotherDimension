<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Lenis from 'lenis'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { store, dayInfo, bazi, fortune } from './store.js'
import { subscribeMotion } from './lib/motion.js'
import { sound } from './lib/sound.js'
import HomeView from './views/HomeView.vue'
import CelestialLoader from './components/CelestialLoader.vue'
import AiPanel from './components/AiPanel.vue'
import InkField from './components/InkField.vue'
import NextChapter from './components/NextChapter.vue'

const tabs = [
  { key: 'home', label: '今日', code: 'ORIGIN', comp: HomeView },
  { key: 'almanac', label: '黄历', code: 'ALMANAC', loader: () => import('./views/AlmanacView.vue') },
  { key: 'zeji', label: '择吉', code: 'SELECTION', loader: () => import('./views/ZejiView.vue') },
  { key: 'fortune', label: '运势', code: 'FORTUNE', loader: () => import('./views/FortuneView.vue') },
  { key: 'bazi', label: '八字', code: 'NATAL CHART', loader: () => import('./views/BaziView.vue') },
  { key: 'gua', label: '摇卦', code: 'DIVINATION', loader: () => import('./views/DivinationView.vue') },
  { key: 'dream', label: '解梦', code: 'ONEIRIC', loader: () => import('./views/DreamView.vue') },
  { key: 'settings', label: '设置', code: 'CALIBRATION', loader: () => import('./views/SettingsView.vue') }
]

const active = ref('home')
const requestedKey = ref('home')
const current = shallowRef(HomeView)
const showLoader = ref(true)
const viewReady = ref(false)
const loadError = ref('')
const requestSequence = ref(0)
const indexOpen = ref(false)
const indexPanel = ref(null)
const indexTrigger = ref(null)
const quickNav = ref(null)
const activeTab = computed(() => tabs.find(tab => tab.key === active.value) || tabs[0])
const activeIndex = computed(() => tabs.findIndex(tab => tab.key === active.value))
const info = computed(() => dayInfo())
const chart = computed(() => bazi())
const todayFortune = computed(() => fortune())
const indexItems = computed(() => {
  const metadata = {
    home: `${info.value.dayGanZhi}日 · ${info.value.lunarText}`,
    almanac: `${info.value.xiuName}宿 · ${info.value.xiuLuck}`,
    zeji: `${info.value.dateStr} · 冲${info.value.chong}`,
    fortune: `综合 ${todayFortune.value.overall} / 100`,
    bazi: chart.value ? `${chart.value.dayGan}日主 · ${chart.value.shengXiao}` : '等待录入生辰',
    gua: store.hexSession?.result?.primaryName || '尚未起卦',
    dream: store.dreamSession?.keyword || '尚未记录',
    settings: store.settings?.apiKey ? '模型已配置' : '模型待配置'
  }
  return tabs.map((tab, index) => ({ ...tab, number: String(index + 1).padStart(2, '0'), metadata: metadata[tab.key] }))
})

let loaderDelay
let errorTimer
let initialReadyTimer
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

async function switchTab(t) {
  if (requestedKey.value === t.key) {
    if (t.key === 'home') scrollTo(0)
    return
  }
  requestedKey.value = t.key
  const sequence = ++requestSequence.value
  window.clearTimeout(loaderDelay)
  window.clearTimeout(errorTimer)
  loadError.value = ''
  if (active.value === 'home') homeScroll = window.scrollY

  let currentLoaderDelay
  if (!t.comp) {
    viewReady.value = false
    currentLoaderDelay = window.setTimeout(() => {
      if (sequence === requestSequence.value) showLoader.value = true
    }, 160)
    loaderDelay = currentLoaderDelay
    try {
      const module = await t.loader()
      if (sequence !== requestSequence.value) return
      t.comp = module.default
    } catch {
      if (sequence === requestSequence.value) {
        requestedKey.value = active.value
        loadError.value = `${t.label}页面加载失败，请再次点击标签重试。`
        viewReady.value = true
        errorTimer = window.setTimeout(() => { loadError.value = '' }, 5000)
      }
      return
    } finally {
      window.clearTimeout(currentLoaderDelay)
    }
  }

  if (sequence !== requestSequence.value) return
  active.value = t.key
  pendingScroll = t.key === 'home' ? homeScroll : 0
  current.value = t.comp
  await nextTick()
  if (showLoader.value) viewReady.value = true
}

function restoreScroll() {
  scrollTo(pendingScroll, true)
  requestAnimationFrame(() => ScrollTrigger.refresh())
}

function finishLoading() {
  showLoader.value = false
  viewReady.value = false
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

function selectTab(tab) {
  closeIndex(false)
  switchTab(tab)
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

function setupLenis() {
  if (lenis || reducedMotion() || window.matchMedia('(pointer: coarse)').matches) return
  lenis = new Lenis({ autoRaf: false, lerp: 0.09, smoothWheel: true, syncTouch: false, anchors: true })
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
  const tab = tabs.find(item => item.key === key)
  if (tab) switchTab(tab)
  store.tabRequest = null
})

watch(active, async () => {
  await nextTick()
  const nav = quickNav.value
  const currentButton = nav?.querySelector('[aria-current="page"]')
  if (nav && currentButton) nav.scrollLeft = currentButton.offsetLeft - nav.clientWidth / 2 + currentButton.clientWidth / 2
})

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change', handleMotionPreference)
  setupLenis()
  setupCardReveal()
  window.addEventListener('keydown', handleIndexKeys)
  window.addEventListener('scroll', handleScrollState, { passive: true })
  window.addEventListener('pointermove', handleMagneticMove, { passive: true })
  window.addEventListener('pointerout', handleMagneticLeave, { passive: true })
  initialReadyTimer = window.setTimeout(() => { viewReady.value = true }, 320)
})

onBeforeUnmount(() => {
  window.clearTimeout(loaderDelay)
  window.clearTimeout(errorTimer)
  window.clearTimeout(initialReadyTimer)
  window.clearTimeout(scrollStateTimer)
  window.removeEventListener('keydown', handleIndexKeys)
  window.removeEventListener('scroll', handleScrollState)
  window.removeEventListener('pointermove', handleMagneticMove)
  window.removeEventListener('pointerout', handleMagneticLeave)
  motionQuery?.removeEventListener('change', handleMotionPreference)
  cardObserver?.disconnect()
  cardMutation?.disconnect()
  document.documentElement.classList.remove('index-open', 'is-scrolling')
  destroyLenis()
})
</script>

<template>
  <div class="app" :class="{ 'is-home': active === 'home', 'has-index': indexOpen }">
    <InkField :home="active === 'home'" :index-open="indexOpen" />
    <CelestialLoader v-if="showLoader" :key="requestSequence" :ready="viewReady" @finished="finishLoading" />

    <header class="app-header">
      <div class="header-inner">
        <button class="brand" type="button" aria-label="返回今日首页" @click="switchTab(tabs[0])">
          <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="currentColor" />
            <path d="M32 3 A29 29 0 0 1 32 61 A14.5 14.5 0 0 1 32 32 A14.5 14.5 0 0 0 32 3" fill="var(--void)" />
            <circle cx="32" cy="17.5" r="4" fill="currentColor" />
            <circle cx="32" cy="46.5" r="4" fill="var(--void)" />
          </svg>
          <span class="brand-copy"><span class="app-title">天机历</span><span class="app-sub">TIANJI CALENDAR</span></span>
        </button>
        <div class="hud-actions">
          <button class="hud-button sound-toggle" type="button" :aria-pressed="sound.enabled" :aria-label="sound.enabled ? '关闭交互声音' : '开启交互声音'" @click="sound.toggle()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4Z" /><path v-if="sound.enabled" d="M16 9c1.7 1.7 1.7 4.3 0 6M18.5 6.5c3 3 3 8 0 11" /><path v-else d="m16 9 5 6m0-6-5 6" /></svg>
            <span>声音 {{ sound.enabled ? '开' : '关' }}</span>
          </button>
          <button ref="indexTrigger" class="hud-button index-trigger" type="button" aria-haspopup="dialog" :aria-expanded="indexOpen" @click="indexOpen ? closeIndex() : openIndex()">
            <span>索引</span><i aria-hidden="true"></i><i aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <nav v-if="active !== 'home'" ref="quickNav" class="quick-nav" aria-label="快速切换功能">
        <button v-for="tab in tabs" :key="tab.key" type="button" :class="{ active: active === tab.key }" :aria-current="active === tab.key ? 'page' : undefined" @click="switchTab(tab)">{{ tab.label }}</button>
      </nav>
    </header>

    <main :aria-busy="showLoader">
      <div class="view-shell" :class="{ 'is-home': active === 'home' }">
        <section v-if="active !== 'home'" class="case-intro" :aria-labelledby="`page-${active}`">
          <div class="case-topline">
            <button class="back-home" type="button" @click="switchTab(tabs[0])">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16 10H4M9 5l-5 5 5 5" /></svg>
              <span>返回首页</span>
            </button>
            <p class="case-code">{{ String(activeIndex + 1).padStart(2, '0') }} / {{ activeTab.code }}</p>
          </div>
          <h1 :id="`page-${active}`">{{ activeTab.label }}</h1>
          <dl class="case-meta">
            <div><dt>日期</dt><dd>{{ info.dateStr }}</dd></div>
            <div><dt>干支</dt><dd>{{ info.dayGanZhi }}日</dd></div>
            <div><dt>值宿</dt><dd>{{ info.xiuName }} · {{ info.xiuLuck }}</dd></div>
            <div><dt>状态</dt><dd>{{ indexItems[activeIndex]?.metadata }}</dd></div>
          </dl>
        </section>
        <Transition name="view" mode="out-in" @after-enter="restoreScroll">
          <KeepAlive><component :is="current" :key="active" /></KeepAlive>
        </Transition>
        <NextChapter v-if="active !== 'home'" :current="active" :tabs="tabs" />
      </div>
    </main>

    <Transition name="index-menu">
      <div v-if="indexOpen" class="index-mask" @click.self="closeIndex()">
        <section ref="indexPanel" class="index-panel" role="dialog" aria-modal="true" aria-label="全站功能索引">
          <header class="index-head"><span>TIANJI / INDEX</span><button type="button" aria-label="关闭索引" @click="closeIndex()">关闭 ×</button></header>
          <div class="index-word" aria-hidden="true">INDEX</div>
          <nav class="index-list" aria-label="全部八项功能">
            <button v-for="(item, index) in indexItems" :key="item.key" class="index-link" :class="{ active: active === item.key }" :style="{ '--i': index }" type="button" :aria-current="active === item.key ? 'page' : undefined" @click="selectTab(item)">
              <span class="index-number">{{ item.number }}</span>
              <strong>{{ item.label }}</strong>
              <span class="index-meta">{{ item.metadata }}</span>
              <span class="index-arrow" aria-hidden="true">↗</span>
            </button>
          </nav>
          <footer class="index-foot">ESC 关闭 · 观时 · 知位 · 见天地</footer>
        </section>
      </div>
    </Transition>

    <div v-if="loadError" class="view-load-error" role="alert">{{ loadError }}</div>
    <footer class="footer-note">
      <div class="footer-brand-row">
        <span class="footer-brand">天机历</span>
        <div class="footer-actions">
          <button v-if="active !== 'home'" class="back-top footer-home" type="button" @click="switchTab(tabs[0])">返回首页 <span aria-hidden="true">↖</span></button>
          <button class="back-top" type="button" @click="scrollTo(0)">回到顶部 <span aria-hidden="true">↑</span></button>
        </div>
      </div>
      <p>内容源于《周易》、传统历法与民俗文化，仅供文化体验与娱乐参考。</p>
      <p>不构成医疗、投资、法律或人生决策建议。命自我立，福自己求。</p>
    </footer>
    <AiPanel />
  </div>
</template>
