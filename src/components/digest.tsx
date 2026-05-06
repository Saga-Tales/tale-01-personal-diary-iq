import { type DigestOutput, type DigestProgress } from '@/lib/summarizer'

export function ProgressDisplay({ progress }: { progress: DigestProgress }) {
  const elapsed = (progress.elapsedMs / 1000).toFixed(1)
  // 예상 토큰 = 800자 정도 (응답 평균). 그 이상이면 100%로 cap
  const pct = Math.min((progress.receivedChars / 800) * 100, 99)

  return (
    <section className="border border-[var(--color-line)] bg-white rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-3">
        <Spinner />
        <div>
          <div className="text-sm font-medium">
            {progress.phase === 'connecting' && 'Claude API 연결 중...'}
            {progress.phase === 'streaming' && '분석 중...'}
            {progress.phase === 'parsing' && '결과 정리 중...'}
          </div>
          <div className="text-xs text-[var(--color-ink-soft)] tabular-nums">
            {elapsed}초 경과
            {progress.phase === 'streaming' &&
              ` · ${progress.receivedChars.toLocaleString()}자 받음`}
          </div>
        </div>
      </div>

      {/* 진행 바 (streaming 중에만) */}
      {progress.phase === 'streaming' && (
        <div className="w-full h-1 bg-[var(--color-line)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-ink)] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* 발견된 화제 (실시간 추출) */}
      {progress.topicsFound.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
            발견된 화제
          </div>
          <ul className="space-y-1.5">
            {progress.topicsFound.map((title, i) => (
              <li
                key={i}
                className="text-sm flex items-start gap-2 animate-in fade-in slide-in-from-left-1"
              >
                <span className="text-[var(--color-ink)] font-medium">✓</span>
                <span>{title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {progress.phase === 'streaming' &&
        progress.topicsFound.length === 0 &&
        progress.elapsedMs > 3000 && (
          <p className="text-xs text-[var(--color-ink-soft)] italic">
            첫 결과가 나오기까지 잠시만 기다려주세요...
          </p>
        )}
    </section>
  )
}

export function DigestResult({
  result,
  onReset,
  resetLabel,
}: {
  result: DigestOutput
  onReset?: () => void
  resetLabel?: string
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

      {onReset && (
        <button onClick={onReset} className="btn-secondary w-full">
          {resetLabel ?? '새로 요약'}
        </button>
      )}
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

function Spinner() {
  return (
    <div className="relative w-5 h-5">
      <div className="absolute inset-0 border-2 border-[var(--color-line)] rounded-full" />
      <div
        className="absolute inset-0 border-2 border-[var(--color-ink)] border-t-transparent rounded-full animate-spin"
        style={{ animationDuration: '0.8s' }}
      />
    </div>
  )
}
