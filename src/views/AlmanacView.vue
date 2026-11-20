<script setup>
import { computed } from 'vue'
import { dayInfo } from '../store.js'
import DateBar from '../components/DateBar.vue'

const info = computed(() => dayInfo())
</script>

<template>
  <div class="almanac-view">
    <DateBar />

    <section class="card calendar-card" aria-labelledby="calendar-title">
      <div id="calendar-title" class="card-title">历法干支</div>
      <div class="kv"><span class="k">公历</span><span>{{ info.dateStr }} 星期{{ info.week }}</span></div>
      <div class="kv"><span class="k">农历</span><span>{{ info.lunarText }}（{{ info.shengXiao }}年）</span></div>
      <div class="kv"><span class="k">干支</span><span>{{ info.yearGanZhi }}年 {{ info.monthGanZhi }}月 {{ info.dayGanZhi }}日</span></div>
      <div class="kv"><span class="k">节气</span><span>{{ info.prevJie.name }}（{{ info.prevJie.date }}）→ {{ info.nextJie.name }}（{{ info.nextJie.date }}）</span></div>
      <div class="kv"><span class="k">彭祖百忌</span><span>{{ info.pengZu.join('；') }}</span></div>
    </section>

    <section class="card tag-card" aria-labelledby="yi-title">
      <div class="section-heading">
        <div id="yi-title" class="card-title">宜</div>
        <span class="section-note">顺时而为</span>
      </div>
      <div :key="`yi-${info.dateStr}`" class="tag-list" aria-label="宜做事项">
        <span
          v-for="(t, index) in info.yi"
          :key="t"
          class="tag yi tag-enter"
          :style="{ '--tag-order': Math.min(index, 14) }"
        >{{ t }}</span>
      </div>
    </section>

    <section class="card tag-card" aria-labelledby="ji-title">
      <div class="section-heading">
        <div id="ji-title" class="card-title">忌</div>
        <span class="section-note">知止有度</span>
      </div>
      <div :key="`ji-${info.dateStr}`" class="tag-list" aria-label="忌做事项">
        <span
          v-for="(t, index) in info.ji"
          :key="t"
          class="tag ji tag-enter"
          :style="{ '--tag-order': Math.min(index, 14) }"
        >{{ t }}</span>
      </div>
    </section>

    <section class="card" aria-labelledby="gods-title">
      <div id="gods-title" class="card-title">冲煞与吉神</div>
      <div class="kv"><span class="k">冲煞</span><span>{{ info.chongLabel }}</span></div>
      <div class="kv"><span class="k">吉神宜趋</span><span>{{ info.jiShen.join('、') || '—' }}</span></div>
      <div class="kv"><span class="k">凶煞宜忌</span><span>{{ info.xiongSha.join('、') || '—' }}</span></div>
      <div class="kv"><span class="k">喜神方位</span><span>{{ info.positions.xi }}</span></div>
      <div class="kv"><span class="k">财神方位</span><span>{{ info.positions.cai }}</span></div>
      <div class="kv"><span class="k">福神方位</span><span>{{ info.positions.fu }}</span></div>
    </section>

    <section class="card xiu-card" aria-labelledby="xiu-title">
      <div id="xiu-title" class="card-title">二十八宿值日</div>
      <div class="xiu-layout">
        <div class="xiu-copy">
          <div class="spread">
            <span class="xiu-name">{{ info.xiu }}</span>
            <span class="tag" :class="info.xiuLuck === '吉' ? 'yi' : 'ji'">{{ info.xiuName }} · {{ info.xiuLuck }}</span>
          </div>
          <p class="muted xiu-song">{{ info.xiuSong }}</p>
          <span class="xiu-caption">星宿周行 · 四象各司</span>
        </div>
        <svg class="xiu-map" viewBox="0 0 220 180" role="img" aria-label="银白星宿连线图">
          <circle class="orbit" cx="110" cy="90" r="72" />
          <circle class="orbit orbit-inner" cx="110" cy="90" r="48" />
          <path class="axis" d="M24 90h172M110 10v160" />
          <g class="constellation-rotor">
            <path class="constellation-line" d="M38 105 64 66 98 79 126 43 151 70 181 58M98 79l15 40 38 20 30-31-17-26M113 119l-37 20-38-34" />
            <circle class="star star-major" cx="38" cy="105" r="3.2" />
            <circle class="star" cx="64" cy="66" r="2.2" />
            <circle class="star star-major" cx="98" cy="79" r="3.5" />
            <circle class="star" cx="126" cy="43" r="2.4" />
            <circle class="star" cx="151" cy="70" r="2" />
            <circle class="star star-major" cx="181" cy="58" r="3" />
            <circle class="star" cx="113" cy="119" r="2.6" />
            <circle class="star star-major" cx="151" cy="139" r="3.3" />
            <circle class="star" cx="181" cy="108" r="2.1" />
            <circle class="star" cx="164" cy="82" r="2.3" />
            <circle class="star" cx="76" cy="139" r="2.4" />
          </g>
          <circle class="center-star" cx="110" cy="90" r="1.8" />
        </svg>
      </div>
    </section>
  </div>
</template>

<style scoped>
.almanac-view { min-width: 0; }
.almanac-view .card { position: relative; min-width: 0; }
.calendar-card { background: linear-gradient(120deg, oklch(0.96 0 0 / 0.035), transparent 58%), var(--card); }
.kv > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.section-heading { display: flex; margin-bottom: 18px; align-items: center; justify-content: space-between; gap: 16px; }
.section-heading .card-title { margin-bottom: 0; }
.section-note,
.xiu-caption { color: var(--muted); font-size: 10px; letter-spacing: 0.16em; }
.tag-list { display: flex; min-height: 32px; flex-wrap: wrap; gap: 8px; }
.tag-list .tag { margin: 0; padding: 6px 11px; }
.tag-enter { opacity: 0; animation: almanac-tag-in 380ms cubic-bezier(0.22, 1, 0.36, 1) forwards; animation-delay: calc(var(--tag-order, 0) * 42ms); }
.tag-list .tag.yi { box-shadow: 0 0 18px oklch(0.96 0 0 / 0.045); }
.tag-list .tag.ji { background: oklch(0.96 0 0 / 0.018); }
.xiu-card { overflow: hidden; }
.xiu-card::after { content: ''; position: absolute; top: -100px; right: -60px; width: 260px; height: 260px; border-radius: 50%; background: radial-gradient(circle, oklch(0.96 0 0 / 0.045), transparent 68%); pointer-events: none; }
.xiu-layout { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) 220px; align-items: center; gap: 28px; }
.xiu-copy { min-width: 0; }
.xiu-name { font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 26px; font-weight: 400; letter-spacing: 0.18em; }
.xiu-song { margin-top: 16px; font-size: 13px; line-height: 2; overflow-wrap: anywhere; }
.xiu-caption { display: block; margin-top: 20px; }
.xiu-map { display: block; width: 100%; max-width: 220px; height: auto; color: oklch(0.94 0 0); overflow: visible; }
.orbit { fill: none; stroke: currentColor; stroke-width: 0.65; opacity: 0.16; }
.orbit-inner { stroke-dasharray: 2 7; opacity: 0.22; }
.axis { fill: none; stroke: currentColor; stroke-width: 0.5; stroke-dasharray: 1 9; opacity: 0.12; }
.constellation-rotor { transform-box: view-box; transform-origin: 110px 90px; animation: xiu-rotate 64s linear infinite; }
.constellation-line { fill: none; stroke: currentColor; stroke-width: 0.9; stroke-linecap: round; stroke-linejoin: round; opacity: 0.52; vector-effect: non-scaling-stroke; }
.star { fill: currentColor; opacity: 0.76; }
.star-major { opacity: 0.96; filter: drop-shadow(0 0 4px oklch(0.96 0 0 / 0.48)); }
.center-star { fill: currentColor; opacity: 0.42; }

@keyframes almanac-tag-in {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes xiu-rotate { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .almanac-view .card { padding: 22px; }
  .xiu-layout { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .xiu-map { margin: 0 auto; max-width: 200px; }
  .xiu-copy .spread { align-items: flex-start; }
}
@media (max-width: 380px) {
  .almanac-view .card { padding: 18px; }
  .section-heading { gap: 10px; }
  .section-note { letter-spacing: 0.08em; }
  .kv { gap: 9px; }
  .kv .k { min-width: 60px; }
}
@media (prefers-reduced-motion: reduce) {
  .tag-enter { opacity: 1; transform: none; animation: none; }
  .constellation-rotor { animation: none; }
}
</style>

