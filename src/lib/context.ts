import { db, type Person, type Fact } from '@/db/schema'

const RELATIONSHIP_LABELS: Record<Person['relationship'], string> = {
  partner: '연인',
  family: '가족',
  friend: '친구',
  colleague: '동료',
  other: '기타',
}

const BASE_SYSTEM = `너는 사용자의 사적인 일기 에이전트야.
사용자가 중요한 사람들에 대해 적은 내용을 기억하고, 조언이 필요할 때 그 사람의 맥락을 고려해서 답해.
일반론은 금지. 그 사람 specific한 조언만 해. 정보가 부족하면 솔직히 모른다고 답해.

응답은 한국어로, 친근한 반말로. 길게 늘어놓지 말고 핵심만 간결하게.`

interface PersonWithFacts {
  person: Person
  facts: Fact[]
}

function formatPerson({ person: p, facts }: PersonWithFacts): string {
  const lines = [`### ${p.name}`]
  lines.push(`- 관계: ${RELATIONSHIP_LABELS[p.relationship]}`)
  if (p.birthday) lines.push(`- 생일: ${p.birthday}`)
  if (p.notes) lines.push(`- 메모: ${p.notes}`)

  if (facts.length > 0) {
    lines.push(`- 알려진 사실:`)
    for (const f of facts) {
      lines.push(`  - ${f.key}: ${f.value}`)
    }
  }

  return lines.join('\n')
}

export async function buildSystemPrompt(): Promise<string> {
  const people = await db.people.toArray()
  if (people.length === 0) return BASE_SYSTEM

  const withFacts: PersonWithFacts[] = await Promise.all(
    people.map(async (p) => ({
      person: p,
      facts: p.id
        ? await db.facts.where('personId').equals(p.id).toArray()
        : [],
    })),
  )

  const peopleSection = withFacts.map(formatPerson).join('\n\n')

  return `${BASE_SYSTEM}

---

## 사용자가 등록한 사람들

아래는 사용자가 등록한 중요한 사람들의 정보야.
사용자가 이 사람들 이름을 언급하거나, "여친", "엄마" 같은 관계로 부르면 이 정보를 활용해서 답해.

${peopleSection}`
}
