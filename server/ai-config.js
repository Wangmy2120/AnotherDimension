import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const AI_CONFIG_ENDPOINT = '/functions/v1/app/ai-config'

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_MODEL = 'deepseek-chat'
const MAX_BODY_BYTES = 16 * 1024
const MAX_BASE_URL_LENGTH = 500
const MAX_MODEL_LENGTH = 120
const MAX_KEY_LENGTH = 4096

function cleanBaseUrl(value, fallback = DEFAULT_BASE_URL) {
  const raw = String(value || '').trim().replace(/\/+$/, '')
  if (!raw || raw.length > MAX_BASE_URL_LENGTH) return fallback
  try {
    const parsed = new URL(raw)
    if (!['http:', 'https:'].includes(parsed.protocol)) return fallback
  } catch {
    return fallback
  }
  return raw
}

function validateBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '')
  if (!raw) throw new Error('请填写接口地址。')
  if (raw.length > MAX_BASE_URL_LENGTH) throw new Error('接口地址过长。')
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error('接口地址格式有误。')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('接口地址必须以 http:// 或 https:// 开头。')
  return raw
}

function cleanModel(value, fallback = DEFAULT_MODEL) {
  const raw = String(value || '').trim()
  return raw && raw.length <= MAX_MODEL_LENGTH ? raw : fallback
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

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

function isLoopback(req) {
  const address = req.socket?.remoteAddress || ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

export function createAiConfig(env = process.env, options = {}) {
  const configFile = options.configFile
    || env.TIANJI_AI_CONFIG_FILE
    || path.join(os.homedir(), '.tianji', 'ai-config.json')
  const envBaseUrl = cleanBaseUrl(env.TIANJI_AI_BASE_URL)
  const envModel = cleanModel(env.TIANJI_AI_MODEL)
  const envKey = typeof env.TIANJI_AI_API_KEY === 'string' ? env.TIANJI_AI_API_KEY.trim() : ''

  let stored = {}
  try {
    const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    if (parsed && typeof parsed === 'object') stored = parsed
  } catch { /* 首次运行时没有本地配置 */ }

  const storedKey = typeof stored.apiKey === 'string' ? stored.apiKey.trim() : ''
  let current = {
    baseUrl: cleanBaseUrl(stored.baseUrl, envBaseUrl),
    model: cleanModel(stored.model, envModel),
    apiKey: storedKey || envKey
  }
  let source = storedKey ? 'local' : envKey ? 'env' : 'none'

  function status() {
    return {
      configured: Boolean(current.apiKey),
      configurable: true,
      source,
      baseUrl: current.baseUrl,
      model: current.model
    }
  }

  function persist() {
    fs.mkdirSync(path.dirname(configFile), { recursive: true })
    fs.writeFileSync(configFile, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 })
  }

  return {
    get() {
      return { ...current }
    },
    status,
    save(input = {}) {
      const baseUrl = input.baseUrl ? validateBaseUrl(input.baseUrl) : current.baseUrl
      const model = input.model ? cleanModel(input.model, current.model) : current.model
      let apiKey = current.apiKey
      if (typeof input.apiKey === 'string' && input.apiKey.trim()) apiKey = input.apiKey.trim()
      if (!apiKey) throw new Error('请填写 API Key。')
      if (apiKey.length > MAX_KEY_LENGTH || /[\r\n]/.test(apiKey)) throw new Error('API Key 格式有误。')
      current = { baseUrl, model, apiKey }
      persist()
      source = 'local'
      return status()
    },
    clear() {
      try { fs.rmSync(configFile, { force: true }) } catch { /* 文件可能不存在 */ }
      current = { baseUrl: envBaseUrl, model: envModel, apiKey: envKey }
      source = envKey ? 'env' : 'none'
      return status()
    }
  }
}

export function createAiConfigHandler(store) {
  return async function handleAiConfig(req, res) {
    if (!isLoopback(req) || !sameOrigin(req)) {
      sendJson(res, 403, { error: '仅允许在本机配置 AI 服务。' })
      return
    }
    if (req.method === 'GET') {
      sendJson(res, 200, store.status())
      return
    }
    if (req.method === 'DELETE') {
      sendJson(res, 200, store.clear())
      return
    }
    if (req.method === 'POST') {
      if (!String(req.headers['content-type'] || '').includes('application/json')) {
        sendJson(res, 415, { error: '请求格式有误。' })
        return
      }
      let payload
      try {
        payload = JSON.parse(await readBody(req))
      } catch {
        sendJson(res, 400, { error: '请求格式有误。' })
        return
      }
      try {
        sendJson(res, 200, store.save(payload))
      } catch (error) {
        sendJson(res, 400, { error: error.message || '配置保存失败。' })
      }
      return
    }
    res.setHeader('Allow', 'GET, POST, DELETE')
    sendJson(res, 405, { error: '不支持该请求。' })
  }
}
