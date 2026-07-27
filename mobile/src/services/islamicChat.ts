export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export type ChatHistoryItem = Pick<ChatMessage, 'role' | 'content'>

interface KnowledgeEntry {
  keywords: string[]
  answer: string
}

const ISLAMIC_KNOWLEDGE: KnowledgeEntry[] = [
  {
    keywords: ['five pillar', '5 pillar', 'pillars of islam', 'arkan'],
    answer:
      'The five pillars of Islam are: (1) Shahada — declaration of faith, (2) Salah — five daily prayers, (3) Zakat — obligatory charity, (4) Sawm — fasting in Ramadan, and (5) Hajj — pilgrimage to Makkah for those who are able. These form the foundation of a Muslim\'s faith and practice.',
  },
  {
    keywords: ['wudu', 'wudhu', 'ablution'],
    answer:
      'Wudu is the ritual ablution performed before prayer. It includes washing the hands, rinsing the mouth and nose, washing the face, arms up to the elbows, wiping the head, and washing the feet up to the ankles. It purifies you spiritually and is required before Salah unless you have valid tayammum (dry ablution).',
  },
  {
    keywords: ['zawal', 'zohr', 'dhuhr', 'juma', 'jummah', 'friday prayer'],
    answer:
      'Zawal is the period when the sun is at its zenith — prayer is prohibited during this time. Dhuhr (Zohr) prayer begins only after Zawal ends. On Fridays, Dhuhr is replaced by Jumu\'ah (Juma) congregational prayer, which is obligatory for adult Muslim men who are able to attend.',
  },
  {
    keywords: ['fajr', 'tahajjud', 'sehri', 'suhoor', 'suhur'],
    answer:
      'Fajr is the dawn prayer, performed from true dawn until sunrise. Tahajjud is a voluntary night prayer, ideally in the last third of the night after waking from sleep. Sehri (Suhoor) is the pre-dawn meal eaten before fasting begins in Ramadan — the Prophet ﷺ encouraged having it.',
  },
  {
    keywords: ['ramadan', 'fasting', 'roza', 'iftar'],
    answer:
      'Ramadan is the ninth month of the Islamic calendar when Muslims fast from dawn (Fajr) until sunset (Maghrib). Fasting includes abstaining from food, drink, and marital relations. Iftar is the meal to break the fast at Maghrib. Fasting develops taqwa (God-consciousness) and empathy for the needy.',
  },
  {
    keywords: ['qibla', 'kaaba', 'direction of prayer'],
    answer:
      'Qibla is the direction Muslims face during prayer — toward the Kaaba in Makkah. From Delhi, India, the Qibla is approximately northeast (~58°). You can use the Qibla finder in More → Qibla Direction in this app.',
  },
  {
    keywords: ['zakat', 'charity', 'sadaqah', 'sadaqa'],
    answer:
      'Zakat is an obligatory annual charity of 2.5% on qualifying wealth held for one lunar year. Sadaqah is voluntary charity encouraged at all times. Both purify wealth and support those in need — the poor, orphans, and travellers among the eight categories mentioned in the Quran (9:60).',
  },
  {
    keywords: ['halal', 'haram', 'permissible', 'forbidden food'],
    answer:
      'Halal means permissible in Islam. Haram means forbidden. Pork, alcohol, and improperly slaughtered meat are haram. Halal food must be prepared according to Islamic guidelines. When in doubt, look for halal certification or ask about ingredients and preparation.',
  },
  {
    keywords: ['shahada', 'kalima', 'declaration of faith', 'convert', 'revert'],
    answer:
      'The Shahada is: "Ash-hadu an la ilaha illallah, wa ash-hadu anna Muhammadur Rasulullah" — I bear witness there is no god but Allah, and Muhammad is His Messenger. Declaring this with sincere belief is what makes one a Muslim. Seek guidance from a local imam for proper pronunciation and next steps.',
  },
  {
    keywords: ['quran', 'qur\'an', 'koran', 'holy book'],
    answer:
      'The Quran is the final revelation from Allah to Prophet Muhammad ﷺ, revealed over 23 years. It is preserved in Arabic and is the primary source of Islamic guidance alongside the Sunnah (Prophet\'s teachings). Muslims recite it in prayer and study it for guidance in all aspects of life.',
  },
  {
    keywords: ['hadith', 'sunnah', 'prophet muhammad'],
    answer:
      'Hadith are recorded sayings, actions, and approvals of Prophet Muhammad ﷺ. Together with the Quran, they form the Sunnah — the practical model for Muslim life. Authentic collections include Sahih Bukhari and Sahih Muslim. Check the Hadith tab in this app for daily inspiration.',
  },
  {
    keywords: ['salah', 'namaz', 'prayer', 'how many prayer'],
    answer:
      'Salah (Namaz) is the five daily obligatory prayers: Fajr (dawn), Dhuhr (midday), Asr (afternoon), Maghrib (sunset), and Isha (night). Each has specific times based on the sun\'s position. Congregational prayer in the mosque is especially encouraged for men.',
  },
  {
    keywords: ['tayammum', 'dry ablution'],
    answer:
      'Tayammum is dry ablution using clean earth when water is unavailable or harmful to use. Strike hands on clean soil, wipe the face, then wipe hands up to the wrists. It allows you to pray when water cannot be used for wudu.',
  },
  {
    keywords: ['eid', 'eid ul fitr', 'eid al adha', 'bakrid'],
    answer:
      'Eid al-Fitr marks the end of Ramadan with celebration and special prayer. Eid al-Adha (Bakrid) commemorates Prophet Ibrahim\'s willingness to sacrifice and falls during Hajj season. Both involve communal prayer, charity (Zakat al-Fitr before Eid al-Fitr), and sharing meals with family and community.',
  },
  {
    keywords: ['hajj', 'umrah', 'pilgrimage', 'makkah', 'mecca'],
    answer:
      'Hajj is the once-in-a-lifetime pilgrimage to Makkah, obligatory for Muslims who are physically and financially able. It occurs in Dhul Hijjah. Umrah is a voluntary lesser pilgrimage that can be performed any time. Both involve ihram, Tawaf (circumambulating the Kaaba), and deep spiritual reflection.',
  },
  {
    keywords: ['assalam', 'salam', 'greeting', 'peace be upon'],
    answer:
      'The Islamic greeting is "As-salamu alaykum" (Peace be upon you), replied with "Wa alaykum as-salam" (And upon you peace). It is a dua (supplication) of peace and a Sunnah when meeting Muslims.',
  },
]

const FALLBACK_RESPONSE =
  'Thank you for your question. I can help with topics like the five pillars, daily prayers (Salah), Ramadan fasting, Zakat, Hajj, Wudu, Halal/Haram, Quran, Hadith, and more. Please ask a specific question about Islamic practice or belief, and I\'ll do my best to guide you. For personal religious rulings (fatwa), consult a qualified local scholar.'

const OFF_TOPIC_RESPONSE =
  'I\'m an Islamic guidance assistant focused on questions about Islam — faith, worship, Quran, Hadith, and daily practice. Please ask me something related to Islamic knowledge, and I\'ll be happy to help.'

const NON_ISLAMIC_HINTS = [
  'weather',
  'stock',
  'crypto',
  'recipe',
  'movie',
  'football',
  'cricket score',
  'python code',
  'javascript',
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ').trim()
}

function scoreMatch(query: string, keywords: string[]): number {
  let score = 0
  for (const keyword of keywords) {
    if (query.includes(keyword)) {
      score += keyword.split(' ').length >= 2 ? 3 : 1
    }
  }
  return score
}

export function getIslamicChatResponse(question: string): string {
  const query = normalize(question)
  if (!query) {
    return 'Please type your question about Islam and I will try to help.'
  }

  if (NON_ISLAMIC_HINTS.some((hint) => query.includes(hint))) {
    return OFF_TOPIC_RESPONSE
  }

  let best: KnowledgeEntry | null = null
  let bestScore = 0

  for (const entry of ISLAMIC_KNOWLEDGE) {
    const score = scoreMatch(query, entry.keywords.map(normalize))
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }

  if (best && bestScore > 0) return best.answer
  return FALLBACK_RESPONSE
}

export const SUGGESTED_QUESTIONS = [
  'What are the five pillars of Islam?',
  'When can I pray Dhuhr after Zawal?',
  'What is Wudu and how is it done?',
  'What is the difference between Zakat and Sadaqah?',
]

export function createMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
    timestamp: new Date(),
  }
}

export async function askIslamicQuestion(
  question: string,
  history: ChatHistoryItem[] = [],
): Promise<string> {
  try {
    return await askAiViaApi(question, history)
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 400))
    return getIslamicChatResponse(question)
  }
}

async function askAiViaApi(question: string, history: ChatHistoryItem[]): Promise<string> {
  const { getApiBaseUrl } = await import('@/src/config/api')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, history }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = (await res.json().catch(() => ({ error: 'Chat request failed' }))) as { error?: string }
      throw new Error(err.error || `Chat request failed (${res.status})`)
    }

    const data = (await res.json()) as { answer?: string }
    if (!data.answer?.trim()) throw new Error('Empty AI response')
    return data.answer.trim()
  } finally {
    clearTimeout(timer)
  }
}
