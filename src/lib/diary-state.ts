import { db } from '@/db/schema'

const LAST_BACKUP_KEY = 'last-backup-at'
const ACTIVITY_KEY = 'activity-events'
const ACTIVITY_RETENTION_DAYS = 60   // 30일 grid + 여유분, 더 보관해도 무의미

/* ───────────────────────── streak / 마지막 기록 ───────────────────────── */

export interface DiaryRhythm {
  streakDays: number      // 마지막 기록일부터 거꾸로 연속된 날 수
  lastEpisodeAt: number | null
  daysSinceLast: number | null   // 오늘 안 썼으면 1+, 오늘 썼으면 0
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export async function computeRhythm(now: Date = new Date()): Promise<DiaryRhythm> {
  const episodes = await db.episodes.toArray()
  if (episodes.length === 0) {
    return { streakDays: 0, lastEpisodeAt: null, daysSinceLast: null }
  }

  // 날짜별 set — episode 있는 날 빠른 lookup
  const days = new Set<string>()
  let lastEpisodeAt = 0
  for (const e of episodes) {
    const d = new Date(e.createdAt)
    days.add(dayKey(d))
    if (e.createdAt > lastEpisodeAt) lastEpisodeAt = e.createdAt
  }

  const todayKey = dayKey(now)
  const wroteToday = days.has(todayKey)

  // 마지막 기록일부터 거꾸로 연속 카운트
  // 시작 cursor: 오늘 기록했으면 오늘부터, 아니면 어제부터
  const cursor = new Date(now)
  if (!wroteToday) cursor.setDate(cursor.getDate() - 1)

  let streakDays = 0
  for (let i = 0; i < 365; i++) {
    if (days.has(dayKey(cursor))) {
      streakDays++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  // 오늘 0시부터의 일수 차이 (자정 기준)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const lastStart = new Date(lastEpisodeAt)
  const lastDayStart = new Date(lastStart.getFullYear(), lastStart.getMonth(), lastStart.getDate()).getTime()
  const daysSinceLast = Math.round((todayStart - lastDayStart) / (24 * 60 * 60 * 1000))

  return { streakDays, lastEpisodeAt, daysSinceLast }
}

/* ───────────────────────── 30일 activity calendar ─────────────────────────
   날짜별 episode 수 — Home의 streak grid에 쓰임. 잔디(GitHub) 풍 시각화.
*/

export interface DayActivity {
  date: string         // 'YYYY-MM-DD' (로컬 시간 기준)
  count: number        // 그 날의 episode 수
}

function dayKeyISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function getActivityCalendar(lookbackDays = 30, now: Date = new Date()): Promise<DayActivity[]> {
  const episodes = await db.episodes.toArray()

  const byDay = new Map<string, number>()
  for (const e of episodes) {
    const key = dayKeyISO(new Date(e.createdAt))
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }

  const result: DayActivity[] = []
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  cursor.setDate(cursor.getDate() - (lookbackDays - 1))
  for (let i = 0; i < lookbackDays; i++) {
    const key = dayKeyISO(cursor)
    result.push({ date: key, count: byDay.get(key) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

/* ───────────────────────── 주간 활동 카운터 ─────────────────────────
   "이번 주" = 이번 월요일 00:00 ~ 다음 월요일 00:00 (로컬). 한국식.
   - 채팅 횟수: db.messages 직접 쿼리 (자동, 변조 불가)
   - fact 변경 / 삭제: localStorage 이벤트 로그 (사용자 행동 추적)
     이건 외부 전송 0건 — CLAUDE.md 가치 보존.
*/

export interface WeekActivity {
  weekStartTs: number
  chatCount: number      // 사용자가 보낸 메시지 수
  factChanges: number    // fact 추가 + 갱신
  factDeletions: number  // fact ✕로 직접 지운 수 (precision metric)
}

function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = d.getDay()  // 0=Sun ~ 6=Sat
  const offset = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - offset)
  return d
}

export async function computeWeekActivity(now: Date = new Date()): Promise<WeekActivity> {
  const weekStartTs = startOfWeek(now).getTime()
  const events = loadActivityEvents()

  const chatCount = await db.messages
    .where('createdAt')
    .above(weekStartTs)
    .filter((m) => m.role === 'user')
    .count()

  const factChanges = events.filter((e) => e.type === 'fact-changed' && e.ts >= weekStartTs).length
  const factDeletions = events.filter((e) => e.type === 'fact-deleted' && e.ts >= weekStartTs).length

  return { weekStartTs, chatCount, factChanges, factDeletions }
}

/* ───────────────────────── activity event log (localStorage) ───────────────────────── */

export type ActivityEventType = 'fact-changed' | 'fact-deleted'

interface ActivityEvent {
  type: ActivityEventType
  ts: number
}

function loadActivityEvents(): ActivityEvent[] {
  try {
    const v = localStorage.getItem(ACTIVITY_KEY)
    if (!v) return []
    const parsed = JSON.parse(v)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * fact-changed / fact-deleted 같은 사용자 행동 이벤트를 localStorage에 기록.
 * 외부 전송 NO. CLAUDE.md "분석 / 트래킹 도구 추가하지 마라" 원칙 안에서
 * 로컬 자기-피드백 metric 인프라.
 */
export function logActivityEvent(type: ActivityEventType): void {
  try {
    const events = loadActivityEvents()
    const cutoff = Date.now() - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const fresh = events.filter((e) => e.ts >= cutoff)
    fresh.push({ type, ts: Date.now() })
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(fresh))
  } catch {
    // localStorage 차단 환경 — silent OK
  }
}

/* ───────────────────────── 마지막 백업 ───────────────────────── */

export function getLastBackupAt(): number | null {
  try {
    const v = localStorage.getItem(LAST_BACKUP_KEY)
    if (!v) return null
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function markBackupNow(): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, String(Date.now()))
  } catch { /* localStorage 차단 — silent OK */ }
}

export function daysSinceBackup(): number | null {
  const at = getLastBackupAt()
  if (!at) return null
  return Math.floor((Date.now() - at) / (24 * 60 * 60 * 1000))
}

/* ───────────────────────── Storage indicator ───────────────────────── */

export interface StorageInfo {
  peopleCount: number
  factCount: number
  episodeCount: number
  messageCount: number
  estimatedBytes: number | null   // navigator.storage.estimate() 미지원 시 null
  quotaBytes: number | null
}

export async function computeStorage(): Promise<StorageInfo> {
  const [peopleCount, factCount, episodeCount, messageCount] = await Promise.all([
    db.people.count(),
    db.facts.count(),
    db.episodes.count(),
    db.messages.count(),
  ])

  let estimatedBytes: number | null = null
  let quotaBytes: number | null = null
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate()
      estimatedBytes = typeof est.usage === 'number' ? est.usage : null
      quotaBytes = typeof est.quota === 'number' ? est.quota : null
    } catch { /* 비밀 모드 등에서 차단될 수 있음 */ }
  }

  return { peopleCount, factCount, episodeCount, messageCount, estimatedBytes, quotaBytes }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/* ───────────────────────── Hero greeting (시간대 + rhythm) ───────────────────────── */

export interface HeroGreeting {
  eyebrow: string         // 작은 캡션 (날짜 또는 streak 표시)
  prompt: string          // 큰 헤드라인
  highlight: string       // prompt 끝에서 크림슨 강조될 부분 (없으면 빈 문자열)
  ornament?: string       // streak 아이콘 (있을 때만)
  ctaLabel: string        // 기록 버튼 라벨 — 오늘 이미 적었으면 '이어서 적기'
}

function getTimePrompt(hour: number): { prompt: string; highlight: string } {
  if (hour < 5) return { prompt: '자기 전에 한 줄만, ', highlight: '괜찮아?' }
  if (hour < 9) return { prompt: '잘 잤어? 어떤 ', highlight: '하루 시작이야?' }
  if (hour < 12) return { prompt: '오늘 무슨 일 ', highlight: '있었어?' }
  if (hour < 17) return { prompt: '오후 ', highlight: '잘 지내?' }
  if (hour < 22) return { prompt: '오늘 하루 ', highlight: '어땠어?' }
  return { prompt: '자기 전에 ', highlight: '한 줄만' }
}

export function buildHeroGreeting(rhythm: DiaryRhythm, now: Date = new Date()): HeroGreeting {
  const dateStr = new Intl.DateTimeFormat('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'long',
  }).format(now)

  const time = getTimePrompt(now.getHours())

  // CTA 라벨은 오늘 이미 기록했는지에 따라 차별화 — 사용자에게 '이미 적었음' 인식 신호
  const ctaLabel = rhythm.daysSinceLast === 0 ? '이어서 적기' : '기록하기'

  // 7일+ 만에 다시 → 환영
  if (rhythm.daysSinceLast !== null && rhythm.daysSinceLast >= 7) {
    return {
      eyebrow: `${rhythm.daysSinceLast}일 만이야`,
      prompt: '그동안 어떻게 ',
      highlight: '지냈어?',
      ctaLabel,
    }
  }

  // streak 7일+ → 특별
  if (rhythm.streakDays >= 7) {
    return {
      eyebrow: `${rhythm.streakDays}일째 이어가는 중`,
      prompt: time.prompt,
      highlight: time.highlight,
      ornament: '✦',
      ctaLabel,
    }
  }

  // streak 3-6일 → 잔잔한 응원
  if (rhythm.streakDays >= 3) {
    return {
      eyebrow: `${rhythm.streakDays}일째 함께`,
      prompt: time.prompt,
      highlight: time.highlight,
      ctaLabel,
    }
  }

  // 그 외 → 날짜 + 시간대별 인사
  return {
    eyebrow: dateStr,
    prompt: time.prompt,
    highlight: time.highlight,
    ctaLabel,
  }
}
