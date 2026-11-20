import { reactive, watch } from 'vue'
import { todayStr, getDayInfo, getBazi } from './lib/calendar.js'
import { getFortune } from './lib/fortune.js'
import { buildResult } from './lib/hexagram.js'

const PROFILE_KEY = 'tianji.profile'

try {
  localStorage.removeItem('tianji.settings')
} catch { /* 浏览器可能禁用本地存储 */ }

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY))
  } catch {
    return null
  }
}

function loadHexSession() {
  try {
    const saved = JSON.parse(localStorage.getItem('tianji.gua.latest'))
    if (!saved || (saved.date && saved.date !== todayStr()) || !Array.isArray(saved.lines) || saved.lines.length !== 6) return null
    return { result: buildResult(saved.lines), question: saved.question || '' }
  } catch {
    return null
  }
}

function loadDreamSession() {
  try {
    const saved = JSON.parse(localStorage.getItem('tianji.dream.selection'))
    if (!saved?.keyword || (saved.date && saved.date !== todayStr())) return null
    return saved
  } catch {
    return null
  }
}

export const store = reactive({
  dateStr: todayStr(),
  profile: loadProfile(),
  location: { latitude: 39.9042, longitude: 116.4074, source: 'default' },
  aiOpen: false,
  aiContextKind: 'daily',
  hexSession: loadHexSession(),
  dreamSession: loadDreamSession(),
  tabRequest: null
})

watch(() => store.profile, p => {
  if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  else localStorage.removeItem(PROFILE_KEY)
}, { deep: true })

export function dayInfo() {
  return getDayInfo(store.dateStr)
}

export function bazi() {
  return store.profile ? getBazi(store.profile) : null
}

export function fortune() {
  return getFortune(dayInfo(), bazi(), store.profile?.gender)
}

export function openAi(kind) {
  store.aiContextKind = kind
  store.aiOpen = true
}