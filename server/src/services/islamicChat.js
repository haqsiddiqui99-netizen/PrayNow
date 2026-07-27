import https from 'node:https'

const SYSTEM_PROMPT = `You are the Islamic guidance assistant for PrayNow, a Muslim prayer and mosque app.

Your role:
- Answer questions about Islam clearly, respectfully, and accurately — faith, worship, Quran, Hadith, daily practice, Ramadan, Zakat, Hajj, Wudu, Halal/Haram, and related topics.
- Use plain language suitable for Muslims and those learning about Islam. You may include relevant Quranic verses or authentic Hadith when helpful, but keep answers concise unless the user asks for detail.
- For personal religious rulings (fatwa) on complex or disputed matters, encourage consulting a qualified local scholar or imam rather than giving a definitive legal opinion.
- Stay focused on Islamic guidance. If asked about unrelated topics (weather, coding, sports scores, etc.), politely redirect to Islamic questions.
- Begin responses naturally; do not repeat the user's question unless clarifying.
- When relevant, you may mention PrayNow features: prayer times, mosque finder, Qibla direction, Hadith tab, and live Azan.`

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_HISTORY = 20
const MAX_MESSAGE_LENGTH = 2000

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
    .slice(-MAX_HISTORY)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter((item) => item.content.length > 0)
}

let tlsAgent

function postJson(url, headers, body) {
  const payload = JSON.stringify(body)
  const parsed = new URL(url)
  const options = {
    hostname: parsed.hostname,
    path: `${parsed.pathname}${parsed.search}`,
    method: 'POST',
    headers: {
      ...headers,
      'Content-Length': Buffer.byteLength(payload),
    },
    agent: process.env.OPENAI_TLS_INSECURE === 'true'
      ? (tlsAgent ||= new https.Agent({ rejectUnauthorized: false }))
      : undefined,
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: async () => data,
          json: async () => JSON.parse(data),
        })
      })
    })
    req.on('error', (error) => {
      const wrapped = new Error(error.message || 'OpenAI request failed')
      wrapped.code = 'AI_NETWORK_ERROR'
      wrapped.cause = error
      reject(wrapped)
    })
    req.write(payload)
    req.end()
  })
}

export async function askOpenAiIslamicQuestion(message, history = []) {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    const error = new Error('AI chat is not configured on the server.')
    error.code = 'AI_NOT_CONFIGURED'
    throw error
  }

  const question = String(message ?? '').trim().slice(0, MAX_MESSAGE_LENGTH)
  if (!question) {
    const error = new Error('Message is required.')
    error.code = 'INVALID_MESSAGE'
    throw error
  }

  const priorMessages = sanitizeHistory(history)
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...priorMessages,
    { role: 'user', content: question },
  ]

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL
  const maxTokens = Number(process.env.OPENAI_MAX_TOKENS || 1024)

  const response = await postJson(
    'https://api.openai.com/v1/chat/completions',
    {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    {
      model,
      messages,
      max_tokens: Number.isFinite(maxTokens) ? maxTokens : 1024,
    },
  )

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const error = new Error(`OpenAI API error (${response.status})`)
    error.code = 'AI_UPSTREAM_ERROR'
    error.status = response.status
    error.detail = detail.slice(0, 500)
    throw error
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) {
    const error = new Error('Empty response from OpenAI.')
    error.code = 'AI_EMPTY_RESPONSE'
    throw error
  }

  return text
}
