import { db, type Person } from '@/db/schema'

const RELATIONSHIP_LABELS: Record<Person['relationship'], string> = {
  partner: '연인',
  family: '가족',
  friend: '친구',
  colleague: '동료',
  other: '기타',
}

/**
 * 등록된 사람들의 생일을 매년 반복 이벤트(.ics)로 생성.
 * 사용자가 다운로드 후 Google Calendar / Apple Calendar에 import.
 */
export async function generateBirthdaysIcal(): Promise<{ ics: string; count: number }> {
  const people = await db.people.toArray()
  const withBirthday = people.filter(
    (p): p is Person & { birthday: string } =>
      typeof p.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.birthday),
  )

  const events = withBirthday.map(formatEvent).join('\r\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Personal Diary//Birthday Reminders//KO',
    'CALSCALE:GREGORIAN',
    events,
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')

  return { ics, count: withBirthday.length }
}

function formatEvent(p: Person & { birthday: string }): string {
  const date = p.birthday.replace(/-/g, '') // YYYYMMDD
  const uid = `person-${p.id}@personal-diary`
  const summary = `🎂 ${escape(p.name)} 생일`
  const description = `${escape(p.name)} (${RELATIONSHIP_LABELS[p.relationship]})의 생일`

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${date}`,
    'RRULE:FREQ=YEARLY',
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'TRIGGER:-P3D',
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n')
}

function escape(s: string): string {
  return s.replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n')
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

export interface UpcomingBirthday {
  person: Person
  daysUntil: number
}

export async function getUpcomingBirthdays(withinDays = 30): Promise<UpcomingBirthday[]> {
  const people = await db.people.toArray()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const upcoming: UpcomingBirthday[] = []
  for (const p of people) {
    if (!p.birthday || !/^\d{4}-\d{2}-\d{2}$/.test(p.birthday)) continue

    const [, m, d] = p.birthday.split('-').map(Number)
    const thisYear = new Date(today.getFullYear(), m - 1, d)
    const target =
      thisYear < today
        ? new Date(today.getFullYear() + 1, m - 1, d)
        : thisYear

    const days = Math.round((target.getTime() - today.getTime()) / 86400000)
    if (days <= withinDays) {
      upcoming.push({ person: p, daysUntil: days })
    }
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil)
}
