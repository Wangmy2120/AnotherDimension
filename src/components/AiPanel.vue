<script setup>
import { ref, watch } from 'vue'
import { store, dayInfo, bazi, fortune } from '../store.js'
import { buildContext, streamInterpret } from '../lib/ai.js'

const text = ref('')
const loading = ref(false)
const error = ref('')
let controller = null

watch(() => store.aiOpen, async open => {
  if (!open) {
    controller?.abort()
    return
  }
  text.value = ''
  error.value = ''
  if (!store.settings.apiKey) {
    error.value = '尚未配置大模型 API Key，请先到「设置」页填写（默认使用 DeepSeek）。'
    return
  }
  const ctx = {
    dayInfo: dayInfo(),
    bazi: bazi(),
    fortune: fortune()
  }
  if (store.aiContextKind === 'hexagram' && store.hexSession) {
    ctx.hexResult = store.hexSession.result
    ctx.question = store.hexSession.question
  }
  if (store.aiContextKind === 'dream' && store.dreamSession) {
    ctx.dream = store.dreamSession
  }
  loading.value = true
  controller = new AbortController()
  try {
    await streamInterpret(buildContext(ctx), store.settings, d => { text.value += d }, controller.signal)
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message || '请求失败，请检查网络与 API 配置。'
  } finally {
    loading.value = false
  }
})

function close() {
  store.aiOpen = false
}
</script>

<template>
  <div v-if="store.aiOpen" class="modal-mask" @click.self="close">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title">
      <div class="modal-head">
        <h3 id="ai-dialog-title">{{ { hexagram: '卦象解读', dream: '梦境解读' }[store.aiContextKind] || '今日解读' }}</h3>
        <button class="modal-close" type="button" aria-label="关闭解读" @click="close">✕</button>
      </div>
      <div class="modal-body">
        <p v-if="error" class="muted" style="color: var(--cinnabar); line-height: 1.8">{{ error }}</p>
        <div v-else class="ai-text" :class="{ 'ai-cursor': loading }">{{ text || '正在凝神推演……' }}</div>
        <p class="muted small" style="margin-top: 14px">AI 生成内容仅供娱乐参考</p>
      </div>
    </div>
  </div>
</template>