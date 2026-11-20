<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { dayInfo, fortune, openAi, store } from '../store.js'
import DateBar from '../components/DateBar.vue'

const info = computed(() => dayInfo())
const ft = computed(() => fortune())

const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 52
const SCORE_ANIMATION_MS = 400

const animatedOverall = ref(ft.value.overall)
const displayedOverall = computed(() => Math.round(animatedOverall.value))
const gaugeOffset = computed(() => {
  const score = Math.max(0, Math.min(100, animatedOverall.value))
  return GAUGE_CIRCUMFERENCE * (1 - score / 100)
})
let mounted = false
let motionQuery
let scoreAnimationFrame = null

function cancelScoreAnimation() {
  if (scoreAnimationFrame === null) return
  window.cancelAnimationFrame(scoreAnimationFrame)
  scoreAnimationFrame = null
}

function animateOverall(target) {
  cancelScoreAnimation()
  if (reducedMotion()) {
    animatedOverall.value = target
    return
  }
  const from = animatedOverall.value
  if (from === target) return
  const startedAt = performance.now()
  const tick = now => {
    const progress = Math.min(1, (now - startedAt) / SCORE_ANIMATION_MS)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedOverall.value = from + (target - from) * eased
    if (progress < 1) {
      scoreAnimationFrame = window.requestAnimationFrame(tick)
    } else {
      animatedOverall.value = target
      scoreAnimationFrame = null
    }
  }
  scoreAnimationFrame = window.requestAnimationFrame(tick)
}

function reducedMotion() {
  return motionQuery?.matches ?? false
}

function handleMotionChange() {
  if (!reducedMotion()) return
  cancelScoreAnimation()
  animatedOverall.value = ft.value.overall
}

watch(() => ft.value.overall, score => {
  if (mounted) animateOverall(score)
})

onMounted(() => {
  mounted = true
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change', handleMotionChange)
  animatedOverall.value = reducedMotion() ? ft.value.overall : 0
  animateOverall(ft.value.overall)
})

onBeforeUnmount(() => {
  mounted = false
  cancelScoreAnimation()
  motionQuery?.removeEventListener('change', handleMotionChange)
})
</script>

<template>
  <div class="fortune-view">
    <DateBar />
    <div class="card overview-card">
      <div class="muted">{{ info.dateStr }} · {{ info.dayGanZhi }}日（{{ info.dayWuXing }}）</div>
      <div class="score-gauge" role="img" :aria-label="`综合运势 ${ft.overall} 分，满分 100 分`">
        <svg class="score-gauge-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle class="score-gauge-track" cx="60" cy="60" r="52" />
          <circle
            class="score-gauge-progress"
            cx="60"
            cy="60"
            r="52"
            :stroke-dasharray="GAUGE_CIRCUMFERENCE"
            :stroke-dashoffset="gaugeOffset"
          />
        </svg>
        <div class="score-gauge-value" aria-hidden="true">
          <span class="score-value">{{ displayedOverall }}</span>
          <span class="score-unit">/ 100</span>
        </div>
      </div>
      <div class="score-caption">综合运势</div>
      <div class="stars" style="font-size: 20px">{{ '★'.repeat(ft.overallStars) }}{{ '☆'.repeat(5 - ft.overallStars) }}</div>
      <p v-if="ft.relation" class="muted" style="margin-top: 10px">
        日主「{{ ft.relation === '比和' ? '同气' : ft.relation }}」· 当日天干五行属{{ info.dayWuXing }}
      </p>
      <p class="muted" style="margin-top: 8px; line-height: 1.9; text-align: left">{{ ft.relationDesc }}</p>
    </div>

    <div class="fortune-dimensions">
      <div class="card" v-for="(c, index) in ft.categories" :key="c.name">
        <div class="spread">
          <span class="dimension-name">{{ c.name }}</span>
          <span class="dimension-meta">
            <span class="stars">{{ '★'.repeat(c.stars) }}{{ '☆'.repeat(5 - c.stars) }}</span>
            <span class="muted small">{{ c.score }}分</span>
          </span>
        </div>
        <div
          class="dimension-track"
          role="progressbar"
          :aria-label="`${c.name}运势`"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="c.score"
        >
          <div
            class="dimension-fill"
            :style="{ width: c.score + '%', '--dimension-order': index }"
          ></div>
        </div>
        <p class="muted" style="margin-top: 10px; line-height: 1.8">{{ c.tip }}</p>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">开运参考</h2>
      <div class="grid2">
        <div class="kv">
          <span class="k">幸运色</span>
          <span class="lucky-color">
            <span class="lucky-color-tag">{{ ft.lucky.color }}</span>
          </span>
        </div>
        <div class="kv"><span class="k">幸运数</span><span>{{ ft.lucky.number }}</span></div>
        <div class="kv"><span class="k">吉方位</span><span>{{ ft.lucky.direction }}</span></div>
        <div class="kv"><span class="k">扶运五行</span><span>{{ ft.lucky.wuXing }}</span></div>
      </div>
      <p v-if="!ft.personalized" class="muted small" style="margin-top: 10px">
        当前为通用运势。到「八字」页录入生辰后，将按你的日主五行个性化推演。
      </p>
      <button class="btn block" style="margin-top: 14px" @click="openAi('daily')">AI 深度解读</button>
    </div>
  </div>
</template>

<style scoped>
.fortune-view {
  min-width: 0;
}

.overview-card {
  text-align: center;
}

.fortune-dimensions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.fortune-dimensions .card {
  margin-bottom: 0;
}

@media (max-width: 760px) {
  .fortune-dimensions { grid-template-columns: 1fr; }
}

.score-gauge {
  position: relative;
  width: 148px;
  height: 148px;
  margin: 16px auto 10px;
}

.score-gauge-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  transform: rotate(-90deg);
}

.score-gauge-track,
.score-gauge-progress {
  fill: none;
  stroke-width: 4;
}

.score-gauge-track {
  stroke: var(--paper-deep);
}

.score-gauge-progress {
  stroke: var(--ink);
  stroke-linecap: round;
  filter: drop-shadow(0 0 4px oklch(0.96 0 0 / 0.18));
}

.score-gauge-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 5px;
  padding-top: 52px;
}

.score-value {
  color: var(--ink);
  font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
  font-size: 48px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.06em;
  line-height: 1;
}

.score-unit,
.score-caption {
  color: var(--ink-soft);
  font-size: 12px;
}

.score-caption {
  margin-bottom: 8px;
  letter-spacing: 0.18em;
}

.dimension-name {
  font-size: 16px;
}

.dimension-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dimension-track {
  height: 6px;
  margin-top: 14px;
  background: var(--paper-deep);
}

.dimension-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ink-soft), var(--ink));
  box-shadow: 0 0 12px oklch(0.96 0 0 / 0.2), 0 0 3px oklch(0.96 0 0 / 0.28);
  transform-origin: left center;
  animation: dimension-grow 400ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--dimension-order) * 60ms);
}

.lucky-color {
  display: inline-flex;
  min-width: 0;
  align-items: center;
}

.lucky-color-tag {
  display: inline-flex;
  padding: 3px 9px;
  align-items: center;
  border: 1px solid var(--line-strong);
  background: linear-gradient(135deg, oklch(0.97 0 0 / 0.06), transparent);
  color: var(--silver);
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 14px;
  letter-spacing: 0.08em;
}

@keyframes dimension-grow {
  from {
    opacity: 0.35;
    transform: scaleX(0);
  }
  to {
    opacity: 1;
    transform: scaleX(1);
  }
}

@media (max-width: 420px) {
  .score-gauge {
    width: 136px;
    height: 136px;
  }

  .score-gauge-value {
    padding-top: 47px;
  }

  .score-value {
    font-size: 44px;
  }

  .dimension-meta {
    gap: 5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dimension-fill {
    opacity: 1;
    transform: scaleX(1);
    animation: none;
  }
}
</style>