import { type DigestOutput, type DigestProgress } from '@/lib/summarizer'

export function ProgressDisplay({ progress }: { progress: DigestProgress }) {
  const elapsed = (progress.elapsedMs / 1000).toFixed(1)
  const pct = Math.min((progress.receivedChars / 800) * 100, 99)

  return (
    <section
      className="card-ruled p-6 space-y-5"
    >
      <div className="flex items-center gap-3">
        <Spinner />
        <div>
          <div className="text-sm font-medium text-[var(--color-ink-warm)]">
            {progress.phase === 'connecting' && 'Claude API 연결 중...'}
            {progress.phase === 'streaming' && '분석 중...'}
            {progress.phase === 'parsing' && '결과 정리 중...'}
          </div>
          <div className="text-xs text-[var(--color-ink-soft)] tabular-nums mt-0.5">
            {elapsed}초 경과
            {progress.phase === 'streaming' &&
              ` · ${progress.receivedChars.toLocaleString()}자 받음`}
          </div>
        </div>
      </div>

      {progress.phase === 'streaming' && (
        <div className="relative w-full h-1 bg-[var(--color-line)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-gold)] via-[var(--color-accent)] to-[var(--color-ink-warm)] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
          <div className="absolute inset-0 shimmer pointer-events-none" />
        </div>
      )}

      {progress.topicsFound.length > 0 && (
        <div className="space-y-2">
          <div className="eyebrow">발견된 화제</div>
          <ul className="space-y-1.5">
            {progress.topicsFound.map((title, i) => (
              <li
                key={i}
                className="text-sm flex items-start gap-2 slide-in-soft"
              >
                <span className="text-[var(--color-gold)] font-display leading-none mt-1">✦</span>
                <span className="text-[var(--color-ink-warm)]">{title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {progress.phase === 'streaming' &&
        progress.topicsFound.length === 0 &&
        progress.elapsedMs > 3000 && (
          <p className="text-xs text-[var(--color-ink-soft)] italic font-display">
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
    <div className="space-y-5 ink-in">
      {/* 분위기 — 책 첫 페이지 풍 */}
      {result.overallTone && (
        <section
          className="border border-[var(--color-line)] rounded-xl p-6 relative overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, var(--color-paper-warm), var(--color-paper))',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          {/* 좌상단/우하단 골드 코너 장식 */}
          <span aria-hidden className="absolute top-2 left-2 text-[var(--color-gold)]/40 text-xs">✦</span>
          <span aria-hidden className="absolute bottom-2 right-2 text-[var(--color-gold)]/40 text-xs">✦</span>

          <div className="eyebrow text-center mb-3">분위기</div>
          <p className="font-display italic text-xl leading-relaxed text-center text-[var(--color-ink-warm)]">
            {result.overallTone}
          </p>
        </section>
      )}

      {!hasContent && (
        <section
          className="card p-5"
        >
          <p className="text-sm text-[var(--color-ink-soft)] text-center py-4 italic font-display">
            의미 있는 화제를 찾지 못했어요. 더 긴 대화로 시도해보세요.
          </p>
        </section>
      )}

      {result.topics.length > 0 && (
        <ResultCard icon="✦" title="주요 화제">
          <ul className="space-y-4">
            {result.topics.map((t, i) => (
              <li key={i} className="relative pl-4">
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"
                />
                <h3 className="font-medium text-base mb-1 text-[var(--color-ink-warm)]">
                  {t.title}
                </h3>
                <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  {t.description}
                </p>
              </li>
            ))}
          </ul>
        </ResultCard>
      )}

      {result.decisions.length > 0 && (
        <ResultCard icon="✓" title="결정 사항">
          <ul className="space-y-2 text-sm">
            {result.decisions.map((d, i) => (
              <li key={i} className="leading-relaxed flex items-start gap-2">
                <span className="text-[var(--color-gold)] mt-1 leading-none">•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </ResultCard>
      )}

      {result.actionItems.length > 0 && (
        <ResultCard icon="→" title="해야 할 일">
          <ul className="space-y-2 text-sm">
            {result.actionItems.map((a, i) => (
              <li key={i} className="leading-relaxed flex items-start gap-2">
                <span className="text-[var(--color-accent)] mt-0.5 font-medium">→</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </ResultCard>
      )}

      {result.notableQuotes.length > 0 && (
        <ResultCard icon="❝" title="인상적인 발언">
          <div className="space-y-5">
            {result.notableQuotes.map((q, i) => (
              <blockquote
                key={i}
                className="relative pl-6 pr-2"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-0 font-display text-3xl italic text-[var(--color-gold)] leading-none"
                >
                  &ldquo;
                </span>
                <p className="font-display italic text-base sm:text-lg leading-relaxed text-[var(--color-ink-warm)]">
                  {q.quote}
                </p>
                <footer className="text-xs text-[var(--color-ink-soft)] mt-2 font-body tracking-wide flex items-center gap-2">
                  <span className="h-px w-6 bg-[var(--color-gold)]/60" />
                  <span>{q.speaker}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </ResultCard>
      )}

      {result.participantBreakdown &&
        Object.keys(result.participantBreakdown).length > 0 && (
          <ResultCard icon="✦" title="참여자별 핵심">
            <div className="space-y-4">
              {Object.entries(result.participantBreakdown).map(([name, summary]) => (
                <div key={name} className="border-l-2 border-[var(--color-line)] pl-3">
                  <div className="font-medium text-sm mb-1 text-[var(--color-ink-warm)] flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[var(--color-gold)]" />
                    {name}
                  </div>
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
    <section className="card-ruled p-5 sm:p-6">
      <header className="flex items-baseline gap-2 mb-4 pb-3 border-b border-dashed border-[var(--color-line)]">
        <span className="text-[var(--color-gold)] text-base leading-none select-none">
          {icon}
        </span>
        <h2 className="font-display italic text-lg text-[var(--color-ink-warm)]">{title}</h2>
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
        className="absolute inset-0 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin"
        style={{ animationDuration: '0.8s' }}
      />
    </div>
  )
}
