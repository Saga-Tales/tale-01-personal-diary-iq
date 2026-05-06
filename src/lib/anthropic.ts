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
