const SETTINGS_KEY = 'tianji.settings'

export const DEFAULT_SETTINGS = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat'
}

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

const SYSTEM_PROMPT = `你是一位精通《周易》、八字命理、传统黄历与二十八宿的国学文化讲解员，为用户解读一款传统文化娱乐工具生成的每日运势数据。

要求：
1. 用通俗优雅、略带古韵的现代白话解读，引经据典时给出白话释义。
2. 语气积极温和、趋吉避凶、引人向善，体现传统文化的生活智慧。
3. 这是文化体验与娱乐参考，严禁给出医疗诊断、用药、投资、赌博等具体建议；遇到凶象以化解心态、谨慎行事的角度温和引导，不制造恐惧。
4. 结构清晰，分小节输出（可用「今日气象」「卦象点拨」「行事建议」「寄语」等小标题），总长 400-600 字。
5. 结尾不需要重复免责声明，应用界面已展示。`

export function buildContext({ dayInfo, bazi, fortune, solar, hexResult, question, dream }) {
  const ctx = {
    日期: `${dayInfo.dateStr}（农历${dayInfo.lunarText}）`,
    干支: `${dayInfo.yearGanZhi}年 ${dayInfo.monthGanZhi}月 ${dayInfo.dayGanZhi}日`,
    黄历: { 宜: dayInfo.yi.slice(0, 8), 忌: dayInfo.ji.slice(0, 8), 冲煞: `冲${dayInfo.chong} 煞${dayInfo.sha}` },
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
      五行分布: bazi.wxCount,
      纳音: bazi.pillars.map(p => p.ny).join('、')
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
  const ask = dream
    ? '以下是用户梦境的民俗释义与今日背景数据，请结合传统解梦文化与现代心理视角，温和积极地为用户解读此梦，并给出安心的生活建议：'
    : '以下是工具今日生成的数据，请综合解读：'
  return `${ask}\n${JSON.stringify(ctx, null, 1)}`
}

export async function streamInterpret(context, settings, onDelta, signal) {
  const url = settings.baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: context }
      ]
    })
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`接口返回 ${res.status}：${text.slice(0, 200) || res.statusText}`)
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