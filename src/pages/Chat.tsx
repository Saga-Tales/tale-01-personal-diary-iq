import { useState, useEffect, useRef } from 'react'
import { db } from '@/db/schema'
import { chat } from '@/lib/anthropic'
import { buildSystemPrompt } from '@/lib/context'
import { extractFromMessage } from '@/lib/extractor'
import { preload, setProgressCallback, isEmbedderReady } from '@/lib/embedder'
import { saveEpisode } from '@/lib/retriever'

interface UIMessage {
  role: 'user' | 'assistant'
  content: string
}

export function Chat() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [embedderProgress, setEmbedderProgress] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    db.messages.orderBy('createdAt').toArray().then((msgs) => {
      setMessages(msgs.map((m) => ({ role: m.role, content: m.content })))
    })
  }, [])

  // 임베딩 모델 백그라운드 preload
  useEffect(() => {
    if (isEmbedderReady()) return
    setProgressCallback((progress) => {
      setEmbedderProgress(Math.round(progress))
      if (progress >= 100) {
        setTimeout(() => setEmbedderProgress(null), 1500)
      }
    })
    preload().catch((e) => {
      console.error('[chat] embedder preload 실패:', e)
      setEmbedderProgress(null)
    })
    return () => setProgressCallback(null)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

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
      const system = await buildSystemPrompt(userMsg)
      const reply = await chat(userMsg, system)
      await db.messages.add({
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
      })
      setMessages((m) => [...m, { role: 'assistant', content: reply }])

      // 백그라운드 작업들 (응답 표시 후 비동기)
      saveEpisode(userMsg, reply).catch((e) =>
        console.warn('[chat] episode 저장 실패:', e),
      )

      extractFromMessage(userMsg)
        .then((res) => {
          const total = res.inserted + res.updated
          if (total > 0) {
            const parts: string[] = []
            if (res.inserted > 0) parts.push(`${res.inserted}개 추가`)
            if (res.updated > 0) parts.push(`${res.updated}개 갱신`)
            setToast(`🔖 ${parts.join(', ')}됨`)
          }
        })
        .catch((e) => console.warn('[extractor] 실패:', e))
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
      {toast && (
        <div className="fixed top-16 right-4 bg-[var(--color-ink)] text-[var(--color-paper)] px-4 py-2 rounded-lg text-sm shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}
      {embedderProgress !== null && embedderProgress < 100 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-white border border-[var(--color-line)] px-4 py-2 rounded-lg text-xs shadow-lg z-50 flex items-center gap-3">
          <div className="w-32 h-1 bg-[var(--color-line)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-ink)] transition-all"
              style={{ width: `${embedderProgress}%` }}
            />
          </div>
          <span className="text-[var(--color-ink-soft)]">
            기억 모델 로딩 {embedderProgress}%
          </span>
        </div>
      )}
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
