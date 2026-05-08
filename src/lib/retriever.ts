import { db, type Episode } from '@/db/schema'
import { embed } from '@/lib/embedder'

const MIN_SIMILARITY = 0.5
const TOP_K = 3

export interface RetrievedEpisode {
  episode: Episode
  similarity: number
}

export async function retrieveRelevant(query: string): Promise<RetrievedEpisode[]> {
  const all = await db.episodes.toArray()
  const withEmb = all.filter(
    (e): e is Episode & { embedding: number[] } =>
      Array.isArray(e.embedding) && e.embedding.length > 0,
  )
  if (withEmb.length === 0) return []

  let queryEmb: number[]
  try {
    queryEmb = await embed(query, 'query')
  } catch (e) {
    console.warn('[retriever] embed query 실패:', e)
    return []
  }

  return withEmb
    .map((e) => ({ episode: e, similarity: cosine(queryEmb, e.embedding) }))
    .filter(({ similarity }) => similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, TOP_K)
}

/**
 * Episode content 포맷 — saveEpisode와 turn 삭제(content 매칭) 양쪽에서 공유.
 * 이 형식이 변경되면 기존 episode 검색이 깨지니 신중히.
 */
export function formatEpisodeContent(userMsg: string, assistantMsg: string): string {
  return `[사용자] ${userMsg}\n[응답] ${assistantMsg}`
}

/**
 * 채팅 turn 하나(user + assistant)를 에피소드로 저장 (with embedding).
 * fire-and-forget으로 호출 — 채팅 UX를 막지 않게.
 */
export async function saveEpisode(userMsg: string, assistantMsg: string): Promise<void> {
  const content = formatEpisodeContent(userMsg, assistantMsg)

  try {
    const embedding = await embed(userMsg, 'passage')
    await db.episodes.add({
      personId: null,
      content,
      embedding,
      createdAt: Date.now(),
    })
  } catch (e) {
    console.warn('[retriever] embedding 실패, raw text만 저장:', e)
    await db.episodes.add({
      personId: null,
      content,
      createdAt: Date.now(),
    })
  }
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}
