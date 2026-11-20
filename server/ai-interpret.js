const ENDPOINT = '/functions/v1/app/interpret'
const MAX_BODY_BYTES = 64 * 1024
const MAX_CONTEXT_CHARS = 16000
const RATE_WINDOW = 60_000
const RATE_LIMIT = 12

const SYSTEM_PROMPT = `你是一位精通《周易》、八字命理、传统黄历与二十八宿的国学文化讲解员，为用户解读一款传统文化娱乐工具生成的每日运势数据。

要求：
1. 用通俗优雅、略带古韵的现代白话解读，引经据典时给出白话释义。
2. 语气积极温和、趋吉避凶、引人向善，体现传统文化的生活智慧。
3. 这是文化体验与娱乐参考，严禁给出医疗诊断、用药、投资、赌博等具体建议；遇到凶象以化解心态、谨慎行事的角度温和引导，不制造恐惧。
4. 结构清晰，分小节输出（可用「今日气象」「卦象点拨」「行事建议」「寄语」等小标题），总长 400-600 字。
5. 结尾不需要重复免责声明，应用界面已展示。`

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
