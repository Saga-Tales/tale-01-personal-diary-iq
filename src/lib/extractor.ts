import { db, type Person } from '@/db/schema'
import { callJson } from '@/lib/anthropic'
import { validateAndResolve, type RawFact, type ValidatedFact } from '@/lib/validator'

const MIN_MESSAGE_LENGTH = 10

export interface ExtractResult {
  inserted: number
  updated: number
  rejected: number
}

/**
 * 사용자 메시지에서 사람에 대한 사실을 추출해서 facts 테이블에 upsert.
 * fire-and-forget 방식으로 호출해야 함 — 채팅 UX를 막지 않게.
 */
export async function extractFromMessage(message: string): Promise<ExtractResult> {
  const empty: ExtractResult = { inserted: 0, updated: 0, rejected: 0 }

  if (message.length < MIN_MESSAGE_LENGTH) return empty

  const people = await db.people.toArray()
  if (people.length === 0) return empty

  let parsed: { facts?: RawFact[] }
  try {
    const text = await callJson(buildExtractionPrompt(people), message)
    parsed = JSON.parse(stripCodeFences(text))
  } catch (e) {
    console.warn('[extractor] JSON parse 실패:', e)
    return empty
  }

  const { valid, rejected } = validateAndResolve(parsed.facts ?? [], people)

  let inserted = 0
  let updated = 0
  for (const fact of valid) {
    const action = await upsertFact(fact)
    if (action === 'inserted') inserted++
    else updated++
  }

  if (rejected.length > 0) {
    console.debug('[extractor] rejected:', rejected)
  }

  return { inserted, updated, rejected: rejected.length }
}

function buildExtractionPrompt(people: Person[]): string {
  const peopleList = people.map((p) => `- ${p.name} (${p.relationship})`).join('\n')

  // 같은 관계가 여러 명이면 관계어 매칭이 모호해지므로 LLM에게 미리 알림
  const relCounts = people.reduce<Record<string, number>>((acc, p) => {
    acc[p.relationship] = (acc[p.relationship] ?? 0) + 1
    return acc
  }, {})
  const ambiguousRels = Object.entries(relCounts).filter(([, n]) => n > 1).map(([r]) => r)

  const ambiguityNote = ambiguousRels.length > 0
    ? `\n\n[모호 회피] ${ambiguousRels.join(', ')} 관계가 여러 명 등록됨. 사용자가 "엄마/누나/형" 같은 관계어를 쓰면 누구인지 명확하지 않으므로 person_name은 반드시 위 목록의 정확한 이름으로만.`
    : ''

  return `너는 사용자의 일기/대화에서 사람에 대한 사실을 추출하는 어시스턴트야.

[등록된 사람들]
${peopleList}${ambiguityNote}

[추출 규칙]
1. person_name은 위 목록의 이름과 정확히 일치해야 함
   - "여친"/"여자친구"/"애인" → relationship이 partner인 사람 (해당 관계 1명일 때만)
   - "엄마"/"아빠"/"형"/"누나" 등 → relationship이 family인 사람 (해당 관계 1명일 때만)
   - 같은 관계가 여러 명이면 위 [모호 회피] 따라 정확한 이름만 사용
   - 위 목록에 없는 사람 언급은 무시
2. key는 짧은 명사구 (1~30자). 일관된 표기 사용:
   - 영문 약어는 대문자: MBTI, IT
   - 같은 의미는 같은 key로 통일
   - 좋은 예: "MBTI", "알러지", "취미", "직업", "선호 음식", "스트레스 트리거", "종교", "거주지"
3. value는 구체적인 사실 (1~200자)
   - 좋은 예: "INTJ", "떡볶이", "클라이밍", "백엔드 개발자"
4. 추출하지 말 것:
   - 모호하거나 추측성 정보
   - 일시적인 감정/상황 ("오늘 기분 안좋음" ✗)
   - 사용자 본인에 대한 정보
   - 이미 등록된 사람의 이름/관계 자체
5. 새로운 사실이 없으면 "facts": [] 반환
6. confidence는 0.5~1.0. 명시적으로 진술된 사실만 0.7 이상.

[출력 형식 — JSON만, 다른 텍스트 금지]
{"facts": [{"person_name": "...", "key": "...", "value": "...", "confidence": 0.0}]}`
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}

async function upsertFact(fact: ValidatedFact): Promise<'inserted' | 'updated'> {
  const existing = await db.facts
    .where('[personId+key]')
    .equals([fact.personId, fact.key])
    .first()

  if (existing?.id) {
    await db.facts.update(existing.id, {
      value: fact.value,
      confidence: fact.confidence,
      createdAt: Date.now(),
    })
    return 'updated'
  }

  await db.facts.add({
    personId: fact.personId,
    key: fact.key,
    value: fact.value,
    confidence: fact.confidence,
    createdAt: Date.now(),
  })
  return 'inserted'
}
