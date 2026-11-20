<script setup>
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { store } from './store.js'
import HomeView from './views/HomeView.vue'
import CelestialLoader from './components/CelestialLoader.vue'
import AiPanel from './components/AiPanel.vue'

const tabs = [
  { key: 'home', label: '今日', comp: HomeView },
  { key: 'almanac', label: '黄历', loader: () => import('./views/AlmanacView.vue') },
  { key: 'zeji', label: '择吉', loader: () => import('./views/ZejiView.vue') },
  { key: 'fortune', label: '运势', loader: () => import('./views/FortuneView.vue') },
  { key: 'bazi', label: '八字', loader: () => import('./views/BaziView.vue') },
  { key: 'gua', label: '摇卦', loader: () => import('./views/DivinationView.vue') },
  { key: 'dream', label: '解梦', loader: () => import('./views/DreamView.vue') },
  { key: 'settings', label: '设置', loader: () => import('./views/SettingsView.vue') }
]
const active = ref('home')
const requestedKey = ref('home')
const current = shallowRef(HomeView)
const showLoader = ref(false)
const viewReady = ref(false)
const loadError = ref('')
const requestSequence = ref(0)
let loaderDelay
let errorTimer
let homeScroll = 0
let pendingScroll = 0

async function switchTab(t) {
  if (requestedKey.value === t.key) {
    if (t.key === 'home') {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      })
    }
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
  window.scrollTo({ top: pendingScroll, behavior: 'auto' })
}

function finishLoading() {
  showLoader.value = false
  viewReady.value = false
}

watch(() => store.tabRequest, key => {
  if (!key) return
  const t = tabs.find(x => x.key === key)
  if (t) switchTab(t)
  store.tabRequest = null
})

onBeforeUnmount(() => {
  window.clearTimeout(loaderDelay)
  window.clearTimeout(errorTimer)
})
</script>

<template>
  <div class="app" :class="{ 'is-home': active === 'home' }">
    <CelestialLoader
      v-if="showLoader"
      :key="requestSequence"
      :ready="viewReady"
      @finished="finishLoading"
    />
    <header class="app-header">
      <div class="header-inner">
        <button class="brand" type="button" aria-label="返回今日首页" @click="switchTab(tabs[0])">
          <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="currentColor" />
            <path d="M32 3 A29 29 0 0 1 32 61 A14.5 14.5 0 0 1 32 32 A14.5 14.5 0 0 0 32 3" fill="var(--paper)" />
            <circle cx="32" cy="17.5" r="4" fill="currentColor" />
            <circle cx="32" cy="46.5" r="4" fill="var(--paper)" />
          </svg>
          <span class="brand-copy">
            <span class="app-title">天机历</span>
            <span class="app-sub">TIANJI CALENDAR</span>
          </span>
        </button>
        <nav class="nav" aria-label="主要功能">
          <button v-for="t in tabs" :key="t.key" type="button" :class="{ active: active === t.key }"
            :aria-current="active === t.key ? 'page' : undefined" @click="switchTab(t)">
            {{ t.label }}
          </button>
        </nav>
        <div class="seal"><span>观时 · 知位 · 见天地</span>传统文化体验</div>
      </div>
    </header>
    <main :aria-busy="showLoader">
      <Transition name="view" mode="out-in" @after-enter="restoreScroll">
        <KeepAlive>
          <component :is="current" :key="active" />
        </KeepAlive>
      </Transition>
    </main>
    <div v-if="loadError" class="view-load-error" role="alert">{{ loadError }}</div>
    <footer class="footer-note">
      <p>内容源于《周易》、传统历法与民俗文化，仅供文化体验与娱乐参考。</p>
      <p>不构成医疗、投资、法律或人生决策建议。命自我立，福自己求。</p>
    </footer>
    <AiPanel />
  </div>
</template>
