<script setup>
import { computed } from 'vue'
import { store } from '../store.js'

const props = defineProps({
  current: { type: String, required: true },
  tabs: { type: Array, required: true }
})

const next = computed(() => {
  const index = props.tabs.findIndex(tab => tab.key === props.current)
  return props.tabs[(index + 1 + props.tabs.length) % props.tabs.length] || props.tabs[0]
})

function openNext() {
  store.tabRequest = next.value.key
}
</script>

<template>
  <nav class="next-chapter" aria-label="下一项功能">
    <span class="next-kicker">NEXT CHAPTER / {{ String(tabs.findIndex(tab => tab.key === next.key) + 1).padStart(2, '0') }}</span>
    <button type="button" @click="openNext">
      <span>下一项</span>
      <strong>{{ next.label }}</strong>
      <svg viewBox="0 0 48 24" aria-hidden="true"><path d="M1 12h43M34 3l10 9-10 9" /></svg>
    </button>
  </nav>
</template>

<style scoped>
.next-chapter { margin-top: 74px; padding: 34px 0 24px; border-top: 1px solid var(--line); }
.next-kicker { color: var(--muted); font-size: 10px; letter-spacing: 0.18em; }
.next-chapter button { display: grid; width: 100%; min-height: 100px; padding: 18px 0; grid-template-columns: auto 1fr auto; align-items: end; gap: 22px; border: 0; background: transparent; color: var(--silver); cursor: pointer; text-align: left; }
.next-chapter button > span { padding-bottom: 10px; color: var(--muted); font-size: 12px; letter-spacing: 0.12em; }
.next-chapter strong { font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: clamp(44px, 7vw, 84px); font-weight: 400; letter-spacing: 0.12em; line-height: 1.1; }
.next-chapter svg { width: 48px; margin-bottom: 12px; fill: none; stroke: currentColor; stroke-width: 1; transition: transform 180ms ease; }
.next-chapter button:hover { color: var(--glow); }
.next-chapter button:hover svg { transform: translateX(6px); }
@media (max-width: 700px) { .next-chapter { margin-top: 48px; } .next-chapter button { min-height: 82px; gap: 12px; } .next-chapter strong { font-size: 44px; } .next-chapter svg { width: 34px; } }
</style>
