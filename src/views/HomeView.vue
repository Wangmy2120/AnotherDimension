<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { bazi, dayInfo, fortune, store } from '../store.js'
import { getDayInfo } from '../lib/calendar.js'
import HomeProfile from '../components/HomeProfile.vue'
import HomeAiConclusion from '../components/HomeAiConclusion.vue'
import { chapterByKey } from '../data/chapters.js'
import { LIUREN_PALACES, getLiurenLesson } from '../lib/liuren.js'

const XIU_NAMES = ['角', '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虚', '危', '室', '壁', '奎', '娄', '胃', '昴', '毕', '觜', '参', '井', '鬼', '柳', '星', '张', '翼', '轸']

function futureDays(dateStr, count) {
  const base = new Date(`${dateStr}T12:00:00`)
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(base)
    date.setDate(date.getDate() + offset)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const info = getDayInfo(key)
    return {
      density: Math.max(0.08, Math.min(1, (info.yi.length - 4) / 16)),
      today: offset === 0
    }
  })
}

const CosmicHero = defineAsyncComponent(() => import('../components/CosmicHero.vue'))
const SpiralJourney = defineAsyncComponent(() => import('../components/SpiralJourney.vue'))
const info = computed(() => dayInfo())
const ft = computed(() => fortune())
const chart = computed(() => bazi())

// 天文推算只在首页后台加载，避免把 sky.js 打进入口块。
const skyModule = ref(null)
import('../lib/sky.js').then(module => {
  skyModule.value = module
})
const sky = computed(() => {
  const module = skyModule.value
  if (!module) return null
  const moment = module.getSkyMoment(new Date(), store.location.latitude, store.location.longitude)
  return { moment, clock: module.formatClock(moment.date) }
})

const modules = computed(() => {
  const day = info.value
  const fortuneData = ft.value
  const baziData = chart.value
  const hex = store.hexSession
  const dream = store.dreamSession
  const meta = key => chapterByKey[key]
  const fortuneMetrics = Object.values(fortuneData.categories).slice(0, 2).map(item => ({
    label: item.name,
    value: `${item.score} / 100`
  }))
  const xiuName = day.xiuName.replace(/宿$/, '')
  const zejiDays = futureDays(day.dateStr, 30)
  const now = new Date()
  const liurenLesson = getLiurenLesson({ dateStr: day.dateStr, hour: now.getHours(), minute: now.getMinutes() })
  const savedLiuren = store.liurenSession && store.liurenSession.date === day.dateStr ? store.liurenSession : null
  const liurenPalaces = savedLiuren
    ? [savedLiuren.monthPalace, savedLiuren.dayPalace, savedLiuren.hourPalace]
    : liurenLesson.steps.map(step => step.palace.name)
  const liurenResultPalace = savedLiuren
    ? LIUREN_PALACES.find(palace => palace.name === savedLiuren.result) || { name: savedLiuren.result, element: savedLiuren.element }
    : liurenLesson.result
  const liurenStepIndices = liurenPalaces.map(name => LIUREN_PALACES.findIndex(palace => palace.name === name))
  const liurenResultIndex = LIUREN_PALACES.findIndex(palace => palace.name === liurenResultPalace.name)
  const skySnapshot = sky.value
  const skyMoment = skySnapshot?.moment ?? null
  const skyTargets = skyMoment
    ? skyMoment.visible.filter(body => body.key !== 'moon')
      .sort((a, b) => a.magnitude - b.magnitude).slice(0, 12)
    : []
  return [
    {
      key: 'almanac',
      label: meta('almanac').label,
      path: meta('almanac').path,
      chapter: `${meta('almanac').number} / ${meta('almanac').code}`,
      title: meta('almanac').title,
      concept: '以历法安顿日常。查每日宜忌、值宿与冲煞，让起居行止皆有天时可依。',
      description: `${day.lunarText} · ${day.dayGanZhi}日`,
      metrics: [
        { label: '宜', value: day.yi.slice(0, 2).join(' · ') },
        { label: '忌', value: day.ji.slice(0, 2).join(' · ') },
        { label: '值宿', value: `${day.xiuName} · ${day.xiuLuck}` }
      ],
      instrument: { xiuIndex: XIU_NAMES.indexOf(xiuName), xiuName, yi: day.yi.slice(0, 3), ji: day.ji.slice(0, 3) },
      cta: '进入黄历'
    },
    {
      key: 'zeji',
      label: meta('zeji').label,
      path: meta('zeji').path,
      chapter: `${meta('zeji').number} / ${meta('zeji').code}`,
      title: meta('zeji').title,
      concept: '为一件事寻找更合宜的时间。以事项、日期与生肖避冲，权衡当下的进退之机。',
      description: '先定所求之事，再观时日宜忌。',
      metrics: [
        { label: '当前日期', value: day.dateStr },
        { label: '日柱', value: day.dayGanZhi },
        { label: '冲煞', value: day.chongLabel }
      ],
      instrument: { days: zejiDays },
      cta: '进入择吉'
    },
    {
      key: 'fortune',
      label: meta('fortune').label,
      path: meta('fortune').path,
      chapter: `${meta('fortune').number} / ${meta('fortune').code}`,
      title: meta('fortune').title,
      concept: '看一日气机与自身五行的往来，辨事业、财务、情感与身心的轻重缓急。',
      description: fortuneData.relationDesc,
      metrics: [
        { label: '综合', value: `${fortuneData.overall} / 100` },
        ...fortuneMetrics
      ],
      instrument: { categories: Object.values(fortuneData.categories).map(item => ({ name: item.name, score: item.score })) },
      cta: '进入运势'
    },
    {
      key: 'bazi',
      label: meta('bazi').label,
      path: meta('bazi').path,
      chapter: `${meta('bazi').number} / ${meta('bazi').code}`,
      title: meta('bazi').title,
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
      instrument: { pillars: baziData?.pillars || [], wxCount: baziData?.wxCount || {} },
      cta: '进入八字'
    },
    {
      key: 'gua',
      label: meta('gua').label,
      path: meta('gua').path,
      chapter: `${meta('gua').number} / ${meta('gua').code}`,
      title: meta('gua').title,
      concept: '六爻成象，动爻见变。以一枚诚问照见当下的机与应，不求定数，只辨方向。',
      description: hex?.question || '心中有所问，方可观卦象之变。',
      metrics: hex
        ? [
            { label: '本卦', value: hex.result.primaryName },
            { label: '变卦', value: hex.result.changedName || '六爻安静' }
          ]
        : [{ label: '卦象状态', value: '尚未起卦' }],
      instrument: { lines: hex?.result.lines || [], movingCount: hex?.result.movingIdx?.length || 0 },
      cta: '进入摇卦'
    },
    {
      key: 'dream',
      label: meta('dream').label,
      path: meta('dream').path,
      chapter: `${meta('dream').number} / ${meta('dream').code}`,
      title: meta('dream').title,
      concept: '梦是心绪留下的暗纹。循意象与民俗象征解梦，也借一面古镜照见未说出口的念头。',
      description: dream?.text || '记录一个梦境，从民俗象征中读懂当下心绪。',
      metrics: dream
        ? [
            { label: '关键词', value: dream.keyword },
            { label: '传统吉凶', value: dream.luck || '已记录' }
          ]
        : [{ label: '梦境状态', value: '尚未记录' }],
      instrument: { keyword: dream?.keyword || '梦' },
      cta: '进入解梦'
    },
    {
      key: 'liuren',
      label: meta('liuren').label,
      path: meta('liuren').path,
      chapter: `${meta('liuren').number} / ${meta('liuren').code}`,
      title: meta('liuren').title,
      concept: '以小六壬六宫观此刻之机。月课起因，日课经过，时课落点；只辨方向，不定吉凶。',
      description: savedLiuren
        ? `${savedLiuren.lunar} · ${savedLiuren.time} · ${liurenResultPalace.name}`
        : `${liurenLesson.monthLabel}${liurenLesson.lunarDay}日 · ${liurenLesson.hourBranch}时 · ${liurenResultPalace.name}`,
      metrics: [
        { label: '三课', value: liurenPalaces.join(' · ') },
        { label: '落宫', value: `${liurenResultPalace.name} · ${liurenResultPalace.element}` }
      ],
      instrument: {
        resultIndex: liurenResultIndex,
        steps: liurenStepIndices,
        resultName: liurenResultPalace.name,
        resultElement: liurenResultPalace.element
      },
      cta: '进入小六壬'
    },
    {
      key: 'sky',
      label: meta('sky').label,
      path: meta('sky').path,
      chapter: `${meta('sky').number} / ${meta('sky').code}`,
      title: meta('sky').title,
      concept: '仰见星辰。以所在坐标推算此刻的天光、月相与星位，知道何时抬头、该朝哪个方向看。',
      description: skyMoment
        ? `${skySnapshot.clock} · ${skyMoment.score.darknessLabel} · ${skyMoment.moon.phaseName}`
        : '按所在坐标推算今夜星位，须等到天黑才好看。',
      metrics: skyMoment
        ? [
            { label: '暗夜指数', value: `${skyMoment.score.total} · ${skyMoment.score.label}` },
            { label: '可见', value: `${skyMoment.visible.filter(body => body.kind === 'planet').length} 行星 · ${skyMoment.visible.filter(body => body.kind === 'star').length} 亮星` },
            { label: '月相', value: `${Math.round(skyMoment.moon.illumination * 100)}% ${skyMoment.moon.waxing ? '盈' : '亏'}` }
          ]
        : [{ label: '星图状态', value: '推算中' }],
      instrument: {
        score: skyMoment?.score.total ?? null,
        moonName: skyMoment?.moon.phaseName || '月',
        illumination: skyMoment?.moon.illumination ?? 0,
        waxing: skyMoment?.moon.waxing ?? true,
        targets: skyTargets
      },
      cta: '进入观星'
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
    <HomeAiConclusion embedded />
  </div>
</template>

<style scoped>
.home-view { position: relative; background: var(--void); }
</style>
