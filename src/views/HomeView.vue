<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { bazi, dayInfo, fortune, store } from '../store.js'
import HomeProfile from '../components/HomeProfile.vue'
import HomeAiConclusion from '../components/HomeAiConclusion.vue'

const CosmicHero = defineAsyncComponent(() => import('../components/CosmicHero.vue'))
const SpiralJourney = defineAsyncComponent(() => import('../components/SpiralJourney.vue'))
const info = computed(() => dayInfo())
const ft = computed(() => fortune())
const chart = computed(() => bazi())

const modules = computed(() => {
  const day = info.value
  const fortuneData = ft.value
  const baziData = chart.value
  const hex = store.hexSession
  const dream = store.dreamSession
  const fortuneMetrics = Object.values(fortuneData.categories).slice(0, 2).map(item => ({
    label: item.name,
    value: `${item.score} / 100`
  }))
  return [
    {
      key: 'almanac',
      label: '黄历',
      chapter: '01 / CHRONOLOGY',
      title: '因时而行',
      concept: '以历法安顿日常。查每日宜忌、值宿与冲煞，让起居行止皆有天时可依。',
      description: `${day.lunarText} · ${day.dayGanZhi}日`,
      metrics: [
        { label: '宜', value: day.yi.slice(0, 2).join(' · ') },
        { label: '忌', value: day.ji.slice(0, 2).join(' · ') },
        { label: '值宿', value: `${day.xiuName} · ${day.xiuLuck}` }
      ],
      cta: '进入黄历'
    },
    {
      key: 'zeji',
      label: '择吉',
      chapter: '02 / SELECTION',
      title: '择事候时',
      concept: '为一件事寻找更合宜的时间。以事项、日期与生肖避冲，权衡当下的进退之机。',
      description: '先定所求之事，再观时日宜忌。',
      metrics: [
        { label: '当前日期', value: day.dateStr },
        { label: '日柱', value: day.dayGanZhi },
        { label: '冲煞', value: `冲${day.chong} · 煞${day.sha}` }
      ],
      cta: '进入择吉'
    },
    {
      key: 'fortune',
      label: '运势',
      chapter: '03 / TENDENCY',
      title: '观势知止',
      concept: '看一日气机与自身五行的往来，辨事业、财务、情感与身心的轻重缓急。',
      description: fortuneData.relationDesc,
      metrics: [
        { label: '综合', value: `${fortuneData.overall} / 100` },
        ...fortuneMetrics
      ],
      cta: '进入运势'
    },
    {
      key: 'bazi',
      label: '八字',
      chapter: '04 / NATAL CHART',
      title: '由命见性',
      concept: '以出生时刻立四柱八字，观日主与五行分布，照见禀赋、性情与行运的底色。',
      description: baziData
        ? baziData.pillars.map(item => `${item.label}${item.gz}`).join(' · ')
        : '尚未录入生辰，可在首页时空档案中补充。',
      metrics: baziData
        ? [
            { label: '日主', value: `${baziData.dayGan} · ${baziData.dayMasterWuXing}` },
            { label: '生肖', value: baziData.shengXiao },
            { label: '命宫', value: baziData.mingGong }
          ]
        : [{ label: '档案状态', value: '等待录入' }],
      cta: '进入八字'
    },
    {
      key: 'gua',
      label: '摇卦',
      chapter: '05 / INQUIRY',
      title: '以问观变',
      concept: '六爻成象，动爻见变。以一枚诚问照见当下的机与应，不求定数，只辨方向。',
      description: hex?.question || '心中有所问，方可观卦象之变。',
      metrics: hex
        ? [
            { label: '本卦', value: hex.result.primaryName },
            { label: '变卦', value: hex.result.changedName || '六爻安静' }
          ]
        : [{ label: '卦象状态', value: '尚未起卦' }],
      cta: '进入摇卦'
    },
    {
      key: 'dream',
      label: '解梦',
      chapter: '06 / ONEIRIC',
      title: '循梦观心',
      concept: '梦是心绪留下的暗纹。循意象与民俗象征解梦，也借一面古镜照见未说出口的念头。',
      description: dream?.text || '记录一个梦境，从民俗象征中读懂当下心绪。',
      metrics: dream
        ? [
            { label: '关键词', value: dream.keyword },
            { label: '传统吉凶', value: dream.luck || '已记录' }
          ]
        : [{ label: '梦境状态', value: '尚未记录' }],
      cta: '进入解梦'
    }
  ]
})

function openModule(key) {
  store.tabRequest = key
}

function continueJourney() {
  document.getElementById('journey')?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  })
}
</script>

<template>
  <div class="home-view">
    <CosmicHero />
    <HomeProfile @continue="continueJourney" />
    <SpiralJourney id="journey" :items="modules" @open="openModule" />
    <section class="home-breath" aria-label="星轨留白"><p>六轨既明，静候一心。</p></section>
    <HomeAiConclusion />
  </div>
</template>

<style scoped>
.home-view { position: relative; background: var(--void); }
.home-breath { display: grid; height: 40vh; place-items: center; color: var(--muted); }
.home-breath p { font-family: 'Noto Serif SC', 'Songti SC', serif; font-size: 13px; letter-spacing: 0.24em; }
</style>
