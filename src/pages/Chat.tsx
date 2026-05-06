import { useState, useEffect, useRef } from 'react'
import { db } from '@/db/schema'
import { chat } from '@/lib/anthropic'

const SYSTEM = `너는 사용자의 사적인 일기 에이전트야.
사용자가 중요한 사람들에 대해 적은 내용을 기억하고, 조언이 필요할 때 그 사람의 맥락을 고려해서 답해.
일반론은 금지. 그 사람 specific한 조언만 해. 정보가 부족하면 솔직히 모른다고 답해.

응답은 한국어로, 친근한 반말로. 길게 늘어놓지 말고 핵심만 간결하게.`

interface UIMessage {
  role: 'user' | 'assistant'
  content: string
}

export function Chat() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    db.messages.orderBy('createdAt').toArray().then((msgs) => {
      setMessages(msgs.map((m) => ({ role: m.role, content: m.content })))
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const userMsg = input.trim()
    if (!userMsg || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      await db.messages.add({
        role: 'user',
        content: userMsg,
        createdAt: Date.now(),
      })
      const reply = await chat(userMsg, SYSTEM)
      await db.messages.add({
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
      })
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      setMessages((m) => [...m, { role: 'assistant', content: `❌ ${msg}` }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col h-[calc(100vh-56px)]">
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-[var(--color-ink-soft)] text-center mt-12 italic font-display text-lg">
            오늘 무슨 일 있었어?
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                  : 'bg-white border border-[var(--color-line)]'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[var(--color-line)] rounded-2xl px-4 py-2.5 text-[var(--color-ink-soft)]">
              <span className="inline-block animate-pulse">···</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 py-3 border-t border-[var(--color-line)]">
        <textarea
          className="flex-1 border border-[var(--color-line)] bg-white rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[var(--color-ink)]"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="메시지를 입력하세요..."
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-[var(--color-ink)] text-[var(--color-paper)] px-5 rounded-lg disabled:opacity-30"
        >
          전송
        </button>
      </div>
    </div>
  )
}
