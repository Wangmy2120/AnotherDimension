import { reactive, watch } from 'vue'
import { todayStr, getDayInfo, getBazi } from './lib/calendar.js'
import { getFortune } from './lib/fortune.js'
import { loadSettings, saveSettings } from './lib/ai.js'

const PROFILE_KEY = 'tianji.profile'

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY))
  } catch {
    return null
  }
}

export const store = reactive({
  dateStr: todayStr(),
  profile: loadProfile(),
  settings: loadSettings(),
  location: { latitude: 39.9042, longitude: 116.4074, source: 'default' },
  aiOpen: false,
  aiContextKind: 'daily',
  hexSession: null,
  dreamSession: null,
  tabRequest: null
})

watch(() => store.profile, p => {
  if (p) localStorage.setItem(PROFILE_KEY, JSON.stringify(p))
  else localStorage.removeItem(PROFILE_KEY)
}, { deep: true })

watch(() => store.settings, s => saveSettings(s), { deep: true })

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