import { callJsonStreaming } from '@/lib/anthropic'

export interface DigestTopic {
  title: string
  description: string
}

export interface DigestQuote {
  speaker: string
  quote: string
}

export interface DigestOutput {
  topics: DigestTopic[]
  decisions: string[]
  actionItems: string[]
  notableQuotes: DigestQuote[]
  overallTone: string
  participantBreakdown?: Record<string, string>
}

export interface DigestProgress {
  phase: 'connecting' | 'streaming' | 'parsing'
  receivedChars: number
  topicsFound: string[]
  elapsedMs: number
}

const SYSTEM_PROMPT = `너는 카카오톡/채팅 로그에서 핵심을 추출하는 한국어 어시스턴트야.

응답은 다음 형식의 JSON만. 다른 텍스트, 마크다운, 코드 펜스 일체 금지:

{
  "topics": [
    {"title": "짧은 제목 (5~15자)", "description": "1~2문장 설명. 누가 무슨 얘기했는지 포함"}
  ],
  "decisions": ["명시적으로 결정된 사항을 한 줄로"],
  "actionItems": ["누가 무엇을 하기로 했는지. 'X가 Y할 예정' 형태"],
  "notableQuotes": [
    {"speaker": "발언자 이름 (대화에 등장한 그대로)", "quote": "발언 (40자 이내)"}
  ],
  "overallTone": "한 줄로 표현 (예: 활발한 일상 잡담, 진지한 의사결정 토론, 갈등 후 화해 분위기)",
  "participantBreakdown": {
    "참여자 이름": "이 사람의 주요 관심사/발언 요약 1~2문장"
  }
}

[가이드라인]
1. topics는 3~5개. 의미 있는 화제만. 잡담/이모티콘/사진만 있는 부분은 무시.
2. decisions: 명시적으로 합의된 것만. "X 하자" "Y로 정함" 같은 발언 기반. 추측 금지.
3. actionItems: 미래의 구체적 행동. 단순 의도("~할까?")는 제외.
4. notableQuotes는 1~3개만. 정말 인상적이거나 핵심적인 것만.
5. participantBreakdown: 적극 참여한 사람만. 한두 마디만 한 참여자는 제외.
6. 추측 금지. 명시되지 않은 것은 추출하지 않음.
7. 만약 어떤 항목에 해당하는 내용이 없으면 빈 배열 [] 반환.

[중요] topics를 가장 먼저 출력해. 사용자가 진행 상황을 빨리 볼 수 있도록.`

export async function summarizeChat(
  chatText: string,
  focusPerson?: string,
  onProgress?: (progress: DigestProgress) => void,
): Promise<DigestOutput> {
  const startTime = Date.now()

  const wrappedInput = focusPerson
    ? `[참고: ${focusPerson}의 발언과 관심사에 더 비중을 두고 요약]

${chatText}`
    : chatText

  onProgress?.({
    phase: 'connecting',
    receivedChars: 0,
    topicsFound: [],
    elapsedMs: 0,
  })

  const text = await callJsonStreaming(
    SYSTEM_PROMPT,
    wrappedInput,
    2048,
    (accumulated) => {
      onProgress?.({
        phase: 'streaming',
        receivedChars: accumulated.length,
        topicsFound: extractPartialTopics(accumulated),
        elapsedMs: Date.now() - startTime,
      })
    },
  )

  onProgress?.({
    phase: 'parsing',
    receivedChars: text.length,
    topicsFound: extractPartialTopics(text),
    elapsedMs: Date.now() - startTime,
  })

  const cleaned = stripCodeFences(text)
  let parsed: Partial<DigestOutput>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('요약 응답이 JSON 형식이 아니에요. 다시 시도해주세요.')
  }

  return {
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    notableQuotes: Array.isArray(parsed.notableQuotes) ? parsed.notableQuotes : [],
    overallTone: typeof parsed.overallTone === 'string' ? parsed.overallTone : '',
    participantBreakdown:
      parsed.participantBreakdown && typeof parsed.participantBreakdown === 'object'
        ? parsed.participantBreakdown
        : undefined,
  }
}

/**
 * 미완성 JSON에서 "title" 필드들을 best-effort로 추출.
 * Streaming 중 실시간으로 발견된 화제를 보여주기 위함.
 */
function extractPartialTopics(json: string): string[] {
  const titles: string[] = []
  const titleRegex = /"title"\s*:\s*"([^"]+)"/g
  let match
  while ((match = titleRegex.exec(json)) !== null) {
    titles.push(match[1])
  }
  return titles
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim()
}
