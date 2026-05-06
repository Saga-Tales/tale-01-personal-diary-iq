import { useState, useEffect } from 'react'
import { db, type Person } from '@/db/schema'
import { summarizeChat, type DigestOutput } from '@/lib/summarizer'
import { readKakaoFile } from '@/lib/kakao'
import { FileDropZone } from '@/components/FileDropZone'

type InputMode = 'paste' | 'file'

export function Digest() {
  const [mode, setMode] = useState<InputMode>('paste')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [focusPerson, setFocusPerson] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DigestOutput | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    db.people.toArray().then(setPeople)
  }, [])

  function reset() {
    setText('')
    setFile(null)
    setFocusPerson('')
    setResult(null)
    setError(null)
  }

  async function summarize() {
    setError(null)
    setResult(null)

    let chatText = ''
    if (mode === 'paste') {
      chatText = text.trim()
    } else if (file) {
      try {
        chatText = await readKakaoFile(file)
      } catch (e) {
        setError(e instanceof Error ? e.message : '파일 읽기 실패')
        return
      }
    }

    if (!chatText) {
      setError('대화 내용을 입력하거나 파일을 업로드하세요.')
      return
    }
    if (chatText.length < 50) {
      setError('대화가 너무 짧아요 (50자 이상 필요).')
      return
    }

    setLoading(true)
    try {
      const r = await summarizeChat(chatText, focusPerson || undefined)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : '요약 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 space-y-6">
      <header className="mb-2">
        <h1 className="text-3xl mb-1">다이제스트</h1>
        <p className="text-[var(--color-ink-soft)] italic text-sm">
          긴 대화에서 핵심만 뽑아내기.
        </p>
      </header>

      {!result ? (
        <InputCard
          mode={mode}
          setMode={setMode}
          text={text}
          setText={setText}
          file={file}
          setFile={setFile}
          people={people}
          focusPerson={focusPerson}
          setFocusPerson={setFocusPerson}
          loading={loading}
          error={error}
          onSubmit={summarize}
        />
      ) : (
        <DigestResult result={result} onReset={reset} />
      )}
    </div>
  )
}

function InputCard({
  mode,
  setMode,
  text,
  setText,
  file,
  setFile,
  people,
  focusPerson,
  setFocusPerson,
  loading,
  error,
  onSubmit,
}: {
  mode: InputMode
  setMode: (m: InputMode) => void
  text: string
  setText: (t: string) => void
  file: File | null
  setFile: (f: File | null) => void
  people: Person[]
  focusPerson: string
  setFocusPerson: (p: string) => void
  loading: boolean
  error: string | null
  onSubmit: () => void
}) {
  return (
    <section className="border border-[var(--color-line)] bg-white rounded-xl p-6 shadow-sm space-y-5">
      {/* 입력 모드 토글 */}
      <div className="flex border border-[var(--color-line)] rounded-lg p-1 text-sm">
        <button
          onClick={() => setMode('paste')}
          className={`flex-1 py-2 rounded transition-colors ${
            mode === 'paste'
              ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          텍스트 붙여넣기
        </button>
        <button
          onClick={() => setMode('file')}
          className={`flex-1 py-2 rounded transition-colors ${
            mode === 'file'
              ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          파일 업로드
        </button>
      </div>

      {/* 입력 영역 */}
      {mode === 'paste' ? (
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)] block mb-2">
            대화 내용
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="카카오톡 대화 내용을 여기에 붙여넣으세요..."
            rows={10}
            className="w-full border border-[var(--color-line)] bg-white rounded-lg p-3 text-sm font-mono leading-relaxed focus:outline-none focus:border-[var(--color-ink)] resize-y"
            disabled={loading}
          />
          <p className="text-xs text-[var(--color-ink-soft)] mt-1">
            {text.length.toLocaleString()}자
          </p>
        </div>
      ) : (
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)] block mb-2">
            파일
          </label>
          <FileDropZone
            accept=".txt,.eml"
            file={file}
            onFile={setFile}
            hint="대화 파일 (.txt 또는 .eml)"
            disabled={loading}
          />
        </div>
      )}

      {/* 포커스 사람 */}
      {people.length > 0 && (
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)] block mb-2">
            포커스 (선택)
          </label>
          <select
            value={focusPerson}
            onChange={(e) => setFocusPerson(e.target.value)}
            className="input"
            disabled={loading}
          >
            <option value="">전체 균형있게 요약</option>
            {people.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} 발언/관심사에 비중 두기
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 요약 버튼 */}
      <button
        onClick={onSubmit}
        disabled={loading || (mode === 'paste' ? !text.trim() : !file)}
        className="btn-primary w-full"
      >
        {loading ? '요약 중...' : '요약하기'}
      </button>

      {error && (
        <div className="text-xs px-3 py-2 rounded text-[var(--color-accent)] bg-[var(--color-paper)]">
          {error}
        </div>
      )}

      <p className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
        대화 내용은 Claude API로 일시 전송된 후 응답만 화면에 표시되고, 다른 곳에 저장되지 않아요.
      </p>
    </section>
  )
}

function DigestResult({
  result,
  onReset,
}: {
  result: DigestOutput
  onReset: () => void
}) {
  const hasContent =
    result.topics.length > 0 ||
    result.decisions.length > 0 ||
    result.actionItems.length > 0

  return (
    <div className="space-y-5">
      {/* 분위기 */}
      {result.overallTone && (
        <section className="border border-[var(--color-line)] bg-[var(--color-paper)] rounded-xl p-5">
          <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)] mb-2">
            분위기
          </div>
          <p className="font-display italic text-lg leading-relaxed">
            {result.overallTone}
          </p>
        </section>
      )}

      {!hasContent && (
        <section className="border border-[var(--color-line)] bg-white rounded-xl p-5">
          <p className="text-sm text-[var(--color-ink-soft)] text-center py-4 italic">
            의미 있는 화제를 찾지 못했어요. 더 긴 대화로 시도해보세요.
          </p>
        </section>
      )}

      {/* 주요 화제 */}
      {result.topics.length > 0 && (
        <ResultCard icon="📌" title="주요 화제">
          <ul className="space-y-3">
            {result.topics.map((t, i) => (
              <li key={i}>
                <h3 className="font-medium text-base mb-1">{t.title}</h3>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  {t.description}
                </p>
              </li>
            ))}
          </ul>
        </ResultCard>
      )}

      {/* 결정 사항 */}
      {result.decisions.length > 0 && (
        <ResultCard icon="✓" title="결정 사항">
          <ul className="space-y-1.5 text-sm">
            {result.decisions.map((d, i) => (
              <li key={i} className="leading-relaxed">
                {d}
              </li>
            ))}
          </ul>
        </ResultCard>
      )}

      {/* 해야 할 일 */}
      {result.actionItems.length > 0 && (
        <ResultCard icon="→" title="해야 할 일">
          <ul className="space-y-1.5 text-sm">
            {result.actionItems.map((a, i) => (
              <li key={i} className="leading-relaxed">
                {a}
              </li>
            ))}
          </ul>
        </ResultCard>
      )}

      {/* 인상적인 발언 */}
      {result.notableQuotes.length > 0 && (
        <ResultCard icon="💬" title="인상적인 발언">
          <div className="space-y-3">
            {result.notableQuotes.map((q, i) => (
              <blockquote
                key={i}
                className="border-l-2 border-[var(--color-line)] pl-3 italic font-display"
              >
                <p className="text-base leading-relaxed">"{q.quote}"</p>
                <footer className="text-xs not-italic text-[var(--color-ink-soft)] mt-1 font-body">
                  — {q.speaker}
                </footer>
              </blockquote>
            ))}
          </div>
        </ResultCard>
      )}

      {/* 참여자별 */}
      {result.participantBreakdown &&
        Object.keys(result.participantBreakdown).length > 0 && (
          <ResultCard icon="👥" title="참여자별 핵심">
            <div className="space-y-3">
              {Object.entries(result.participantBreakdown).map(([name, summary]) => (
                <div key={name}>
                  <div className="font-medium text-sm mb-1">{name}</div>
                  <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                    {summary}
                  </p>
                </div>
              ))}
            </div>
          </ResultCard>
        )}

      <button onClick={onReset} className="btn-secondary w-full">
        새로 요약
      </button>
    </div>
  )
}

function ResultCard({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-[var(--color-line)] bg-white rounded-xl p-5 shadow-sm">
      <header className="flex items-baseline gap-2 mb-4 pb-3 border-b border-[var(--color-line)]">
        <span className="text-lg leading-none">{icon}</span>
        <h2 className="font-display text-lg">{title}</h2>
      </header>
      {children}
    </section>
  )
}
