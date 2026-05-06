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
 * 카카오톡 모바일 export 형식 파싱.
 * 형식 예:
 *   --------------- 2026년 5월 1일 일요일 ---------------
 *   [티뉴] [오후 3:42] 야 오늘 떡볶이 어때
 *   [IQ] [오후 3:43] ㅇㅋ
 *
 * PC 버전 ([오후 3:42] 이름 : msg) 도 호환.
 */
export function parseKakaoExport(text: string): ParsedMessage[] {
  const lines = text.split('\n')
  const messages: ParsedMessage[] = []
  let currentDate = ''

  // "--------------- 2026년 5월 1일 일요일 ---------------"
  const dateHeader = /-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/

  // 모바일: "[이름] [오후 3:42] 메시지"
  const mobilePattern = /^\[([^\]]+)\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*(.*)$/

  // PC: "[오후 3:42] 이름 : 메시지"
  const pcPattern = /^\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*([^:]+):\s*(.*)$/

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    const dateMatch = line.match(dateHeader)
    if (dateMatch) {
      const [, y, m, d] = dateMatch
      currentDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      continue
    }

    if (!currentDate) continue

    const mobile = line.match(mobilePattern)
    const pc = line.match(pcPattern)
    const match = mobile || pc

    if (match) {
      let sender: string, ampm: string, hourStr: string, min: string, content: string
      if (mobile) {
        ;[, sender, ampm, hourStr, min, content] = mobile
      } else {
        ;[, ampm, hourStr, min, sender, content] = pc!
      }

      let hour = parseInt(hourStr, 10)
      if (ampm === '오후' && hour !== 12) hour += 12
      if (ampm === '오전' && hour === 12) hour = 0

      messages.push({
        date: currentDate,
        time: `${String(hour).padStart(2, '0')}:${min}`,
        sender: sender.trim(),
        content: content.trim(),
      })
    } else if (line.trim() && messages.length > 0) {
      // multi-line continuation: 이전 메시지에 이어붙임
      messages[messages.length - 1].content += '\n' + line.trim()
    }
  }

  return messages
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
