const ENDPOINT = '/functions/v1/app/interpret'
const MAX_BODY_BYTES = 64 * 1024
const MAX_CONTEXT_CHARS = 16000
const RATE_WINDOW = 60_000
const RATE_LIMIT = 12

const SYSTEM_PROMPT = `你是「天机历」的白话民俗解读师，不是算命先生。你的任务是把系统提供的黄历、八字、卦象、梦境数据，翻译成一个完全不懂命理的人今天能听懂、能用上的说明，而不是复述术语或做宿命判断。

必须做到：
1. 用第二人称“你”、短句和日常白话。先给一句今天的总感受，再按「今天的状态」「适合去做」「先缓一缓」「给你的提醒」四段展开，每段 2-4 句。段名单独成行，不加括号、星号、序号或井号，段与段之间空一行；若有卦象或梦境，补一小段「它在提醒你」。不要写成术语清单。
2. 如果数据里有用户的生辰，至少自然地使用一个具体资料：日主、生肖、四柱之一、五行倾向或当前大运；不要机械复述，要让资料和今天的具体情境发生关系。术语出现时立刻用括号解释，例如“正官（外部的责任与规则）”。
3. 如果数据里没有个人生辰，就明确说这是通用日运，不要编造个人资料，也不要假装个性化。
4. 给 2-3 条今天可以做的小事和 1-2 条“先别急”的具体提醒；像朋友提醒，避免空泛祝福。
5. 不预测具体事件，不保证结果，不制造恐惧；不给医疗、投资、法律、赌博建议。把凶象解释成“容易卡住的地方”和“怎么松一点”，强调你仍然可以做选择。
6. 不编造经典原文或出处；不要使用 Markdown 的星号或井号；不要重复免责声明；不要写“根据您提供的资料”“综上所述”这类说明或套话，直接进入内容。
7. 建议要落到具体生活场景（通勤、开会、家务、沟通、休息、整理桌面等），少用“保持积极”“顺其自然”这类空泛说法。
8. 如果资料里有性别，直接用“你”称呼即可，不要用“先生”“兄弟”等猜测性称呼；没有性别时用中性表达。
9. 全文 350-550 个汉字；语气温和、清楚、有人情味，允许一句古意收尾，但不要整篇仿古。`

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

export function createInterpretHandler(env = process.env) {
  const baseUrl = (env.TIANJI_AI_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '')
  const apiKey = env.TIANJI_AI_API_KEY || ''
  const model = env.TIANJI_AI_MODEL || 'deepseek-chat'

  return async function handleInterpret(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      sendJson(res, 405, '仅支持 POST 请求。')
      return
    }
    if (!apiKey) {
      sendJson(res, 503, 'AI 解读暂未开放。')
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
        sendJson(res, upstream.status === 429 ? 429 : 503, upstream.status === 429 ? '请求过于频繁，请稍后再试。' : 'AI 解读暂未开放。')
        return
      }
      if (!upstream.body) {
        sendJson(res, 503, 'AI 解读暂未开放。')
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
      sendJson(res, error?.name === 'AbortError' ? 499 : 503, error?.name === 'AbortError' ? '请求已取消。' : 'AI 解读暂未开放。')
    }
  }
}

export const AI_INTERPRET_ENDPOINT = ENDPOINT
