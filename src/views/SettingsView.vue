<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { sound } from '../lib/sound.js'
import { AI_CONFIG_ENDPOINT } from '../lib/ai.js'

const clearArmed = ref(false)
const reducedMotion = ref(false)
const aiStatus = ref(null)
const aiLoading = ref(true)
const aiSaving = ref(false)
const aiClearArmed = ref(false)
const aiError = ref('')
const aiMessage = ref('')
const aiForm = reactive({ baseUrl: '', model: '', apiKey: '' })
let motionQuery

const aiStatusLabel = computed(() => {
  if (aiLoading.value) return '检查中'
  if (!aiStatus.value?.configurable) return '服务端管理'
  return aiStatus.value?.configured ? '已配置' : '未配置'
})

const aiStatusHint = computed(() => {
  if (aiLoading.value) return '正在检查本机智能解读配置…'
  if (!aiStatus.value?.configurable) return '当前环境不开放浏览器配置，智能解读服务由服务端环境变量提供。'
  if (!aiStatus.value?.configured) return '填写访问密钥后即可生成最终综述。'
  if (aiStatus.value.source === 'env') return '密钥由服务端环境变量提供。'
  return '密钥保存在本机用户目录，只用于同源解读代理。'
})

function updateMotionPreference(event) {
  reducedMotion.value = event.matches
}

async function loadAiStatus() {
  aiLoading.value = true
  try {
    const response = await fetch(AI_CONFIG_ENDPOINT, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })
    const data = await response.json()
    if (!response.ok || typeof data?.configured !== 'boolean') throw new Error('unavailable')
    aiStatus.value = data
  } catch {
    aiStatus.value = { configured: false, configurable: false, source: 'server' }
  } finally {
    aiLoading.value = false
  }
}

async function saveAiConfig() {
  if (aiSaving.value || !aiStatus.value?.configurable) return
  aiError.value = ''
  aiMessage.value = ''
  aiSaving.value = true
  try {
    const response = await fetch(AI_CONFIG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        baseUrl: aiForm.baseUrl,
        model: aiForm.model,
        apiKey: aiForm.apiKey
      })
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || '配置保存失败，请检查后重试。')
    aiStatus.value = data
    aiForm.apiKey = ''
    aiClearArmed.value = false
    aiMessage.value = '智能解读配置已保存，可以直接生成天机综述。'
  } catch (error) {
    aiError.value = error.message || '配置保存失败，请稍后再试。'
  } finally {
    aiSaving.value = false
  }
}

async function clearAiConfig() {
  if (aiSaving.value) return
  aiError.value = ''
  aiMessage.value = ''
  aiSaving.value = true
  try {
    const response = await fetch(AI_CONFIG_ENDPOINT, {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || '移除失败，请稍后重试。')
    aiStatus.value = data
    aiForm.apiKey = ''
    aiClearArmed.value = false
    aiMessage.value = data.configured ? '已移除本机密钥，当前使用服务端环境变量。' : '已移除本机智能解读密钥。'
  } catch (error) {
    aiError.value = error.message || '移除失败，请稍后再试。'
  } finally {
    aiSaving.value = false
  }
}

function clearLocalData() {
  try {
    const keys = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith('tianji.')) keys.push(key)
    }
    keys.forEach(key => localStorage.removeItem(key))
  } catch { /* 浏览器可能禁用本地存储 */ }
  window.location.reload()
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', updateMotionPreference)
  loadAiStatus()
})

onBeforeUnmount(() => motionQuery?.removeEventListener('change', updateMotionPreference))
</script>

<template>
  <div class="settings-view">
    <div class="card">
      <h2 class="card-title">智能解读服务</h2>
      <div class="setting-row">
        <div>
          <strong>服务状态</strong>
          <p class="muted">{{ aiStatusHint }}</p>
        </div>
        <span class="settings-state">{{ aiStatusLabel }}</span>
      </div>
      <form v-if="!aiLoading && aiStatus?.configurable" class="ai-config-form" @submit.prevent="saveAiConfig">
        <label class="ai-field ai-field-key">
          <span>访问密钥</span>
          <input
            v-model="aiForm.apiKey"
            type="password"
            autocomplete="new-password"
            :placeholder="aiStatus.configured ? '已配置，留空则保持不变' : '填写智能解读服务密钥'"
          >
        </label>
        <details class="ai-advanced">
          <summary>高级设置：接口与模型</summary>
          <div class="ai-config-grid">
            <label class="ai-field">
              <span>接口地址</span>
              <input v-model="aiForm.baseUrl" type="url" autocomplete="off" placeholder="留空使用默认接口">
            </label>
            <label class="ai-field">
              <span>模型</span>
              <input v-model="aiForm.model" type="text" autocomplete="off" placeholder="留空使用默认模型">
            </label>
          </div>
        </details>
        <p class="muted ai-config-note">密钥只写入本机服务端用户目录，不回传浏览器、不进入浏览器存储或构建产物。该配置入口仅在本地开发与预览环境开放。</p>
        <p v-if="aiError" class="ai-config-error" role="alert">{{ aiError }}</p>
        <p v-if="aiMessage" class="ai-config-message" role="status">{{ aiMessage }}</p>
        <div class="ai-config-actions">
          <button class="btn small" type="submit" :disabled="aiSaving">{{ aiSaving ? '正在保存…' : '保存智能解读配置' }}</button>
          <template v-if="aiStatus.configured && aiStatus.source === 'local'">
            <button v-if="!aiClearArmed" class="btn ghost small" type="button" :disabled="aiSaving" @click="aiClearArmed = true">移除本机密钥</button>
            <template v-else>
              <button class="btn small" type="button" :disabled="aiSaving" @click="clearAiConfig">确认移除</button>
              <button class="btn ghost small" type="button" @click="aiClearArmed = false">取消</button>
            </template>
          </template>
          <a class="btn ghost small" href="#/synthesis">前往生成天机综述</a>
        </div>
      </form>
      <div v-else-if="!aiLoading" class="ai-config-actions ai-config-actions-static">
        <a class="btn ghost small" href="#/synthesis">前往生成天机综述</a>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">关于本工具</h2>
      <p class="muted settings-copy">
        「天机历」是一款传统文化体验工具，融合《周易》六十四卦、传统黄历、二十八宿值日与八字五行民俗。
        所有内容仅供文化体验与娱乐参考。
      </p>
      <p class="muted settings-copy">
        历法数据由开源农历库推算，卦爻辞取自公版《周易》原文。古人云：「积善之家，必有余庆。」
        运势之说，贵在劝人向善、顺势而为，切勿迷信。
      </p>
    </div>

    <div class="card">
      <h2 class="card-title">声音与动效</h2>
      <div class="setting-row">
        <div>
          <strong>交互声音</strong>
          <p class="muted">铜钱、索引、章节切换与墨晕的合成音。</p>
        </div>
        <button class="btn ghost small" type="button" :aria-pressed="sound.enabled" @click="sound.toggle()">
          {{ sound.enabled ? '关闭声音' : '开启声音' }}
        </button>
      </div>
      <div class="setting-row">
        <div>
          <strong>动态效果</strong>
          <p class="muted">跟随系统「减少动态效果」设置，自动切换为静态星轨与静态首屏。</p>
        </div>
        <span class="settings-state">{{ reducedMotion ? '已减少动态' : '完整动态' }}</span>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">数据与隐私</h2>
      <ul class="privacy-list">
        <li>生辰、当前解读日期、摇卦与解梦记录只保存在此浏览器。</li>
        <li>手动设置的位置只在当前会话中使用，不写入本地存储。</li>
        <li>只有你主动生成智能解读时，解读所需上下文才会发送给站点的同源解读服务；原始经纬度不随请求发送。</li>
        <li>智能解读密钥若在本机设置，只保存在服务端的本地用户目录，不写入浏览器存储或构建产物；部署环境由服务端环境变量提供。</li>
      </ul>
      <div class="data-actions">
        <button v-if="!clearArmed" class="btn ghost small" type="button" @click="clearArmed = true">清除本地数据</button>
        <div v-else class="clear-confirm" role="alert">
          <p>将清除生辰、卦象、梦境、声音偏好等所有浏览器本地数据，无法恢复；本机服务端的智能解读配置不受影响。</p>
          <div class="row">
            <button class="btn small" type="button" @click="clearLocalData">确认清除</button>
            <button class="btn ghost small" type="button" @click="clearArmed = false">取消</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">来源与考据</h2>
      <p class="muted settings-copy">黄历宜忌与神煞参考《协纪辨方书》体例，八字排盘参考《渊海子平》，卦辞采用《周易》公版原文。星宿、建除与节气由开源农历库推算。</p>
    </div>

    <div class="card">
      <h2 class="card-title">免责声明</h2>
      <p class="muted settings-copy">
        本站内容不构成医疗、投资、法律或人生决策建议。命自我立，福自己求。
      </p>
    </div>
  </div>
</template>

<style scoped>
.settings-view { display: flex; flex-direction: column; gap: 0; }
.settings-copy { line-height: 1.9; }
.settings-copy + .settings-copy { margin-top: 10px; }
.setting-row { display: flex; min-height: 74px; padding: 16px 0; align-items: center; justify-content: space-between; gap: 20px; border-top: 1px solid var(--line); }
.setting-row:first-of-type { border-top: 0; padding-top: 0; }
.setting-row strong { display: block; font-size: 13px; font-weight: 400; letter-spacing: 0.08em; }
.setting-row p { margin-top: 5px; line-height: 1.7; }
.settings-state { flex: 0 0 auto; color: var(--silver); font-size: 12px; letter-spacing: 0.08em; }
.ai-config-form { display: grid; gap: 14px; padding-top: 18px; border-top: 1px solid var(--line); }
.ai-config-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.ai-advanced { border-top: 1px solid var(--line); }
.ai-advanced summary { display: flex; min-height: 44px; align-items: center; color: var(--silver); cursor: pointer; font-size: 12px; letter-spacing: 0.08em; }
.ai-advanced summary::before { margin-right: 8px; color: var(--muted); content: '+'; }
.ai-advanced[open] summary::before { content: '−'; }
.ai-advanced .ai-config-grid { padding: 4px 0 2px; }
.ai-field { display: grid; min-width: 0; gap: 7px; color: var(--muted); font-size: 12px; letter-spacing: 0.08em; }
.ai-field-key { grid-column: 1 / -1; }
.ai-field input { width: 100%; min-height: 46px; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 0; background: oklch(0.97 0 0 / 0.025); color: var(--glow); font-size: 13px; letter-spacing: 0; }
.ai-field input:focus { border-color: var(--glow); outline: none; }
.ai-field input::placeholder { color: var(--muted); }
.ai-config-note { line-height: 1.8; font-size: 11px; }
.ai-config-error,
.ai-config-message { padding: 10px 12px; border: 1px solid var(--line-strong); color: var(--silver); font-size: 12px; line-height: 1.7; }
.ai-config-error { border-color: oklch(0.72 0 0 / 0.55); }
.ai-config-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.ai-config-actions-static { padding-top: 16px; border-top: 1px solid var(--line); }
.privacy-list { display: grid; gap: 9px; padding-left: 1.2em; color: var(--silver); font-size: 13px; line-height: 1.8; }
.privacy-list li::marker { color: var(--muted); content: '— '; }
.data-actions { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line); }
.clear-confirm { padding: 14px 16px; border: 1px solid var(--line-strong); background: oklch(0.97 0 0 / 0.035); }
.clear-confirm p { margin-bottom: 12px; color: var(--silver); font-size: 12px; line-height: 1.8; }
@media (max-width: 640px) {
  .ai-config-grid { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .setting-row { align-items: flex-start; flex-direction: column; gap: 12px; }
}
</style>
