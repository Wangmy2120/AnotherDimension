<script setup>
import { computed } from 'vue'

const props = defineProps({
  current: { type: String, required: true },
  items: { type: Array, required: true }
})

const next = computed(() => {
  const index = props.items.findIndex(item => item.key === props.current)
  if (index < 0) return null
  return props.items[index + 1] || null
})
</script>

<template>
  <nav v-if="next" class="next-chapter" aria-label="下一章">
    <span class="next-kicker">下一章 / {{ next.number || '—' }}</span>
    <a :href="next.path" :aria-label="`下一章：${next.label}，${next.title}`">
      <span>下一章</span>
      <strong>{{ next.label }}</strong>
      <svg viewBox="0 0 48 24" aria-hidden="true"><path d="M1 12h43M34 3l10 9-10 9" /></svg>
    </a>
  </nav>
</template>

<style scoped>
.next-chapter { margin-top: 74px; padding: 34px 0 24px; border-top: 1px solid var(--line); }
.next-kicker { color: var(--muted); font-size: 10px; letter-spacing: 0.18em; }
.next-chapter a { display: grid; width: 100%; min-height: 100px; padding: 18px 0; grid-template-columns: auto 1fr auto; align-items: end; gap: 22px; color: var(--silver); text-decoration: none; }
.next-chapter a > span { padding-bottom: 10px; color: var(--muted); font-size: 12px; letter-spacing: 0.12em; }
.next-chapter strong { font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: clamp(44px, 7vw, 84px); font-weight: 400; letter-spacing: 0.12em; line-height: 1.1; }
.next-chapter svg { width: 48px; margin-bottom: 12px; fill: none; stroke: currentColor; stroke-width: 1; transition: transform 180ms ease; }
.next-chapter a:hover { color: var(--glow); }
.next-chapter a:hover svg { transform: translateX(6px); }
@media (max-width: 700px) { .next-chapter { margin-top: 48px; } .next-chapter a { min-height: 82px; gap: 12px; } .next-chapter strong { font-size: 44px; } .next-chapter svg { width: 34px; } }
</style>
