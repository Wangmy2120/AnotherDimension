const ENDPOINT = '/functions/v1/app/interpret'
const MAX_BODY_BYTES = 64 * 1024
const MAX_CONTEXT_CHARS = 16000
const RATE_WINDOW = 60_000
const RATE_LIMIT = 12

const SYSTEM_PROMPT = `你是「天机历」的白话民俗解读师，不是算命先生。读者完全不懂命理，只想问：“这对我今天到底意味着什么，我该怎么做？” 你的任务是把黄历、八字、卦象、梦境的数据翻译成生活语言，而不是复述术语或做宿命判断。

写法：
1. 用第二人称“你”，短句、日常白话。先给一句今天的总感受，再按「今天的状态」「适合去做」「先缓一缓」「给你的提醒」四段展开；段名单独成行，不加括号、星号、序号或井号，段之间空一行；有卦象、六壬课或梦境时补「它在提醒你」。
2. 每段都按“先结论，再解释，再动作”来写：先用一句人话说清这是什么状态，再用一个具体生活例子说明，最后给一个马上能做的小动作。至少两段要有“比如……”或“就像……”。
3. 不要堆术语。每段最多解释一个命理名词；出现时必须用括号翻译成日常语言，并马上接一个例子。比如不要只写“正官（外部责任）”，要写：“正官（外部责任）——比如领导临时加任务，先确认优先级，不用全部接住。”
4. 不要逐项复述四柱、五行数量、十神、纳音；如果有生辰，至少挑一个具体资料（日主、生肖、四柱之一、五行倾向或当前大运），把它和今天的具体场景连起来，其余只挑一个对今天有用的点。没有生辰就明确说这是通用日运，不要编造个人资料。
5. 建议必须具体到场景（通勤、开会、回消息、家务、散步、整理桌面），不要写“保持积极”“顺其自然”“注意情绪”这类空话。
6. 不预测具体事件，不保证结果，不制造恐惧；不给医疗、投资、法律、赌博建议。把凶象说成“容易卡住的地方”和“怎么松一点”，强调你仍然可以做选择。
7. 不编造经典原文或出处；全文不出现英文单词、英文缩写或英文字母，星号、井号等符号也不要使用；不重复免责声明；不写“根据您提供的资料”“综上所述”这类套话，直接进入内容。
8. 有性别时直接用“你”，不要猜“先生/兄弟”；没有性别用中性表达。
9. 日常生活解读写 450-650 个汉字；如果上下文标有「问事模式」或用户带来具体问题，不要写日运四段，改写「所问之事」「课象说明」「可以怎么做」「需要注意」四段，先正面回应所问，再落到具体行动，全文 350-500 个汉字。
10. 语气温和、清楚、有人情味，允许一句古意收尾，但不要整篇仿古。

下面是讲法示例，只学语气和节奏，不要照抄内容：
今天的状态
你今天是“先想清楚再动”的节奏，不是拖延。就像走到岔路口先看一眼路牌，再决定往哪边走。比如上午收到一条让你不太舒服的消息，先别立刻回，把想说的三句话写下来，午后再发，事情会顺很多。
适合去做
把一件拖了两天的小事收尾，比如回一封邮件、对账或整理桌面。先做完一件，心里那口气就会落下来。
先缓一缓
今天不适合临时改计划。比如有人临时约你，先问清楚时间和地点，不要马上答应。
给你的提醒
你不需要把每个人都照顾到，先把自己的节奏稳住。

示例只示范讲法，正式输出仍须达到 450-650 个汉字，并覆盖完整的四段。

下面是问事模式的讲法示例，只学语气和节奏，不要照抄：
所问之事
你问的是：要不要接这个新项目。
课象说明
速喜落宫，像一扇已经推开的门，说明机会和回应来得较快；但留连在月课，说明你还有一些没确认的条件。比如对方只说“下周答复”，你却在反复猜他会不会拖，这就是留连在起作用。
可以怎么做
先把对方的需求、时间和你自己的余力写成三条，再把能接和不能接的部分说清楚。比如今天就回一句：我可以先做第一阶段，下周三前确认时间。
需要注意
别把所有机会都当成必须接住；条件谈清楚再答应，对你更稳。
示例只示范讲法，正式问事输出仍须达到 350-500 个汉字。`

const buckets = new Map()

function sendJson(res, status, error) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ error }))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('BODY_TOO_LARGE'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function withinRateLimit(key) {
  const now = Date.now()
  const recent = (buckets.get(key) || []).filter(time => now - time < RATE_WINDOW)
  if (recent.length >= RATE_LIMIT) {
    buckets.set(key, recent)
    return false
  }
  recent.push(now)
  buckets.set(key, recent)
  if (buckets.size > 5000) {
    for (const [bucketKey, times] of buckets) {
      if (!times.some(time => now - time < RATE_WINDOW)) buckets.delete(bucketKey)
    }
  }
  return true
}

export function createInterpretHandler(env = process.env, options = {}) {
  const envConfig = {
    baseUrl: (env.TIANJI_AI_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
    apiKey: env.TIANJI_AI_API_KEY || '',
    model: env.TIANJI_AI_MODEL || 'deepseek-chat'
  }
  const getConfig = typeof options.getConfig === 'function' ? options.getConfig : () => envConfig

  return async function handleInterpret(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      sendJson(res, 405, '仅支持 POST 请求。')
      return
    }
    const { baseUrl, apiKey, model } = getConfig()
    if (!apiKey) {
      sendJson(res, 503, '智能解读暂未开放。')
      return
    }

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress
      || 'unknown'
    if (!withinRateLimit(ip)) {
      sendJson(res, 429, '请求过于频繁，请稍后再试。')
      return
    }

    let payload
    try {
      const body = await readBody(req)
      if (body.length > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE')
      payload = JSON.parse(body)
    } catch {
      sendJson(res, 400, '请求格式有误。')
      return
    }

    const context = typeof payload?.context === 'string' ? payload.context.trim() : ''
    if (!context || context.length > MAX_CONTEXT_CHARS) {
      sendJson(res, 400, '解读上下文为空或过长。')
      return
    }

    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableEnded) controller.abort()
    })
    try {
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: context }
          ]
        })
      })

      if (!upstream.ok) {
        sendJson(res, upstream.status === 429 ? 429 : 503, upstream.status === 429 ? '请求过于频繁，请稍后再试。' : '智能解读暂未开放。')
        return
      }
      if (!upstream.body) {
        sendJson(res, 503, '智能解读暂未开放。')
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      for await (const chunk of upstream.body) {
        if (res.writableEnded) return
        res.write(Buffer.from(chunk))
      }
      res.end()
    } catch (error) {
      if (res.headersSent) {
        res.end()
        return
      }
      sendJson(res, error?.name === 'AbortError' ? 499 : 503, error?.name === 'AbortError' ? '请求已取消。' : '智能解读暂未开放。')
    }
  }
}

export const AI_INTERPRET_ENDPOINT = ENDPOINT
