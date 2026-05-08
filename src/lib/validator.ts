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

    const resolved = resolvePerson(f.person_name, people)
    if (!resolved.ok) {
      rejected.push({ fact: f, reason: resolved.reason })
      continue
    }

    valid.push({
      personId: resolved.personId,
      key: f.key.trim(),
      value: f.value.trim(),
      confidence: f.confidence,
    })
  }

  return { valid, rejected }
}

type ResolveResult =
  | { ok: true; personId: number }
  | { ok: false; reason: string }

function resolvePerson(name: string, people: Person[]): ResolveResult {
  if (!name) return { ok: false, reason: 'empty name' }
  if (people.length === 0) return { ok: false, reason: 'no people registered' }

  // 1) 정확 이름 매칭 (name은 이름 그대로니까 동명이인 가능)
  const exactMatches = people.filter((p) => p.name === name)
  if (exactMatches.length === 1 && exactMatches[0].id) {
    return { ok: true, personId: exactMatches[0].id }
  }
  if (exactMatches.length > 1) {
    return { ok: false, reason: `ambiguous name "${name}": ${exactMatches.length} people share this name` }
  }

  // 2) 관계어 → relationship 매칭. 1:1일 때만 안전. 모호하면 명시적 거부.
  const rel = RELATIONSHIP_KEYWORDS[name]
  if (rel) {
    const candidates = people.filter((p) => p.relationship === rel)
    if (candidates.length === 1 && candidates[0].id) {
      return { ok: true, personId: candidates[0].id }
    }
    if (candidates.length > 1) {
      return {
        ok: false,
        reason: `ambiguous keyword "${name}": ${candidates.length} ${rel} candidates (${candidates.map((p) => p.name).join(', ')}) — extract by exact name instead`,
      }
    }
    return { ok: false, reason: `keyword "${name}" maps to relationship "${rel}" but no person registered as ${rel}` }
  }

  return { ok: false, reason: `person "${name}" not found and not a recognized relationship keyword` }
}
