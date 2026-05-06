import { db } from '@/db/schema'
import { embed } from '@/lib/embedder'
import { extractFromMessage } from '@/lib/extractor'
import PostalMime from 'postal-mime'

interface ParsedMessage {
  date: string // 'YYYY-MM-DD'
  time: string // 'HH:MM'
  sender: string
  content: string
}

export interface DailyChunk {
  date: string
  content: string
  messageCount: number
  senders: string[]
}

export interface ImportProgress {
  phase: 'parsing' | 'embedding' | 'extracting' | 'done'
  current: number
  total: number
}

/**
 * 카카오톡 export 파일을 읽어서 raw text 반환.
 * - .txt: 그대로
 * - .eml: 이메일 envelope 파싱 → body 또는 첨부파일에서 카톡 텍스트 추출
 */
export async function readKakaoFile(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split('.').pop() || ''

  if (ext === 'txt') {
    return await file.text()
  }

  if (ext === 'eml') {
    const buffer = await file.arrayBuffer()
    const parser = new PostalMime()
    const email = await parser.parse(buffer)

    // 1) 이메일 본문이 카톡 형식이면 그대로
    if (email.text && looksLikeKakao(email.text)) {
      return email.text
    }

    // 2) 첨부파일 중 .txt 또는 text/* 에서 카톡 형식 찾기
    for (const att of email.attachments || []) {
      const filename = att.filename || ''
      const isText =
        att.mimeType?.startsWith('text/') ||
        filename.toLowerCase().endsWith('.txt')
      if (!isText) continue

      let text: string
      if (typeof att.content === 'string') {
        text = att.content
      } else if (att.content instanceof ArrayBuffer) {
        text = new TextDecoder('utf-8').decode(att.content)
      } else {
        continue
      }

      if (looksLikeKakao(text)) return text
    }

    // 3) 마지막 수단: 본문이 비어있지 않으면 그대로 (파싱 시도)
    if (email.text) return email.text

    throw new Error('eml 파일에서 카카오톡 대화를 찾을 수 없어요. 첨부파일이나 본문 형식 확인.')
  }

  throw new Error(`지원하지 않는 파일 형식: .${ext} (지원: .txt, .eml)`)
}

function looksLikeKakao(text: string): boolean {
  // heuristic: 날짜 헤더 또는 메시지 패턴이 충분히 있는지
  const dateHeader = /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/
  const msgPattern = /\[[^\]]+\]\s*\[(오전|오후)\s*\d/g
  const matches = text.match(msgPattern) || []
  return dateHeader.test(text) || matches.length >= 3
}

/**
 * 카카오톡 export 다양한 형식을 모두 시도해서 파싱.
 * 지원:
 *   - 모바일: [이름] [오후 H:MM] 메시지
 *   - PC: [오후 H:MM] 이름 : 메시지
 *   - PC long: 2026년 5월 1일 오후 3:42, 이름 : 메시지
 *   - PC dot: 2026. 5. 1. 오후 3:42 - 이름 : 메시지
 *   - 24-hour 변형도 함께
 * 날짜 헤더는 dashes 있어도/없어도 매칭. 날짜를 못 찾아도 메시지에서 inline 추출되면 사용.
 */
export function parseKakaoExport(text: string): ParsedMessage[] {
  const lines = text.split('\n')
  const messages: ParsedMessage[] = []
  let currentDate = ''

  // 날짜 헤더 패턴들 — 모두 line 끝까지 단독 형태일 때만 매칭 (메시지 라인이 잘못 매칭되지 않게)
  const dateHeaderPatterns = [
    // 대시로 둘러싸인: --------------- 2026년 5월 1일 일요일 ---------------
    /^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일[^:]*-+\s*$/,
    // 단독: "2026년 5월 1일" 또는 "2026년 5월 1일 일요일"
    /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(?:[가-힣]+요일)?\s*$/,
    // 점: 2026.5.1
    /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*$/,
    // 하이픈: 2026-05-01
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s*$/,
  ]

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // 1) 메시지 라인 먼저 시도 (가장 구체적인 패턴)
    const parsed = tryParseMessageLine(line)
    if (parsed) {
      if (parsed.date) currentDate = parsed.date
      messages.push({
        date: parsed.date || currentDate || '1970-01-01',
        time: parsed.time,
        sender: parsed.sender,
        content: parsed.content,
      })
      continue
    }

    // 2) 메시지가 아니면 날짜 헤더 시도 (단독 라인만)
    let dateMatched = false
    for (const pat of dateHeaderPatterns) {
      const m = line.match(pat)
      if (m) {
        const [, y, mo, d] = m
        currentDate = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        dateMatched = true
        break
      }
    }
    if (dateMatched) continue

    // 3) 날짜로 시작하지만 메시지/헤더 둘 다 아닌 라인 → 시스템 메시지/마커. 무시
    //    예: "2026년 4월 17일 오전 9:18" (단독 timestamp)
    //    예: "2026년 4월 17일 오전 9:18, 한동희님이 X님을 초대했습니다" (sender:msg 구분자 없음)
    if (/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일/.test(line)) continue

    // 4) 그 외 라인은 이전 메시지의 continuation으로 간주
    if (messages.length > 0) {
      messages[messages.length - 1].content += '\n' + line
    }
  }

  return messages
}

interface ParseAttempt {
  date?: string
  time: string
  sender: string
  content: string
}

function tryParseMessageLine(line: string): ParseAttempt | null {
  // (A) 모바일: [이름] [오후 3:42] 메시지
  let m = line.match(/^\[([^\]]+)\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*(.*)$/)
  if (m) {
    const [, sender, ampm, h, mi, content] = m
    return { time: to24h(ampm, h, mi), sender: sender.trim(), content: content.trim() }
  }

  // (B) 모바일 24h: [이름] [13:42] 메시지
  m = line.match(/^\[([^\]]+)\]\s*\[(\d{1,2}):(\d{2})\]\s*(.*)$/)
  if (m) {
    const [, sender, h, mi, content] = m
    return { time: `${h.padStart(2, '0')}:${mi}`, sender: sender.trim(), content: content.trim() }
  }

  // (C) PC: [오후 3:42] 이름 : 메시지
  m = line.match(/^\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*([^:]+?)\s*:\s*(.*)$/)
  if (m) {
    const [, ampm, h, mi, sender, content] = m
    return { time: to24h(ampm, h, mi), sender: sender.trim(), content: content.trim() }
  }

  // (D) PC long: 2026년 5월 1일 오후 3:42, 이름 : 메시지
  m = line.match(
    /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2})\s*[,-]\s*([^:]+?)\s*:\s*(.*)$/,
  )
  if (m) {
    const [, y, mo, d, ampm, h, mi, sender, content] = m
    return {
      date: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      time: to24h(ampm, h, mi),
      sender: sender.trim(),
      content: content.trim(),
    }
  }

  // (E) PC dot: 2026. 5. 1. 오후 3:42 - 이름 : 메시지
  m = line.match(
    /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(오전|오후)\s*(\d{1,2}):(\d{2})\s*[,-]\s*([^:]+?)\s*:\s*(.*)$/,
  )
  if (m) {
    const [, y, mo, d, ampm, h, mi, sender, content] = m
    return {
      date: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      time: to24h(ampm, h, mi),
      sender: sender.trim(),
      content: content.trim(),
    }
  }

  return null
}

function to24h(ampm: string, hourStr: string, min: string): string {
  let hour = parseInt(hourStr, 10)
  if (ampm === '오후' && hour !== 12) hour += 12
  if (ampm === '오전' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${min}`
}

/**
 * 디버깅용: 파일에서 추출된 텍스트의 의미있는 첫 N줄.
 * 파싱 실패 시 사용자에게 보여줘서 어떤 형식인지 확인 가능하게.
 */
export function getDebugSample(text: string, maxLines = 30): string {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, maxLines)
    .join('\n')
}

export function groupByDay(messages: ParsedMessage[]): DailyChunk[] {
  const groups = new Map<string, ParsedMessage[]>()
  for (const m of messages) {
    if (!groups.has(m.date)) groups.set(m.date, [])
    groups.get(m.date)!.push(m)
  }

  return Array.from(groups.entries())
    .map(([date, msgs]) => ({
      date,
      content: msgs.map((m) => `[${m.time}] ${m.sender}: ${m.content}`).join('\n'),
      messageCount: msgs.length,
      senders: Array.from(new Set(msgs.map((m) => m.sender))),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface ImportSummary {
  episodes: number
  facts: number
  failed: number
}

/**
 * 일별 chunk를 episode로 임베딩 + fact extraction.
 * extractor에는 personName을 명시적으로 주입해서 그 사람에 대한 사실만 추출되게.
 */
export async function importChunks(
  chunks: DailyChunk[],
  personId: number,
  personName: string,
  onProgress: (p: ImportProgress) => void,
): Promise<ImportSummary> {
  let episodes = 0
  let facts = 0
  let failed = 0
  const total = chunks.length

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    onProgress({ phase: 'embedding', current: i, total })

    try {
      const embedding = await embed(chunk.content, 'passage')
      await db.episodes.add({
        personId,
        content: chunk.content,
        embedding,
        createdAt: new Date(chunk.date + 'T12:00:00').getTime(),
      })
      episodes++
    } catch (e) {
      console.warn('[kakao] embedding 실패:', e)
      failed++
    }

    onProgress({ phase: 'extracting', current: i, total })

    try {
      const wrapped = `다음은 ${personName}와의 카카오톡 대화 일부야. ${personName}에 대한 새로운 사실(취미, 직업, 선호, 알러지, 중요한 사건 등)만 추출해. 나(사용자)나 다른 등록되지 않은 사람에 대한 정보는 무시.

${chunk.content}`
      const result = await extractFromMessage(wrapped)
      facts += result.inserted + result.updated
    } catch (e) {
      console.warn('[kakao] extraction 실패:', e)
    }
  }

  onProgress({ phase: 'done', current: total, total })
  return { episodes, facts, failed }
}
