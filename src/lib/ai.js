export const AI_ENDPOINT = '/functions/v1/app/interpret'

export function buildContext({ dayInfo, bazi, fortune, solar, hexResult, question, dream, sky }) {
  const ctx = {
    日期: `${dayInfo.dateStr}（农历${dayInfo.lunarText}）`,
    干支: `${dayInfo.yearGanZhi}年 ${dayInfo.monthGanZhi}月 ${dayInfo.dayGanZhi}日`,
    黄历: { 宜: dayInfo.yi.slice(0, 8), 忌: dayInfo.ji.slice(0, 8), 冲煞: dayInfo.chongLabel },
    值日星宿: { 星宿: dayInfo.xiu, 吉凶: dayInfo.xiuLuck },
    节气: `${dayInfo.prevJie.name}后，${dayInfo.nextJie.name}前`
  }
  if (solar) {
    ctx.观测时空 = {
      真太阳时: solar.trueSolarTime,
      太阳方位角: `${solar.azimuth.toFixed(1)}°`,
      太阳高度角: `${solar.elevation.toFixed(1)}°`
    }
  }
  if (bazi) {
    ctx.命主 = {
      四柱: bazi.pillars.map(p => `${p.label}${p.gz}`).join(' '),
      日主: `${bazi.dayGan}（${bazi.dayMasterWuXing}）`,
      生肖: bazi.shengXiao,
      性别: { male: '男', female: '女' }[bazi.gender] || '未提供',
      五行分布: bazi.wxCount,
      纳音: bazi.pillars.map(p => p.ny).join('、'),
      当前大运: bazi.yun
        ? `${bazi.yun.currentGanZhi}（${bazi.yun.start}）`
        : '未提供'
    }
  }
  if (fortune) {
    ctx.今日运势 = {
      日主与当日关系: fortune.relation || '未提供八字',
      综合分: fortune.overall,
      分项: Object.fromEntries(Object.entries(fortune.categories).map(([k, v]) => [v.name, `${v.score}分`])),
      开运参考: fortune.lucky
    }
  }
  if (hexResult) {
    ctx.周易卦象 = {
      所问之事: question || '今日整体运势',
      本卦: `${hexResult.primaryName}（${hexResult.primary.scripture}）`,
      动爻: hexResult.movingTexts.map(t => `${t.name}：${t.scripture}`),
      变卦: hexResult.changedName || '无动爻'
    }
  }
  if (dream) {
    ctx.梦境 = { 关键词: dream.keyword, 民俗释义: dream.text, 传统吉凶: dream.luck }
  }
  if (sky) {
    ctx.今夜星空 = {
      时刻: `${sky.dateStr} ${sky.clock}`,
      地点: `${sky.location.latitude.toFixed(3)}, ${sky.location.longitude.toFixed(3)}（${{ default: '默认位置', gps: '浏览器定位', manual: '手动输入' }[sky.location.source] || '默认位置'}）`,
      暗夜指数: `${sky.score.total}/100 ${sky.score.label}（${sky.score.darkness}）`,
      太阳: `高度 ${sky.sun.elevation}°`,
      月相: `${sky.moon.phase}，照明 ${sky.moon.illumination}%，${sky.moon.hint}`,
      行星: sky.planets,
      已升起亮星: sky.stars,
      今夜事件: sky.events
    }
  }
  const ask = dream
    ? '以下是用户梦境的民俗释义与今日背景数据，请结合传统解梦文化与现代心理视角，温和积极地为用户解读此梦，并给出安心的生活建议：'
    : sky
      ? '以下是用户此刻所在地点实测推算的星空数据，请结合中国传统星宿文化与天文常识，解读今夜星空可观什么、何时看、朝哪个方位看，语气温克制，不作吉凶断言：'
      : '以下是工具今日生成的数据，请综合解读：'
  return `${ask}\n${JSON.stringify(ctx, null, 1)}`
}

async function errorMessage(response) {
  if (response.status === 404 || response.status === 503) return 'AI 解读暂未开放。'
  if (response.status === 429) return '请求过于频繁，请稍后再试。'
  try {
    const data = await response.json()
    if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim()
  } catch { /* 服务不可用或返回非 JSON */ }
  return 'AI 解读暂时不可用，请稍后再试。'
}

export async function streamInterpret(context, onDelta, signal) {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context })
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  if (!res.body) throw new Error('AI 解读暂时不可用，请稍后再试。')
  if (!(res.headers.get('content-type') || '').includes('text/event-stream')) {
    throw new Error('AI 解读暂未开放。')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
      } catch { /* 忽略不完整的帧 */ }
    }
  }
}
