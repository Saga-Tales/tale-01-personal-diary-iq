import Anthropic from '@anthropic-ai/sdk'

const STORAGE_KEY = 'anthropic_api_key'

export function getApiKey(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setApiKey(key: string) {
  localStorage.setItem(STORAGE_KEY, key)
}

export function clearApiKey() {
  localStorage.removeItem(STORAGE_KEY)
}

function getClient() {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('API 키가 설정되지 않았어. 설정 페이지에서 등록해줘.')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export async function chat(userMessage: string, system: string): Promise<string> {
  const res = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userMessage }],
  })
  const block = res.content[0]
  return block.type === 'text' ? block.text : ''
}

export async function callJson(system: string, userMessage: string, maxTokens = 512): Promise<string> {
  const res = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  })
  const block = res.content[0]
  return block.type === 'text' ? block.text : ''
}

/**
 * Streaming 호출. delta가 도착할 때마다 onDelta 콜백 호출.
 * 채팅, 요약 등 응답을 실시간으로 보여주고 싶을 때 사용.
 */
export async function callStreaming(
  system: string,
  userMessage: string,
  maxTokens: number,
  onDelta: (accumulated: string) => void,
): Promise<string> {
  const stream = getClient().messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  })

  let accumulated = ''
  stream.on('text', (delta) => {
    accumulated += delta
    onDelta(accumulated)
  })

  await stream.finalMessage()
  return accumulated
}
