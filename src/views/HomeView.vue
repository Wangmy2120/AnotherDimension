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
      description: dream?.text || '记录一个梦境，从民俗象征中读懂当下心绪。',
      metrics: dream
        ? [
            { label: '关键词', value: dream.keyword },
            { label: '传统吉凶', value: dream.luck }
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
    <HomeAiConclusion />
  </div>
</template>

<style scoped>
.home-view { position: relative; background: #030304; }
</style>
