import { useState, useEffect, useRef } from 'react'
import { db } from '@/db/schema'
import { callStreaming } from '@/lib/anthropic'
import { buildSystemPrompt } from '@/lib/context'
import { extractFromMessage } from '@/lib/extractor'
import { preload, setProgressCallback, isEmbedderReady } from '@/lib/embedder'
import { saveEpisode, formatEpisodeContent } from '@/lib/retriever'

interface UIMessage {
  id?: number
  role: 'user' | 'assistant'
  content: string
  createdAt?: number
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
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      )
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
      const userCreatedAt = Date.now()
      const userId = await db.messages.add({
        role: 'user',
        content: userMsg,
        createdAt: userCreatedAt,
      })
      // user placeholder에 id 반영 — 삭제 가능하도록
      setMessages((m) => {
        const updated = [...m]
        updated[updated.length - 2] = { id: userId, role: 'user', content: userMsg, createdAt: userCreatedAt }
        return updated
      })

      const system = await buildSystemPrompt(userMsg)

      // streaming — 매 chunk마다 마지막 메시지 (assistant placeholder) 갱신
      let reply = ''
      await callStreaming(system, userMsg, 1024, (accumulated) => {
        reply = accumulated
        setMessages((m) => {
          const updated = [...m]
          updated[updated.length - 1] = { ...updated[updated.length - 1], role: 'assistant', content: accumulated }
          return updated
        })
      })

      // 스트림 종료 후 DB 저장 (token마다 쓰지 않음)
      const assistantCreatedAt = Date.now()
      const assistantId = await db.messages.add({
        role: 'assistant',
        content: reply,
        createdAt: assistantCreatedAt,
      })
      setMessages((m) => {
        const updated = [...m]
        updated[updated.length - 1] = { id: assistantId, role: 'assistant', content: reply, createdAt: assistantCreatedAt }
        return updated
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

  // turn 삭제 — 클릭한 메시지의 user+assistant 짝과 매칭되는 episode(임베딩 포함)까지 같이 정리.
  // turn = 인접한 user/assistant 한 쌍. 사용자가 어느 쪽에 있는 ✕ 누르든 짝 전체 사라짐.
  async function deleteTurn(index: number) {
    const m = messages[index]
    if (!m?.id) return // streaming 중인 메시지는 아직 id가 없음 — 삭제 비활성

    // 짝 찾기 — 클릭된 게 user면 다음 assistant, assistant면 이전 user
    let userIdx = -1
    let asstIdx = -1
    if (m.role === 'user') {
      userIdx = index
      asstIdx = messages[index + 1]?.role === 'assistant' ? index + 1 : -1
    } else {
      asstIdx = index
      userIdx = messages[index - 1]?.role === 'user' ? index - 1 : -1
    }

    const userMsg = userIdx >= 0 ? messages[userIdx] : null
    const asstMsg = asstIdx >= 0 ? messages[asstIdx] : null

    // 둘 다 있을 때만 episode 매칭 시도. 한쪽만 있으면 message만 지움.
    const willDeleteEpisode = userMsg && asstMsg
    const confirmMsg = willDeleteEpisode
      ? '이 대화 turn을 영구 삭제할까요?\n\n⚠️ 메시지 + 임베딩(일화)이 함께 사라져서 이 대화는 회상되지 않아요.\n추출된 fact는 영향 없음.'
      : '이 메시지를 영구 삭제할까요?'
    if (!confirm(confirmMsg)) return

    // messages 테이블 삭제
    const idsToDelete = [userMsg?.id, asstMsg?.id].filter((x): x is number => typeof x === 'number')
    if (idsToDelete.length > 0) {
      await db.messages.bulkDelete(idsToDelete)
    }

    // episode 삭제 — content 정확히 매칭. 같은 사용자/응답 조합이 다른 시점에 또 있을 수 있어
    // (드물지만 가능) createdAt 윈도우로 추가 좁힘. assistantCreatedAt ± 30s.
    if (willDeleteEpisode && userMsg && asstMsg) {
      const expectedContent = formatEpisodeContent(userMsg.content, asstMsg.content)
      const windowMs = 30_000
      const startAt = (asstMsg.createdAt ?? 0) - windowMs
      const endAt = (asstMsg.createdAt ?? 0) + windowMs
      const candidates = await db.episodes
        .where('createdAt')
        .between(startAt, endAt, true, true)
        .toArray()
      const matchIds = candidates
        .filter((e) => e.content === expectedContent)
        .map((e) => e.id!)
        .filter((x) => typeof x === 'number')
      if (matchIds.length > 0) {
        await db.episodes.bulkDelete(matchIds)
      }
    }

    // UI 갱신 — 삭제된 인덱스 제거
    const removeIndices = new Set([userIdx, asstIdx].filter((x) => x >= 0))
    setMessages((current) => current.filter((_, i) => !removeIndices.has(i)))
    setToast(willDeleteEpisode ? '🗑️ turn 삭제됨 (일화도 정리)' : '🗑️ 메시지 삭제됨')
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
          const canDelete = !!m.id && !isStreaming && !loading
          return (
            <div
              key={m.id ?? `tmp-${i}`}
              className={`group flex items-start gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'} ink-in`}
            >
              {/* assistant 쪽 삭제 버튼 (왼쪽 - assistant 버블 왼쪽에 위치) */}
              {m.role === 'assistant' && canDelete && (
                <button
                  onClick={() => deleteTurn(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] text-xs mt-2.5 px-1"
                  aria-label="이 turn 삭제"
                  title="이 turn 삭제 (메시지 + 일화 동기)"
                >
                  ✕
                </button>
              )}
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
              {/* user 쪽 삭제 버튼 (오른쪽 - user 버블 오른쪽에 위치) */}
              {m.role === 'user' && canDelete && (
                <button
                  onClick={() => deleteTurn(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] text-xs mt-2.5 px-1"
                  aria-label="이 turn 삭제"
                  title="이 turn 삭제 (메시지 + 일화 동기)"
                >
                  ✕
                </button>
              )}
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
