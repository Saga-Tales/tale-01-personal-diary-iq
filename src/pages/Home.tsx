import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { db } from '@/db/schema'
import { getUpcomingBirthdays, type UpcomingBirthday } from '@/lib/ical'
import {
  summarizeChat,
  type DigestOutput,
  type DigestProgress,
} from '@/lib/summarizer'
import { ProgressDisplay, DigestResult } from '@/components/digest'
import {
  computeRhythm,
  buildHeroGreeting,
  daysSinceBackup,
  type HeroGreeting,
} from '@/lib/diary-state'

interface Counts {
  people: number
  facts: number
  episodes: number
}

interface RecentFact {
  personName: string
  key: string
  value: string
  createdAt: number
}

export function Home() {
  const [counts, setCounts] = useState<Counts>({ people: 0, facts: 0, episodes: 0 })
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([])
  const [recentFacts, setRecentFacts] = useState<RecentFact[]>([])
  const [greeting, setGreeting] = useState<HeroGreeting | null>(null)
  const [backupDays, setBackupDays] = useState<number | null>(null)
  const [digestProgress, setDigestProgress] = useState<DigestProgress | null>(null)
  const [digestResult, setDigestResult] = useState<DigestOutput | null>(null)
  const [digestError, setDigestError] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [peopleCount, factCount, episodeCount, peopleAll, allFacts, ub, rhythm] =
      await Promise.all([
        db.people.count(),
        db.facts.count(),
        db.episodes.count(),
        db.people.toArray(),
        db.facts.toArray(),
        getUpcomingBirthdays(60),
        computeRhythm(),
      ])

    setCounts({ people: peopleCount, facts: factCount, episodes: episodeCount })
    setGreeting(buildHeroGreeting(rhythm))
    setBackupDays(daysSinceBackup())

    const peopleMap = new Map(peopleAll.map((p) => [p.id!, p.name]))
    const sorted = [...allFacts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
    setRecentFacts(
      sorted.map((f) => ({
        personName: peopleMap.get(f.personId) ?? '?',
        key: f.key,
        value: f.value,
        createdAt: f.createdAt,
      })),
    )

    setBirthdays(ub.slice(0, 5))
  }

  async function generateWeeklyDigest() {
    setDigestError(null)
    setDigestResult(null)

    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const episodes = await db.episodes.where('createdAt').above(cutoff).toArray()

    if (episodes.length === 0) {
      setDigestError('지난 7일간 기록된 대화가 없어요. 채팅을 먼저 해보세요.')
      return
    }

    const text = episodes.map((e) => e.content).join('\n\n---\n\n')

    if (text.length < 100) {
      setDigestError('요약하기엔 대화가 너무 짧아요.')
      return
    }

    try {
      const result = await summarizeChat(text, undefined, setDigestProgress)
      setDigestResult(result)
    } catch (e) {
      setDigestError(e instanceof Error ? e.message : '요약 실패')
    } finally {
      setDigestProgress(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 space-y-8">
      <Hero greeting={greeting} />

      {/* Counters — 활판 인쇄 동전 */}
      <div className="grid grid-cols-3 gap-3">
        <CounterCard label="사람" value={counts.people} />
        <CounterCard label="알게 된 것" value={counts.facts} />
        <CounterCard label="일화" value={counts.episodes} />
      </div>

      {/* 백업 알림 — 30일+ 안 했을 때만 부드럽게 */}
      {backupDays !== null && backupDays >= 30 && (
        <Link
          to="/data"
          className="block text-xs text-[var(--color-ink-soft)] text-center hover:text-[var(--color-gold)] transition-colors"
        >
          <span className="text-[var(--color-gold)]">✦</span>{' '}
          마지막 백업이 {backupDays}일 전이에요. 지금 한 번 받아두기 →
        </Link>
      )}

      <OrnateDivider />

      <Card title="다가오는 기념일" subtitle="앞으로 60일 이내" ornament="❀">
        {birthdays.length === 0 ? (
          <EmptyHint>등록된 생일이 없어요. 사람들 페이지에서 추가해보세요.</EmptyHint>
        ) : (
          <ul className="space-y-2.5">
            {birthdays.map((b) => (
              <li
                key={b.person.id}
                className="flex items-center justify-between text-sm group"
              >
                <span className="font-medium flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-[var(--color-gold)] opacity-60 group-hover:opacity-100 transition-opacity" />
                  {b.person.name}
                </span>
                <span className="text-[var(--color-ink-soft)] tabular-nums">
                  {b.daysUntil === 0
                    ? <span className="text-[var(--color-accent)] font-medium">오늘 ✦</span>
                    : b.daysUntil === 1
                      ? '내일'
                      : `${b.daysUntil}일 후`}
                  <span className="text-[var(--color-ink-soft)]/60 ml-2 text-xs">
                    {formatBirthday(b.person.birthday!)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="최근 알게 된 것들" subtitle="대화에서 자동 추출" ornament="✦">
        {recentFacts.length === 0 ? (
          <EmptyHint>
            아직 추출된 fact가 없어. 채팅하다보면 자동으로 모임.
          </EmptyHint>
        ) : (
          <ul className="space-y-2.5">
            {recentFacts.map((f, i) => (
              <li key={i} className="text-sm leading-relaxed">
                <span className="font-medium">{f.personName}</span>
                <span className="text-[var(--color-gold)] mx-2 select-none">·</span>
                <span className="text-[var(--color-ink-soft)] italic font-display">{f.key}</span>
                <span className="text-[var(--color-ink-soft)]/60 mx-1.5">=</span>
                <span>{f.value}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <header className="mb-3 flex items-baseline gap-2">
          <span className="text-[var(--color-gold)] text-sm leading-none">✦</span>
          <h2 className="font-display text-lg italic">이번 주 다이제스트</h2>
          <span className="eyebrow ml-auto">지난 7일</span>
        </header>

        {!digestProgress && !digestResult && (
          <button
            onClick={generateWeeklyDigest}
            className="btn-primary w-full"
          >
            요약 만들기
          </button>
        )}

        {digestProgress && <ProgressDisplay progress={digestProgress} />}

        {digestResult && (
          <DigestResult
            result={digestResult}
            onReset={() => setDigestResult(null)}
            resetLabel="닫기"
          />
        )}

        {digestError && (
          <p className="text-xs px-3 py-2 mt-2 rounded text-[var(--color-accent)] bg-[var(--color-paper-warm)] border border-[var(--color-line)]">
            {digestError}
          </p>
        )}
      </section>
    </div>
  )
}

function Hero({ greeting }: { greeting: HeroGreeting | null }) {
  // greeting 로딩 전 placeholder — 페이지 점프 방지용 height 유지
  if (!greeting) {
    return <header className="pb-2 min-h-[180px]" aria-hidden />
  }

  return (
    <header className="pb-2 ink-in">
      <div className="flex items-center gap-3 text-[var(--color-ink-soft)]">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-line)] to-[var(--color-line)]" />
        <p className="eyebrow flex items-center gap-1.5">
          {greeting.ornament && (
            <span className="text-[var(--color-gold)] text-[10px]">{greeting.ornament}</span>
          )}
          {greeting.eyebrow}
        </p>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[var(--color-line)] to-[var(--color-line)]" />
      </div>
      <h1 className="font-display italic text-4xl sm:text-5xl mt-4 leading-[1.05] text-center text-[var(--color-ink-warm)]">
        {greeting.prompt}
        <span className="text-[var(--color-accent)]">{greeting.highlight}</span>
      </h1>
      <div className="flex justify-center mt-5">
        <Link to="/chat" className="btn-primary inline-flex items-center gap-2 no-underline">
          <span>기록하기</span>
          <span className="text-[var(--color-gold-soft)]">→</span>
        </Link>
      </div>
    </header>
  )
}

function CounterCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="relative bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl px-4 py-5 text-center overflow-hidden group"
      style={{ boxShadow: 'var(--shadow-soft)' }}
    >
      {/* 좌측 골드 룰 라인 — 활판 마진 */}
      <span
        aria-hidden
        className="absolute top-3 bottom-3 left-0 w-px bg-[var(--color-gold)] opacity-50"
      />
      <div className="numeral text-3xl text-[var(--color-ink-warm)] leading-none">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)] mt-2.5">
        {label}
      </div>
    </div>
  )
}

function OrnateDivider() {
  return (
    <div className="divider-ornate text-base">
      <span className="select-none">✦</span>
    </div>
  )
}

function Card({
  title,
  subtitle,
  ornament,
  children,
}: {
  title: string
  subtitle?: string
  ornament?: string
  children: React.ReactNode
}) {
  return (
    <section
      className="card-ruled p-5 sm:p-6"
    >
      <header className="mb-4 pb-3 border-b border-dashed border-[var(--color-line)] flex items-baseline gap-2">
        {ornament && (
          <span className="text-[var(--color-gold)] text-sm leading-none select-none">
            {ornament}
          </span>
        )}
        <h2 className="font-display italic text-lg text-[var(--color-ink-warm)]">{title}</h2>
        {subtitle && (
          <p className="eyebrow ml-auto">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-[var(--color-ink-soft)] italic font-display py-2">
      {children}
    </p>
  )
}

function formatBirthday(yyyyMmDd: string): string {
  const [, m, d] = yyyyMmDd.split('-').map(Number)
  return `${m}월 ${d}일`
}
