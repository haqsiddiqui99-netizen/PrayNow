import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  askIslamicQuestion,
  createMessage,
  SUGGESTED_QUESTIONS,
  type ChatMessage,
} from '../services/islamicChat'
import './IslamicChatPage.css'

const WELCOME_MESSAGE = createMessage(
  'assistant',
  'As-salamu alaykum! I\'m your Islamic guidance assistant. Ask me about prayers, fasting, Quran, Hadith, Halal/Haram, or any aspect of Islamic life.',
)

export function IslamicChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendQuestion = async (text: string) => {
    const question = text.trim()
    if (!question || isTyping) return

    setInput('')
    setMessages((prev) => [...prev, createMessage('user', question)])
    setIsTyping(true)

    const history = messages.slice(1).map(({ role, content }) => ({ role, content }))

    try {
      const answer = await askIslamicQuestion(question, history)
      setMessages((prev) => [...prev, createMessage('assistant', answer)])
    } finally {
      setIsTyping(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void sendQuestion(input)
  }

  return (
    <div className="islamic-chat-page">
      <header className="chat-header">
        <div className="chat-header-icon">🤖</div>
        <div>
          <h2>Islamic AI Guide</h2>
          <p>Powered by OpenAI · Ask about Islam</p>
        </div>
      </header>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble chat-bubble--${msg.role}`}>
            {msg.role === 'assistant' && <span className="chat-avatar">🕌</span>}
            <div className="chat-bubble-content">{msg.content}</div>
          </div>
        ))}

        {isTyping && (
          <div className="chat-bubble chat-bubble--assistant">
            <span className="chat-avatar">🕌</span>
            <div className="chat-bubble-content chat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {messages.length === 1 && !isTyping && (
          <div className="chat-suggestions">
            <div className="chat-suggestions-label">Try asking:</div>
            <div className="chat-suggestion-chips">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="chat-suggestion-chip"
                  onClick={() => void sendQuestion(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Ask about Islam..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isTyping}
          autoComplete="off"
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!input.trim() || isTyping}
          aria-label="Send message"
        >
          ➤
        </button>
      </form>
    </div>
  )
}
