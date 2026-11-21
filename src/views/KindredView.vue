<script setup>
import { computed } from 'vue'
import DateBar from '../components/DateBar.vue'
import KindredTimes from '../components/KindredTimes.vue'
import { catalogRows, catalogStats, channelInfo } from '../lib/tongxiang.js'

const rows = computed(() => catalogRows())
const stats = catalogStats()
const channels = channelInfo()
const gates = [
  { key: 'full', label: '年月日有据', note: '八条通道全开' },
  { key: 'lunar-day', label: '月日有据 · 年系推定', note: '只走岁时与季节' },
  { key: 'month', label: '仅系到月', note: '只走农历月与季节' },
  { key: 'season', label: '仅系到节令', note: '只走季节' }
]
</script>

<template>
  <div class="kindred-view">
    <DateBar />
    <KindredTimes />

    <section class="card" aria-labelledby="method-title">
      <h2 id="method-title" class="card-title">坐标怎么对上</h2>
      <p class="method-lede">事件库只存日期与叙事。干支、值日星宿、节气段全部由本应用既有的历法引擎反查得出——与黄历页用的是同一套算法，所以「此刻」与「彼时」可以直接对齐，不需要为古人另算一次。</p>
      <ul class="method-channels">
        <li v-for="channel in channels" :key="channel.key">
          <b>{{ channel.label }}</b>
          <span class="muted small">{{ channel.weight }} 分 · 需「{{ channel.needs }}」</span>
        </li>
      </ul>
      <p class="method-note muted small">分数只表示重合了几条坐标、权重多高，不表示吉凶。</p>

      <h3 class="method-sub">系日精度闸门</h3>
      <p class="method-lede">古典小说大多只写节令不写纪年。为避免把推算出来的锚点冒充史实，每条事件自带系日精度，精度不够的通道对它直接关闭。</p>
      <ul class="method-gates">
        <li v-for="gate in gates" :key="gate.key">
          <b>{{ gate.label }}</b><span class="muted small">{{ gate.note }}</span>
        </li>
      </ul>
      <p class="card-footnote muted small">三条一手文本可自证换算：兰亭「岁在癸丑」得 353 年干支恰为癸丑；《水调歌头》「丙辰中秋」得 1076-09-15 且正对八月十五；《前赤壁赋》「壬戌之秋，七月既望」得 1082-08-12 且正对七月十六。</p>
    </section>

    <section class="card" aria-labelledby="catalog-title">
      <div class="section-heading">
        <h2 id="catalog-title" class="card-title">坐标库全览</h2>
        <span class="section-note">{{ stats.total }} 条 · 史载 {{ stats.history }} · 演义 {{ stats.fiction }}</span>
      </div>
      <ul class="catalog-list">
        <li v-for="row in rows" :key="row.id">
          <span class="catalog-year">{{ row.solarYear }}</span>
          <span class="catalog-kind" :class="row.kind">{{ row.kind === 'history' ? '史' : '演' }}</span>
          <span class="catalog-main">
            <b>{{ row.title }}</b>
            <em>{{ row.figure }}<template v-if="row.star"> · {{ row.star }}</template></em>
          </span>
          <span class="catalog-coord muted small">{{ row.dayGanZhi }}日 · {{ row.xiu }}宿 · {{ row.jieqi }}后</span>
        </li>
      </ul>
      <p class="card-footnote muted small">值日星宿取黄历「二十八宿值日」的二十八日循环，是历法记号，不等于月亮当天实际所在的星宿——后者见观星章。先秦与公元前日期超出历法引擎可用范围，本库暂不收。</p>
    </section>

    <section class="card" aria-labelledby="limit-title">
      <h2 id="limit-title" class="card-title">边界</h2>
      <ul class="limit-list">
        <li>同象只陈述历法坐标是否重合，不据以推断任何人的际遇，也不比较人物高下。</li>
        <li>标「演义」者出自古典小说，其日期依史实系年推定，只到月或节令，界面已逐条注明。</li>
        <li>库尚在扩充中：坐标越密，弱匹配越少；目前 {{ stats.total }} 条已覆盖 353 年至 2021 年。</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.method-lede { margin: 0 0 16px; color: var(--muted); font-size: 13px; line-height: 1.95; }
.method-sub { margin: 26px 0 12px; color: var(--glow); font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 14px; font-weight: 400; letter-spacing: 0.14em; }
.method-channels, .method-gates { display: grid; margin: 0 0 12px; padding: 0; list-style: none; gap: 1px; background: var(--line); grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
.method-channels li, .method-gates li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 11px 13px; background: var(--void); }
.method-channels b, .method-gates b { color: var(--glow); font-weight: 400; font-size: 13px; letter-spacing: 0.08em; }
.method-note { margin: 0; }
.section-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
.section-note { color: var(--muted); font-size: 12px; letter-spacing: 0.08em; }
.catalog-list { margin: 4px 0 0; padding: 0; list-style: none; }
.catalog-list li { display: grid; padding: 11px 0; border-bottom: 1px solid var(--line); align-items: baseline; gap: 12px; grid-template-columns: 56px 26px 1fr auto; }
.catalog-list li:last-child { border-bottom: 0; }
.catalog-year { color: var(--silver); font-size: 12px; letter-spacing: 0.06em; }
.catalog-kind { padding: 1px 5px; border: 1px solid var(--line-strong); color: var(--silver); font-size: 10px; letter-spacing: 0.1em; text-align: center; }
.catalog-kind.fiction { border-style: dashed; }
.catalog-main { display: flex; flex-wrap: wrap; align-items: baseline; gap: 9px; }
.catalog-main b { color: var(--glow); font-weight: 400; font-family: 'Noto Serif SC', 'Songti SC', 'STSong', serif; font-size: 14px; letter-spacing: 0.08em; }
.catalog-main em { color: var(--muted); font-size: 12px; font-style: normal; letter-spacing: 0.05em; }
.catalog-coord { text-align: right; }
.limit-list { margin: 0; padding-left: 18px; color: var(--muted); font-size: 13px; line-height: 2; }
.limit-list li::marker { color: var(--mist); }
@media (max-width: 640px) {
  .catalog-list li { grid-template-columns: 56px 26px 1fr; }
  .catalog-coord { grid-column: 1 / -1; text-align: left; }
}
</style>
