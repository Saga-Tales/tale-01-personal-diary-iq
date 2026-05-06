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
  const [digestProgress, setDigestProgress] = useState<DigestProgress | null>(null)
  const [digestResult, setDigestResult] = useState<DigestOutput | null>(null)
  const [digestError, setDigestError] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [peopleCount, factCount, episodeCount, peopleAll, allFacts, ub] =
      await Promise.all([
        db.people.count(),
        db.facts.count(),
        db.episodes.count(),
        db.people.toArray(),
        db.facts.toArray(),
        getUpcomingBirthdays(60),
      ])

    setCounts({ people: peopleCount, facts: factCount, episodes: episodeCount })

    // 최근 추출된 fact 5개
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
    <div className="max-w-2xl mx-auto p-6 sm:p-8 space-y-6">
      <Hero />

      {/* Counters */}
      <div className="grid grid-cols-3 gap-3">
        <CounterCard label="사람" value={counts.people} />
        <CounterCard label="알게 된 것" value={counts.facts} />
        <CounterCard label="일화" value={counts.episodes} />
      </div>

      {/* 다가오는 기념일 */}
      <Card title="다가오는 기념일" subtitle="앞으로 60일 이내">
        {birthdays.length === 0 ? (
          <EmptyHint>등록된 생일이 없어요. 사람들 페이지에서 추가해보세요.</EmptyHint>
        ) : (
          <ul className="space-y-2.5">
            {birthdays.map((b) => (
              <li
                key={b.person.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{b.person.name}</span>
                <span className="text-[var(--color-ink-soft)] tabular-nums">
                  {b.daysUntil === 0
                    ? '🎉 오늘'
                    : b.daysUntil === 1
                      ? '내일'
                      : `${b.daysUntil}일 후`}
                  <span className="text-[var(--color-ink-soft)] ml-2 text-xs">
                    {formatBirthday(b.person.birthday!)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 최근 알게 된 것들 */}
      <Card title="최근 알게 된 것들" subtitle="자동 추출">
        {recentFacts.length === 0 ? (
          <EmptyHint>
            아직 추출된 fact가 없어. 채팅하다보면 자동으로 모임.
          </EmptyHint>
        ) : (
          <ul className="space-y-2.5">
            {recentFacts.map((f, i) => (
              <li key={i} className="text-sm leading-relaxed">
                <span className="font-medium">{f.personName}</span>
                <span className="text-[var(--color-ink-soft)] mx-1.5">·</span>
                <span className="text-[var(--color-ink-soft)]">{f.key}</span>
                <span className="text-[var(--color-ink-soft)] mx-1.5">=</span>
                <span>{f.value}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 이번 주 다이제스트 */}
      <section>
        <header className="mb-3">
          <h2 className="font-display text-lg">이번 주 다이제스트</h2>
          <p className="text-xs text-[var(--color-ink-soft)]">
            지난 7일 동안의 대화를 한눈에
          </p>
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
          <p className="text-xs px-3 py-2 mt-2 rounded text-[var(--color-accent)] bg-[var(--color-paper)]">
            {digestError}
          </p>
        )}
      </section>
    </div>
  )
}

function Hero() {
  const today = new Date()
  const dateStr = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(today)

  return (
    <header className="pb-2">
      <p className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
        {dateStr}
      </p>
      <h1 className="font-display italic text-3xl mt-1.5 leading-tight">
        오늘 무슨 일 있었어?
      </h1>
      <Link
        to="/chat"
        className="btn-primary inline-block mt-4 no-underline"
      >
        기록하기 →
      </Link>
    </header>
  )
}

function CounterCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--color-line)] bg-white rounded-xl p-4 text-center">
      <div className="text-2xl font-display tabular-nums leading-none">{value}</div>
      <div className="text-xs text-[var(--color-ink-soft)] mt-1.5">{label}</div>
    </div>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-[var(--color-line)] bg-white rounded-xl p-5 shadow-sm">
      <header className="mb-3 pb-3 border-b border-[var(--color-line)]">
        <h2 className="font-display text-lg">{title}</h2>
        {subtitle && (
          <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-[var(--color-ink-soft)] italic py-2">
      {children}
    </p>
  )
}

function formatBirthday(yyyyMmDd: string): string {
  const [, m, d] = yyyyMmDd.split('-').map(Number)
  return `${m}월 ${d}일`
}
