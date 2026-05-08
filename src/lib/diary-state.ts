import { db } from '@/db/schema'

const LAST_BACKUP_KEY = 'last-backup-at'

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

  // 7일+ 만에 다시 → 환영
  if (rhythm.daysSinceLast !== null && rhythm.daysSinceLast >= 7) {
    return {
      eyebrow: `${rhythm.daysSinceLast}일 만이야`,
      prompt: '그동안 어떻게 ',
      highlight: '지냈어?',
    }
  }

  // streak 7일+ → 특별
  if (rhythm.streakDays >= 7) {
    return {
      eyebrow: `${rhythm.streakDays}일째 이어가는 중`,
      prompt: time.prompt,
      highlight: time.highlight,
      ornament: '✦',
    }
  }

  // streak 3-6일 → 잔잔한 응원
  if (rhythm.streakDays >= 3) {
    return {
      eyebrow: `${rhythm.streakDays}일째 함께`,
      prompt: time.prompt,
      highlight: time.highlight,
    }
  }

  // 그 외 → 날짜 + 시간대별 인사
  return {
    eyebrow: dateStr,
    prompt: time.prompt,
    highlight: time.highlight,
  }
}
