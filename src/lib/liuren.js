import { Solar } from 'lunar-typescript'

export const LIUREN_PALACES = [
  {
    key: 'daan',
    name: '大安',
    element: '木',
    direction: '东',
    tone: '安定',
    verdict: '吉',
    main: '守成',
    summary: '事情有旧路可循，眼下宜稳住节奏，不必急着另开新局。',
    advice: '把手上的一件事做完整，再谈下一步；今天更适合整理，而不是冒进。',
    yi: ['守成', '整理', '按部就班'],
    ji: ['冒进', '临时改计划', '争一时快']
  },
  {
    key: 'liulian',
    name: '留连',
    element: '土',
    direction: '中',
    tone: '拖延',
    verdict: '缓',
    main: '缠绵',
    summary: '事情容易拖长，消息也可能晚到；越催越乱，先让线索自己浮出来。',
    advice: '先问清楚再决定，今天可以等一等；把要确认的事列出来，比反复猜更省力。',
    yi: ['等待', '复盘', '补充信息'],
    ji: ['催促', '仓促定案', '反复纠缠']
  },
  {
    key: 'suxi',
    name: '速喜',
    element: '火',
    direction: '南',
    tone: '快速',
    verdict: '吉',
    main: '喜讯',
    summary: '转机来得快，适合把已经想清楚的话说出口，主动往前推半步。',
    advice: '把最重要的一件事先发出去；机会在回应里，不在反复犹豫里。',
    yi: ['联络', '推进', '表态'],
    ji: ['拖延', '反复犹豫', '错过时机']
  },
  {
    key: 'chikou',
    name: '赤口',
    element: '金',
    direction: '西',
    tone: '口舌',
    verdict: '慎',
    main: '争执',
    summary: '容易因一句话起摩擦，先分清事情和情绪，别在气头上定输赢。',
    advice: '重要的回复先写下来，放一放再发；今天适合书面沟通，不适合当场争辩。',
    yi: ['书面沟通', '核对细节', '暂缓争论'],
    ji: ['争辩', '当场拍板', '翻旧账']
  },
  {
    key: 'xiaoji',
    name: '小吉',
    element: '水',
    direction: '北',
    tone: '和合',
    verdict: '吉',
    main: '小成',
    summary: '小事可成，人情可通；把目标缩小一点，反而更容易落地。',
    advice: '先做一件小而具体的事，别一口吃成大的；今天适合合作和问候。',
    yi: ['合作', '小试', '问候'],
    ji: ['贪多', '夸大承诺', '急于求成']
  },
  {
    key: 'kongwang',
    name: '空亡',
    element: '土',
    direction: '中',
    tone: '落空',
    verdict: '慎',
    main: '停滞',
    summary: '预期容易落空，事情暂时推不动；先把想象里的部分拿掉，确认事实。',
    advice: '把计划缩小，先查证再行动；今天适合止损和休息，不适合下重注。',
    yi: ['止损', '查证', '休息'],
    ji: ['强推', '下重注', '用想象补空白']
  }
]

export const HOUR_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

export const LIUREN_METHOD = '小六壬以农历月、日、时三课落宫。自大安起月，月上起日，日上起时；以最后落宫观当下之机。'

export function hourBranchIndex(hour) {
  return Math.floor((Math.max(0, Math.min(23, Number(hour) || 0)) + 1) / 2) % 12
}

export function getLiurenLesson({ dateStr, hour = 0, minute = 0 }) {
  const [year, month, day] = String(dateStr).split('-').map(Number)
  const solar = Solar.fromYmd(year, month, day)
  const lunar = solar.getLunar()
  const rawMonth = lunar.getMonth()
  const leap = rawMonth < 0
  const lunarMonth = Math.abs(rawMonth)
  const lunarDay = lunar.getDay()
  const safeHour = Math.max(0, Math.min(23, Math.round(Number(hour) || 0)))
  const safeMinute = Math.max(0, Math.min(59, Math.round(Number(minute) || 0)))
  const branchIndex = hourBranchIndex(safeHour)
  const monthIndex = (lunarMonth - 1) % 6
  const dayIndex = (monthIndex + lunarDay - 1) % 6
  const hourIndex = (dayIndex + branchIndex) % 6
  const result = LIUREN_PALACES[hourIndex]
  const monthLabel = `${leap ? '闰' : ''}${lunarMonth}月`
  const timeLabel = `${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`
  const steps = [
    { key: 'month', label: '月课', countLabel: monthLabel, palace: LIUREN_PALACES[monthIndex], index: monthIndex },
    { key: 'day', label: '日课', countLabel: `${lunarDay}日`, palace: LIUREN_PALACES[dayIndex], index: dayIndex },
    { key: 'hour', label: '时课', countLabel: `${HOUR_BRANCHES[branchIndex]}时`, palace: LIUREN_PALACES[hourIndex], index: hourIndex }
  ]
  return {
    dateStr,
    hour: safeHour,
    minute: safeMinute,
    timeLabel,
    leap,
    lunarMonth,
    lunarDay,
    monthLabel,
    hourBranch: HOUR_BRANCHES[branchIndex],
    monthIndex,
    dayIndex,
    hourIndex,
    result,
    steps,
    method: LIUREN_METHOD
  }
}
