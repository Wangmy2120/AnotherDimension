import { Lunar } from 'lunar-typescript'
import { getDayInfo } from './calendar.js'
import catalog from '../data/tongxiang.json'

/**
 * 同历法坐标：把史载/文中自记的日期交给既有的历法引擎，
 * 再用它自己算出的坐标去和今天比对——引擎只回答「坐标是否重合」，不回答吉凶。
 */

export const PRECISION_LABEL = {
  full: '年月日有据',
  'lunar-day': '月日有据 · 年系推定',
  month: '仅系到月',
  season: '仅系到节令'
}

const RANK = { full: 4, 'lunar-day': 3, month: 2, season: 1 }

const JIEQI_ORDER = [
  '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑',
  '立秋', '处暑', '白露', '秋分', '寒露', '霜降',
  '立冬', '小雪', '大雪', '冬至', '小寒', '大寒'
]
const SEASON_BY_JIEQI = {}
JIEQI_ORDER.forEach((name, index) => {
  SEASON_BY_JIEQI[name] = '春夏秋冬'[Math.floor(index / 6)]
})

const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' }

function seasonOf(jieqi) {
  return SEASON_BY_JIEQI[jieqi] || ''
}

// lunar-typescript 的 getYearInChinese 对三位数年份会写成「三五三」，展示一律用西纪年配中文月日。
function lunarLabel(coord) {
  return `${coord.year}年${coord.lunarMonthCn}月${coord.lunarDayCn}`
}

export function coordinatesOf(dateStr) {
  const info = getDayInfo(dateStr)
  const [y, m, d] = dateStr.split('-').map(Number)
  const prevSolar = info.prevJie.date
  const [py, pm, pd] = prevSolar.split('-').map(Number)
  const daysFromJie = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(py, pm - 1, pd)) / 86400000)
  return {
    dateStr,
    xiu: info.xiuName.replace('宿', ''),
    xiuFull: info.xiu,
    xiuLuck: info.xiuLuck,
    dayGan: info.dayGan,
    dayZhi: info.dayZhi,
    dayGanZhi: info.dayGanZhi,
    dayWuXing: GAN_WX[info.dayGan] || info.dayWuXing,
    yearGanZhi: info.yearGanZhi,
    lunarMonth: info.lunar.getMonth(),
    lunarDay: info.lunar.getDay(),
    lunarMonthCn: info.lunar.getMonthInChinese(),
    lunarDayCn: info.lunar.getDayInChinese(),
    lunarText: info.lunarText,
    jieqi: info.prevJie.name,
    nextJieqi: info.nextJie.name,
    daysFromJie,
    season: seasonOf(info.prevJie.name),
    year: info.lunar.getYear(),
    solarYear: Number(dateStr.slice(0, 4))
  }
}

function solarStr(date) {
  if (Array.isArray(date.solar)) {
    const [y, m, d] = date.solar
    if (!(y > 0)) return null
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  const [y, m, d] = date.lunar
  // lunar-typescript 的农历数据表不支持公元前，负年号会算出 undefined 干支。
  if (!(y > 0)) return null
  return Lunar.fromYmd(y, m, d).getSolar().toYmd()
}

function dateLabel(event, coord) {
  // 只到月或节令的事件，锚点是推算出来的，就不把具体日辰摆给用户看。
  const rank = RANK[event.date.precision] || 0
  if (rank >= 3) return `${lunarLabel(coord)} · ${coord.dateStr}`
  if (rank === 2) return `农历${coord.lunarMonthCn}月（年月推定）`
  return `${coord.season} · 农历${coord.lunarMonthCn}月（节令推定）`
}

const CHANNELS = [
  {
    key: 'xiu',
    label: '同值宿',
    weight: 55,
    minRank: 4,
    hit: (a, b) => a.xiu === b.xiu,
    detail: b => `同一日值「${b.xiuFull}」，二十八日一轮`
  },
  {
    key: 'dayZhi',
    label: '同日支',
    weight: 42,
    minRank: 4,
    hit: (a, b) => a.dayZhi === b.dayZhi,
    detail: b => `日支同属${b.dayZhi}，十二日一轮`
  },
  {
    key: 'lunarMD',
    label: '同农历月日',
    weight: 35,
    minRank: 3,
    hit: (a, b) => Math.abs(a.lunarMonth) === Math.abs(b.lunarMonth) && a.lunarDay === b.lunarDay,
    detail: b => `同一个岁时：${lunarLabel(b)}`
  },
  {
    key: 'yearGZ',
    label: '同干支年',
    weight: 30,
    minRank: 4,
    hit: (a, b) => a.yearGanZhi === b.yearGanZhi,
    detail: b => `岁在${b.yearGanZhi}，六十年一遇`
  },
  {
    key: 'jieqi',
    label: '同节气段',
    weight: 20,
    minRank: 4,
    hit: (a, b) => a.jieqi === b.jieqi && Math.abs(a.daysFromJie - b.daysFromJie) <= 2,
    detail: b => `同在「${b.jieqi}」后第 ${b.daysFromJie} 天`
  },
  {
    key: 'dayWx',
    label: '同日干五行',
    weight: 14,
    minRank: 4,
    hit: (a, b) => a.dayWuXing === b.dayWuXing,
    detail: b => `日干五行同属${b.dayWuXing}`
  },
  {
    key: 'lunarM',
    label: '同农历月',
    weight: 12,
    minRank: 2,
    hit: (a, b) => Math.abs(a.lunarMonth) === Math.abs(b.lunarMonth),
    detail: b => `${b.lunarMonth < 0 ? '闰' : ''}${['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'][Math.abs(b.lunarMonth) - 1]}月`
  },
  {
    key: 'season',
    label: '同季',
    weight: 8,
    minRank: 1,
    hit: (a, b) => !!a.season && a.season === b.season,
    detail: b => `同在${b.season}`
  }
]

const resolved = []
for (const event of catalog.events) {
  try {
    const ds = solarStr(event.date)
    if (!ds) {
      resolved.push({ event, coord: null, error: '公元前日期超出历法引擎可用范围' })
      continue
    }
    resolved.push({ event, coord: coordinatesOf(ds) })
  } catch (e) {
    resolved.push({ event, coord: null, error: e?.message || '换算失败' })
  }
}

const RANK_NAME = Object.fromEntries(Object.entries(RANK).map(([name, value]) => [value, name]))

export function channelInfo() {
  return CHANNELS.map(({ key, label, weight, minRank }) => ({
    key,
    label,
    weight,
    needs: PRECISION_LABEL[RANK_NAME[minRank]]
  }))
}

export function catalogRows() {
  return resolved
    .filter(item => item.coord)
    .map(({ event, coord }) => ({
      id: event.id,
      title: event.title,
      figure: event.figure,
      star: event.star || '',
      kind: event.kind,
      era: event.era,
      place: event.place,
      precision: event.date.precision,
      precisionLabel: PRECISION_LABEL[event.date.precision] || event.date.precision,
      basis: event.date.basis,
      label: dateLabel(event, coord),
      solarYear: coord.solarYear,
      dayGanZhi: coord.dayGanZhi,
      xiu: coord.xiu,
      xiuFull: coord.xiuFull,
      jieqi: coord.jieqi,
      season: coord.season
    }))
    .sort((a, b) => a.solarYear - b.solarYear)
}

export function catalogStats() {  return {
    total: catalog.events.length,
    history: catalog.events.filter(e => e.kind === 'history').length,
    fiction: catalog.events.filter(e => e.kind === 'fiction').length,
    broken: resolved.filter(item => !item.coord).map(item => ({ id: item.event.id, error: item.error }))
  }
}

export function findKindred(dateStr, { limit = 4, kind = 'all', minScore = 8 } = {}) {
  const today = coordinatesOf(dateStr)
  const hits = []
  for (const { event, coord } of resolved) {
    if (!coord) continue
    if (kind !== 'all' && event.kind !== kind) continue
    if (coord.solarYear > today.solarYear) continue
    const rank = RANK[event.date.precision] || 0
    const reasons = []
    for (const ch of CHANNELS) {
      if (rank < ch.minRank) continue
      if (ch.hit(today, coord)) reasons.push({ key: ch.key, label: ch.label, weight: ch.weight, detail: ch.detail(coord) })
    }
    if (!reasons.length) continue
    const score = reasons.reduce((sum, r) => sum + r.weight, 0)
    if (score < minScore) continue
    hits.push({
      event,
      coord,
      reasons,
      score,
      yearsAgo: today.solarYear - coord.solarYear,
      label: dateLabel(event, coord),
      precisionLabel: PRECISION_LABEL[event.date.precision] || event.date.precision,
      basis: event.date.basis
    })
  }
  hits.sort((a, b) => b.score - a.score || a.yearsAgo - b.yearsAgo)
  return {
    today: { ...today, summary: `${today.yearGanZhi}年 ${today.dayGanZhi}日 · ${today.xiuFull} · ${today.jieqi}后第 ${today.daysFromJie} 天` },
    list: hits.slice(0, limit),
    scanned: resolved.filter(item => item.coord).length
  }
}
