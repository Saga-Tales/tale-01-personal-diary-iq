import { db, type Person, type Fact } from '@/db/schema'
import { retrieveRelevant } from '@/lib/retriever'

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

export async function buildSystemPrompt(query?: string): Promise<string> {
  const people = await db.people.toArray()

  const sections: string[] = [BASE_SYSTEM]

  // 등록된 사람들 + facts
  if (people.length > 0) {
    const withFacts: PersonWithFacts[] = await Promise.all(
      people.map(async (p) => ({
        person: p,
        facts: p.id
          ? await db.facts.where('personId').equals(p.id).toArray()
          : [],
      })),
    )

    sections.push(`---

## 사용자가 등록한 사람들

아래는 사용자가 등록한 중요한 사람들의 정보야.
사용자가 이 사람들 이름을 언급하거나, "여친", "엄마" 같은 관계로 부르면 이 정보를 활용해서 답해.

${withFacts.map(formatPerson).join('\n\n')}`)
  }

  // 관련된 과거 에피소드 (query가 있을 때만)
  if (query) {
    const episodeCount = await db.episodes.count()
    if (episodeCount > 0) {
      try {
        const retrieved = await retrieveRelevant(query)
        if (retrieved.length > 0) {
          const formatted = retrieved
            .map(({ episode, similarity }) => {
              const date = new Date(episode.createdAt).toLocaleDateString('ko-KR')
              return `- (${date}, 유사도 ${similarity.toFixed(2)})\n${indent(episode.content, '  ')}`
            })
            .join('\n\n')

          sections.push(`---

## 관련된 과거 대화

아래는 현재 질문과 의미적으로 관련된 과거 대화야. 필요하면 자연스럽게 참조해.

${formatted}`)
        }
      } catch (e) {
        console.warn('[context] episode retrieval 실패:', e)
      }
    }
  }

  return sections.join('\n\n')
}

function indent(text: string, prefix: string): string {
  return text.split('\n').map((line) => prefix + line).join('\n')
}
