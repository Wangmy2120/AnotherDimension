<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: { type: String, required: true },
  data: { type: Object, default: () => ({}) },
  active: { type: Boolean, default: false }
})

const rawLines = computed(() => Array.isArray(props.data?.lines) && props.data.lines.length === 6
  ? props.data.lines
  : Array.from({ length: 6 }, () => ({ yang: true, moving: false, placeholder: true })))

const xiuTicks = computed(() => Array.from({ length: 28 }, (_, index) => {
  const angle = -Math.PI / 2 + index / 28 * Math.PI * 2
  const radius = 48
  const outer = 58
  return {
    index,
    x1: 70 + Math.cos(angle) * radius,
    y1: 75 + Math.sin(angle) * radius,
    x2: 70 + Math.cos(angle) * outer,
    y2: 75 + Math.sin(angle) * outer,
    active: index === Number(props.data?.xiuIndex)
  }
}))

const zejiBars = computed(() => {
  const days = Array.isArray(props.data?.days) ? props.data.days.slice(0, 30) : []
  return days.map((day, index) => ({
    x: 16 + index * 7.1,
    height: 10 + Math.max(0, Math.min(1, Number(day.density) || 0)) * 58,
    today: Boolean(day.today)
  }))
})

const fortuneAxes = computed(() => {
  const categories = Array.isArray(props.data?.categories) ? props.data.categories.slice(0, 4) : []
  return categories.map((category, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2
    const value = Math.max(0, Math.min(100, Number(category.score) || 0))
    return {
      name: category.name,
      labelX: 120 + Math.cos(angle) * 70,
      labelY: 75 + Math.sin(angle) * 67,
      x: 120 + Math.cos(angle) * (18 + value * 0.44),
      y: 75 + Math.sin(angle) * (18 + value * 0.44),
      axisX: 120 + Math.cos(angle) * 48,
      axisY: 75 + Math.sin(angle) * 48
    }
  })
})
const fortunePolygon = computed(() => fortuneAxes.value.map(point => `${point.x},${point.y}`).join(' '))

const pillars = computed(() => {
  const list = Array.isArray(props.data?.pillars) ? props.data.pillars.slice(0, 4) : []
  return Array.from({ length: 4 }, (_, index) => ({
    label: list[index]?.label || ['年柱', '月柱', '日柱', '时柱'][index],
    chars: list[index]?.gz ? [...list[index].gz] : ['—', '—'],
    placeholder: !list[index]
  }))
})
const elementNodes = computed(() => {
  const wx = props.data?.wxCount || {}
  const names = ['木', '火', '土', '金', '水']
  return names.map((name, index) => {
    const angle = -Math.PI / 2 + index / 5 * Math.PI * 2
    return {
      name,
      count: Number(wx[name] || 0),
      x: 178 + Math.cos(angle) * 35,
      y: 75 + Math.sin(angle) * 35,
      tx: 178 + Math.cos(angle) * 49,
      ty: 75 + Math.sin(angle) * 49
    }
  })
})

const dreamStars = computed(() => {
  const keyword = String(props.data?.keyword || '梦')
  let seed = keyword.split('').reduce((sum, char) => sum + char.charCodeAt(0), 29)
  const random = () => {
    seed = seed * 16807 % 2147483647
    return (seed - 1) / 2147483646
  }
  return Array.from({ length: 9 }, (_, index) => ({
    x: 36 + random() * 170,
    y: 30 + random() * 78,
    r: index % 3 === 0 ? 2.1 : 1.2,
    lineTo: index === 0 ? null : { x: 36 + random() * 170, y: 30 + random() * 78 }
  }))
})
const dreamKeyword = computed(() => String(props.data?.keyword || '梦').slice(0, 4))
</script>

<template>
  <span class="chapter-instrument" :class="[`instrument-${type}`, { 'is-active': active }]" aria-hidden="true">
    <svg v-if="type === 'almanac'" viewBox="0 0 240 150" focusable="false">
      <g class="instrument-caption"><text x="8" y="16">二十八宿 / XIU</text><text x="150" y="16">宜 · 忌</text></g>
      <circle cx="70" cy="75" r="48" class="orbit" />
      <circle cx="70" cy="75" r="39" class="orbit faint" />
      <line v-for="tick in xiuTicks" :key="tick.index" :x1="tick.x1" :y1="tick.y1" :x2="tick.x2" :y2="tick.y2" class="tick" :class="{ lit: tick.active }" />
      <circle cx="70" cy="75" r="5" class="core-dot" />
      <text x="70" y="79" class="center-label" text-anchor="middle">{{ data.xiuName || '宿' }}</text>
      <g class="dual-columns">
        <text x="150" y="37" class="mark yi">宜</text>
        <text v-for="(item, index) in (data.yi || []).slice(0, 3)" :key="`a-${index}`" x="150" :y="54 + index * 17">{{ item }}</text>
        <text x="198" y="37" class="mark ji">忌</text>
        <text v-for="(item, index) in (data.ji || []).slice(0, 3)" :key="`b-${index}`" x="198" :y="54 + index * 17">{{ item }}</text>
      </g>
      <path d="M145 26v98M191 26v98" class="hairline" />
    </svg>

    <svg v-else-if="type === 'zeji'" viewBox="0 0 240 150" focusable="false">
      <g class="instrument-caption"><text x="8" y="16">三十日 / DENSITY</text><text x="190" y="16">今</text></g>
      <line x1="10" y1="122" x2="230" y2="122" class="hairline" />
      <g v-for="(bar, index) in zejiBars" :key="index">
        <rect :x="bar.x" :y="122 - bar.height" width="4" :height="bar.height" class="bar" :class="{ today: bar.today }" />
      </g>
      <line x1="16" y1="122" x2="16" y2="106" class="today-marker" />
      <text x="8" y="142" class="small-label">未来三十日 · 宜事密度</text>
      <circle v-if="zejiBars[0]" cx="18" cy="100" r="2.5" class="core-dot" />
    </svg>

    <svg v-else-if="type === 'fortune'" viewBox="0 0 240 150" focusable="false">
      <g class="instrument-caption"><text x="8" y="16">四象 / TENDENCY</text></g>
      <polygon points="120,29 169,75 120,121 71,75" class="orbit faint" />
      <polygon points="120,48 145,75 120,102 95,75" class="orbit faint" />
      <g v-for="axis in fortuneAxes" :key="axis.name">
        <line x1="120" y1="75" :x2="axis.axisX" :y2="axis.axisY" class="hairline" />
        <text :x="axis.labelX" :y="axis.labelY" text-anchor="middle">{{ axis.name }}</text>
      </g>
      <polygon v-if="fortuneAxes.length" :points="fortunePolygon" class="radar-fill" />
      <polygon v-if="fortuneAxes.length" :points="fortunePolygon" class="radar-line" />
      <circle cx="120" cy="75" r="2.5" class="core-dot" />
    </svg>

    <svg v-else-if="type === 'bazi'" viewBox="0 0 240 150" focusable="false">
      <g class="instrument-caption"><text x="8" y="16">四柱 / 五行</text></g>
      <g v-for="(pillar, index) in pillars" :key="pillar.label">
        <text :x="20 + index * 23" y="34" class="small-label">{{ pillar.label }}</text>
        <line :x1="26 + index * 23" y1="42" :x2="26 + index * 23" y2="112" class="pillar-line" :class="{ placeholder: pillar.placeholder }" />
        <text v-for="(char, charIndex) in pillar.chars" :key="charIndex" :x="26 + index * 23" :y="58 + charIndex * 17" class="pillar-char">{{ char }}</text>
      </g>
      <circle cx="178" cy="75" r="28" class="orbit" />
      <g v-for="node in elementNodes" :key="node.name">
        <circle :cx="node.x" :cy="node.y" r="2.2" class="element-node" :class="{ empty: node.count === 0 }" />
        <text :x="node.tx" :y="node.ty + 3" text-anchor="middle">{{ node.name }}{{ node.count }}</text>
      </g>
    </svg>

    <svg v-else-if="type === 'gua'" viewBox="0 0 240 150" focusable="false">
      <g class="instrument-caption"><text x="8" y="16">六爻 / HEXAGRAM</text></g>
      <text x="220" y="16" text-anchor="end">{{ data.movingCount ? '动' : '静' }}</text>
      <g v-for="(line, index) in rawLines" :key="index">
        <template v-if="line.yang">
          <line x1="56" :y1="38 + index * 16" x2="184" :y2="38 + index * 16" class="yao-line" :class="{ moving: line.moving, placeholder: line.placeholder }" />
        </template>
        <template v-else>
          <line x1="56" :y1="38 + index * 16" x2="112" :y2="38 + index * 16" class="yao-line" :class="{ moving: line.moving, placeholder: line.placeholder }" />
          <line x1="128" :y1="38 + index * 16" x2="184" :y2="38 + index * 16" class="yao-line" :class="{ moving: line.moving, placeholder: line.placeholder }" />
        </template>
        <circle v-if="line.moving" cx="194" :cy="38 + index * 16" r="2.3" class="moving-dot" />
      </g>
    </svg>

    <svg v-else-if="type === 'dream'" viewBox="0 0 240 150" focusable="false">
      <g class="instrument-caption"><text x="8" y="16">梦象 / ONEIRIC</text></g>
      <path d="M30 111C76 95 49 46 103 42c43-3 33 55 83 31 21-10 27 13 38 22" class="ink-thread" />
      <g v-for="(star, index) in dreamStars" :key="index">
        <line v-if="star.lineTo" :x1="star.x" :y1="star.y" :x2="star.lineTo.x" :y2="star.lineTo.y" class="hairline faint" />
        <circle :cx="star.x" :cy="star.y" :r="star.r" class="dream-star" />
      </g>
      <circle cx="119" cy="82" r="29" class="orbit faint" />
      <text x="119" y="86" text-anchor="middle" class="keyword">{{ dreamKeyword }}</text>
    </svg>
  </span>
</template>

<style scoped>
.chapter-instrument {
  position: absolute;
  z-index: 0;
  right: 18px;
  bottom: 60px;
  width: min(44%, 252px);
  opacity: 0.46;
  pointer-events: none;
  filter: drop-shadow(0 0 18px oklch(0.97 0 0 / 0.04));
}
.chapter-instrument svg { display: block; width: 100%; height: auto; overflow: visible; }
.chapter-instrument text { fill: var(--muted); font-family: 'DM Sans', 'PingFang SC', sans-serif; font-size: 10px; letter-spacing: 0.04em; }
.instrument-caption text { fill: var(--silver); font-size: 10px; letter-spacing: 0.14em; }
.instrument-caption text:last-child { fill: var(--muted); }
.orbit { fill: none; stroke: oklch(0.97 0 0 / 0.32); stroke-width: 0.8; }
.orbit.faint { stroke: oklch(0.97 0 0 / 0.15); stroke-dasharray: 2 5; }
.hairline { stroke: oklch(0.97 0 0 / 0.2); stroke-width: 0.7; }
.tick { stroke: oklch(0.97 0 0 / 0.1); stroke-width: 0.7; }
.tick.lit { stroke: var(--glow); stroke-width: 1.7; filter: drop-shadow(0 0 4px oklch(0.97 0 0 / 0.7)); }
.core-dot { fill: var(--glow); }
.center-label { fill: var(--silver); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 12px; }
.dual-columns text { fill: var(--silver); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 10px; }
.dual-columns .mark { fill: var(--glow); font-size: 12px; }
.mark.ji { fill: var(--muted); }
.bar { fill: oklch(0.97 0 0 / 0.24); }
.bar.today { fill: var(--glow); }
.today-marker { stroke: oklch(0.97 0 0 / 0.58); stroke-width: 0.8; }
.small-label { fill: var(--muted); font-size: 10px; letter-spacing: 0.08em; }
.radar-fill { fill: oklch(0.97 0 0 / 0.08); }
.radar-line { fill: none; stroke: var(--silver); stroke-width: 0.8; }
.pillar-line { stroke: oklch(0.97 0 0 / 0.38); stroke-width: 0.9; }
.pillar-line.placeholder { stroke: oklch(0.97 0 0 / 0.13); stroke-dasharray: 2 4; }
.pillar-char { fill: var(--glow); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 12px; letter-spacing: 0.04em; }
.element-node { fill: var(--glow); }
.element-node.empty { fill: var(--muted); opacity: 0.4; }
.yao-line { stroke: var(--silver); stroke-width: 2.6; }
.yao-line.placeholder { stroke: oklch(0.97 0 0 / 0.14); }
.yao-line.moving { stroke: var(--glow); filter: drop-shadow(0 0 5px oklch(0.97 0 0 / 0.6)); }
.moving-dot { fill: var(--glow); }
.dream-star { fill: var(--glow); }
.ink-thread { fill: none; stroke: oklch(0.97 0 0 / 0.22); stroke-width: 5; stroke-linecap: round; filter: blur(3px); }
.keyword { fill: var(--silver); font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 12px; letter-spacing: 0.12em; }
.chapter-card.active .chapter-instrument,
.static-card .chapter-instrument { top: 104px; right: 20px; bottom: auto; width: min(34%, 200px); opacity: 0.58; }
.chapter-card:not(.active):not(.static-card) .chapter-instrument { top: 78px; right: auto; bottom: auto; left: 50%; width: min(62%, 230px); opacity: 0.14; transform: translateX(-50%); }
.static-card .chapter-instrument { opacity: 0.4; }
@media (max-width: 760px) {
  .chapter-instrument { right: 12px; bottom: 48px; width: 48%; opacity: 0.38; }
  .chapter-card:not(.active):not(.static-card) .chapter-instrument { top: 72px; width: 68%; opacity: 0.12; }
  .chapter-card.active .chapter-instrument,
  .static-card .chapter-instrument { top: 96px; right: 12px; width: 36%; opacity: 0.5; }
}
@media (prefers-reduced-motion: reduce) {
  .chapter-instrument { filter: none; }
}
</style>
