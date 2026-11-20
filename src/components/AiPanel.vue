<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { store, dayInfo, bazi, fortune } from '../store.js'
import { buildContext, streamInterpret } from '../lib/ai.js'

const text = ref('')
const loading = ref(false)
const error = ref('')
const dialog = ref(null)
const closeButton = ref(null)
let controller = null
let lastActive = null

const sourceItems = computed(() => {
  const items = []
  const day = dayInfo()
  items.push({
    label: '黄历',
    text: `宜${day.yi.slice(0, 4).join('、')}；忌${day.ji.slice(0, 4).join('、')}；${day.chongLabel}。`,
    source: '《协纪辨方书》体例'
  })
  if (store.aiContextKind === 'hexagram' && store.hexSession) {
    const result = store.hexSession.result
    items.push({
      label: '卦象',
      text: `${result.primaryName}${result.changedName ? ` → ${result.changedName}` : '（六爻安静）'}。`,
      source: '《周易》公版原文'
    })
  }
  if (store.aiContextKind === 'dream' && store.dreamSession) {
    items.push({
      label: '梦象',
      text: `${store.dreamSession.keyword}：${store.dreamSession.text}`,
      source: '民俗象征与《周公解梦》通俗传统'
    })
  }
  return items
})

watch(() => store.aiOpen, async open => {
  if (!open) {
    controller?.abort()
    document.documentElement.classList.remove('modal-open')
    if (lastActive?.isConnected) lastActive.focus()
    lastActive = null
    return
  }
  lastActive = document.activeElement
  document.documentElement.classList.add('modal-open')
  text.value = ''
  error.value = ''
  await nextTick()
  closeButton.value?.focus()
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
    await streamInterpret(buildContext(ctx), d => { text.value += d }, controller.signal)
  } catch (e) {
    if (e.name !== 'AbortError') error.value = e.message || 'AI 解读暂时不可用，请稍后再试。'
  } finally {
    loading.value = false
  }
})

function close() {
  store.aiOpen = false
}

function handleKeydown(event) {
  if (!store.aiOpen) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = [...(dialog.value?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [])]
    .filter(element => !element.disabled && element.getClientRects().length > 0)
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

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  controller?.abort()
  document.documentElement.classList.remove('modal-open')
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="store.aiOpen" class="modal-mask" @click.self="close">
    <div ref="dialog" class="modal" role="dialog" aria-modal="true" aria-labelledby="ai-dialog-title">
      <div class="modal-head">
        <h3 id="ai-dialog-title">{{ { hexagram: '卦象解读', dream: '梦境解读' }[store.aiContextKind] || '今日解读' }}</h3>
        <button ref="closeButton" class="modal-close" type="button" aria-label="关闭解读" @click="close">✕</button>
      </div>
      <div class="modal-body">
        <p v-if="error" class="muted" style="color: var(--cinnabar); line-height: 1.8">{{ error }}</p>
        <div v-else class="ai-text" :class="{ 'ai-cursor': loading }">{{ text || '正在凝神推演……' }}</div>
        <details v-if="sourceItems.length" class="modal-sources">
          <summary>原文依据</summary>
          <ul>
            <li v-for="item in sourceItems" :key="item.label"><strong>{{ item.label }}</strong>{{ item.text }}<small>{{ item.source }}</small></li>
          </ul>
        </details>
        <p class="muted small" style="margin-top: 14px">AI 生成内容仅供娱乐参考</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-sources { margin-top: 24px; border-top: 1px solid var(--line); }
.modal-sources summary { display: flex; min-height: 44px; align-items: center; color: var(--silver); cursor: pointer; font-size: 12px; letter-spacing: 0.1em; }
.modal-sources summary::before { margin-right: 8px; color: var(--muted); content: '+'; }
.modal-sources[open] summary::before { content: '−'; }
.modal-sources ul { display: grid; padding: 0 0 8px; gap: 10px; list-style: none; }
.modal-sources li { display: grid; gap: 3px; padding: 10px 12px; border: 1px solid var(--line); color: var(--silver); font-size: 12px; line-height: 1.75; }
.modal-sources strong { color: var(--glow); font-weight: 400; letter-spacing: 0.1em; }
.modal-sources small { color: var(--muted); font-size: 11px; }
</style>