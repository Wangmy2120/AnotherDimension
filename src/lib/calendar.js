import { Solar, Lunar, LunarUtil } from 'lunar-typescript'

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getDayInfo(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const solar = Solar.fromYmd(y, m, d)
  const lunar = solar.getLunar()
  const prevJie = lunar.getPrevJieQi(true)
  const nextJie = lunar.getNextJieQi(true)
  return {
    solar,
    lunar,
    dateStr,
    week: '日一二三四五六'[solar.getWeek()],
    lunarText: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    yearGanZhi: lunar.getYearInGanZhi(),
    monthGanZhi: lunar.getMonthInGanZhi(),
    dayGanZhi: lunar.getDayInGanZhi(),
    dayGan: lunar.getDayGan(),
    dayZhi: lunar.getDayZhi(),
    shengXiao: lunar.getYearShengXiao(),
    yi: lunar.getDayYi(),
    ji: lunar.getDayJi(),
    chong: lunar.getDayChongDesc(),
    chongGan: lunar.getDayChongGan(),
    chongShengXiao: lunar.getDayChongShengXiao(),
    chongLabel: `冲${lunar.getDayChongShengXiao()} · 煞${lunar.getDaySha()}`,
    sha: lunar.getDaySha(),
    pengZu: [lunar.getPengZuGan(), lunar.getPengZuZhi()],
    jiShen: lunar.getDayJiShen(),
    xiongSha: lunar.getDayXiongSha(),
    xiu: `${lunar.getGong()}方${lunar.getShou()} · ${lunar.getXiu()}${lunar.getZheng()}${lunar.getAnimal()}`,
    xiuName: `${lunar.getXiu()}宿`,
    xiuLuck: lunar.getXiuLuck(),
    xiuSong: lunar.getXiuSong(),
    prevJie: { name: prevJie.getName(), date: prevJie.getSolar().toYmd() },
    nextJie: { name: nextJie.getName(), date: nextJie.getSolar().toYmd() },
    jieQiToday: lunar.getJieQi(),
    positions: {
      xi: lunar.getDayPositionXiDesc(),
      cai: lunar.getDayPositionCaiDesc(),
      fu: lunar.getDayPositionFuDesc()
    },
    dayWuXing: LunarUtil.WU_XING_GAN[lunar.getDayGan()]
  }
}

export function getBazi(profile) {
  const { calendar, year, month, day, hour, minute } = profile
  let lunar
  if (calendar === 'lunar') {
    lunar = Lunar.fromYmdHms(year, profile.leap ? -month : month, day, hour, minute, 0)
  } else {
    lunar = Solar.fromYmdHms(year, month, day, hour, minute, 0).getLunar()
  }
  const ec = lunar.getEightChar()
  const pillars = [
    { label: '年柱', gz: ec.getYear(), wx: ec.getYearWuXing(), ny: ec.getYearNaYin() },
    { label: '月柱', gz: ec.getMonth(), wx: ec.getMonthWuXing(), ny: ec.getMonthNaYin() },
    { label: '日柱', gz: ec.getDay(), wx: ec.getDayWuXing(), ny: ec.getDayNaYin() },
    { label: '时柱', gz: ec.getTime(), wx: ec.getTimeWuXing(), ny: ec.getTimeNaYin() }
  ]
  const wxCount = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 }
  for (const p of pillars) for (const c of p.wx) wxCount[c]++
  const dayGan = ec.getDayGan()
  return {
    lunar,
    solar: lunar.getSolar(),
    pillars,
    wxCount,
    dayGan,
    dayMasterWuXing: LunarUtil.WU_XING_GAN[dayGan],
    shengXiao: lunar.getYearShengXiao(),
    taiYuan: ec.getTaiYuan(),
    mingGong: ec.getMingGong(),
    shenGong: ec.getShenGong(),
    xunKong: ec.getDayXunKong(),
    lunarText: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    missingWuXing: Object.keys(wxCount).filter(k => wxCount[k] === 0)
  }
}

export const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
export const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }

export function relationOf(envWx, meWx) {
  if (envWx === meWx) return '比和'
  if (SHENG[envWx] === meWx) return '生我'
  if (SHENG[meWx] === envWx) return '我生'
  if (KE[envWx] === meWx) return '克我'
  return '我克'
}

export const RELATION_DESC = {
  生我: '今日气场生扶日主，如得印绶护持，贵人暗助，宜学习、请教、谋定后动。',
  比和: '今日气场与日主比和，同气相求，根基稳固，宜合作、会友、守成推进。',
  我生: '今日日主泄秀于外，如食伤吐秀，才华易显，宜表达、创作、展示成果。',
  克我: '今日气场克制日主，官杀临身，压力与机遇并存，宜谨慎行事、以柔克刚。',
  我克: '今日日主克制气场，财星当值，掌控力强，宜求财、谈判、主动出击。'
}