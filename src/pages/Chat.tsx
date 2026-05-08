import { useState, useEffect, useRef } from 'react'
import { db } from '@/db/schema'
import { callStreaming } from '@/lib/anthropic'
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

  // 자동 스크롤 — streaming 중엔 instant, 새 메시지엔 smooth
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: loading ? 'auto' : 'smooth',
      block: 'end',
    })
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

    // user 메시지 + 비어있는 assistant placeholder를 atomic 하게 추가
    setMessages((m) => [
      ...m,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: '' },
    ])
    setLoading(true)

    try {
      await db.messages.add({
        role: 'user',
        content: userMsg,
        createdAt: Date.now(),
      })
      const system = await buildSystemPrompt(userMsg)

      // streaming — 매 chunk마다 마지막 메시지 (assistant placeholder) 갱신
      let reply = ''
      await callStreaming(system, userMsg, 1024, (accumulated) => {
        reply = accumulated
        setMessages((m) => {
          const updated = [...m]
          updated[updated.length - 1] = { role: 'assistant', content: accumulated }
          return updated
        })
      })

      // 스트림 종료 후 DB 저장 (token마다 쓰지 않음)
      await db.messages.add({
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
      })

      // 백그라운드 작업들
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
      // 비어있는 assistant placeholder를 에러 메시지로 교체
      setMessages((m) => {
        const updated = [...m]
        updated[updated.length - 1] = { role: 'assistant', content: `❌ ${msg}` }
        return updated
      })
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 flex flex-col h-[calc(100vh-56px)]">
      {toast && (
        <div className="fixed top-16 right-4 bg-[var(--color-ink-warm)] text-[var(--color-paper)] px-4 py-2 rounded-lg text-sm z-50 animate-in fade-in slide-in-from-top-2"
             style={{ boxShadow: 'var(--shadow-lift)' }}>
          {toast}
        </div>
      )}
      {embedderProgress !== null && embedderProgress < 100 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 bg-[var(--color-surface)]/90 backdrop-blur border border-[var(--color-line)] px-4 py-2 rounded-lg text-xs z-50 flex items-center gap-3"
             style={{ boxShadow: 'var(--shadow-lift)' }}>
          <div className="w-32 h-1 bg-[var(--color-line)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-gold)] to-[var(--color-ink-warm)] transition-all"
              style={{ width: `${embedderProgress}%` }}
            />
          </div>
          <span className="text-[var(--color-ink-soft)] tabular-nums">
            기억 모델 로딩 {embedderProgress}%
          </span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-8 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-16 ink-in">
            <div className="divider-ornate max-w-[200px] mx-auto mb-4">
              <span className="select-none">✦</span>
            </div>
            <p className="text-[var(--color-ink-warm)] italic font-display text-2xl leading-snug">
              오늘 무슨 일 있었어?
            </p>
            <p className="text-xs text-[var(--color-ink-soft)] mt-3 tracking-wide">
              느낀 점, 만난 사람, 사소한 변화 무엇이든
            </p>
          </div>
        )}
        {messages.map((m, i) => {
          const isLast = i === messages.length - 1
          const isStreaming = loading && isLast && m.role === 'assistant'
          const showDots = isStreaming && !m.content
          return (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} ink-in`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'text-[var(--color-paper)] rounded-br-md'
                    : 'bg-[var(--color-surface)] border border-[var(--color-line)] rounded-bl-md text-[var(--color-ink-warm)]'
                }`}
                style={
                  m.role === 'user'
                    ? {
                        background: 'linear-gradient(180deg, var(--color-ink-warm), var(--color-ink))',
                        boxShadow: 'var(--shadow-lift)',
                      }
                    : { boxShadow: 'var(--shadow-soft)' }
                }
              >
                {showDots ? (
                  <span className="text-[var(--color-ink-soft)] inline-block animate-pulse tracking-widest">
                    ···
                  </span>
                ) : (
                  <>
                    {m.content}
                    {isStreaming && (
                      <span className="inline-block w-[3px] h-4 bg-[var(--color-gold)] align-text-bottom animate-pulse ml-1 rounded-sm" />
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 py-3 border-t border-[var(--color-line)]">
        <textarea
          className="flex-1 border border-[var(--color-line)] bg-white rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:border-[var(--color-ink-warm)] focus:ring-2 focus:ring-[var(--color-gold)]/20 transition-shadow"
          style={{ boxShadow: 'var(--shadow-press)' }}
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
          className="btn-primary px-5"
        >
          전송
        </button>
      </div>
    </div>
  )
}
