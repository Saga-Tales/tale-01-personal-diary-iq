import type { Person } from '@/db/schema'

export interface RawFact {
  person_name: string
  key: string
  value: string
  confidence: number
}

export interface ValidatedFact {
  personId: number
  key: string
  value: string
  confidence: number
}

// 관계어 → relationship 매핑. "여친", "엄마" 같은 표현을 등록된 사람과 연결
const RELATIONSHIP_KEYWORDS: Record<string, Person['relationship']> = {
  '여친': 'partner',
  '여자친구': 'partner',
  '남친': 'partner',
  '남자친구': 'partner',
  '애인': 'partner',
  '엄마': 'family',
  '어머니': 'family',
  '아빠': 'family',
  '아버지': 'family',
  '형': 'family',
  '누나': 'family',
  '오빠': 'family',
  '언니': 'family',
  '동생': 'family',
}

const MIN_CONFIDENCE = 0.5
const MAX_KEY_LENGTH = 30
const MAX_VALUE_LENGTH = 200

export interface ValidationResult {
  valid: ValidatedFact[]
  rejected: { fact: RawFact; reason: string }[]
}

/**
 * Hard constraint validator. iq-blogger 패턴.
 * 추출된 raw facts 중 다음 조건 모두 만족하는 것만 통과:
 *  1. confidence >= 0.5 (수치)
 *  2. key는 1~30자 문자열, 문장 아님
 *  3. value는 1~200자 문자열
 *  4. person_name이 등록된 사람과 매칭됨 (정확 일치 OR 관계어)
 */
export function validateAndResolve(
  raw: RawFact[],
  people: Person[],
): ValidationResult {
  const valid: ValidatedFact[] = []
  const rejected: { fact: RawFact; reason: string }[] = []

  for (const f of raw) {
    if (typeof f.confidence !== 'number' || f.confidence < MIN_CONFIDENCE) {
      rejected.push({ fact: f, reason: `confidence too low: ${f.confidence}` })
      continue
    }

    if (typeof f.key !== 'string' || f.key.length === 0 || f.key.length > MAX_KEY_LENGTH) {
      rejected.push({ fact: f, reason: 'invalid key length' })
      continue
    }

    // key가 문장(공백 포함 + 마침표/물음표/느낌표) 형태면 거부
    if (/[.?!]/.test(f.key)) {
      rejected.push({ fact: f, reason: 'key is a sentence' })
      continue
    }

    if (typeof f.value !== 'string' || f.value.length === 0 || f.value.length > MAX_VALUE_LENGTH) {
      rejected.push({ fact: f, reason: 'invalid value length' })
      continue
    }

    const personId = resolvePerson(f.person_name, people)
    if (!personId) {
      rejected.push({ fact: f, reason: `person not found: ${f.person_name}` })
      continue
    }

    valid.push({
      personId,
      key: f.key.trim(),
      value: f.value.trim(),
      confidence: f.confidence,
    })
  }

  return { valid, rejected }
}

function resolvePerson(name: string, people: Person[]): number | null {
  if (!name || people.length === 0) return null

  // 1) 정확 이름 매칭
  const exact = people.find((p) => p.name === name)
  if (exact?.id) return exact.id

  // 2) 관계어 → relationship 매칭
  const rel = RELATIONSHIP_KEYWORDS[name]
  if (rel) {
    const match = people.find((p) => p.relationship === rel)
    if (match?.id) return match.id
  }

  return null
}
