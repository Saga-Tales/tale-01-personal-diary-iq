import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiKey, setApiKey, clearApiKey } from '@/lib/anthropic'

export function Settings() {
  const [apiKey, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setKey(getApiKey() || '')
  }, [])

  function save() {
    if (!apiKey.trim()) return
    setApiKey(apiKey.trim())
    setSaved(true)
    setTimeout(() => navigate('/chat'), 600)
  }

  function clear() {
    clearApiKey()
    setKey('')
    setSaved(false)
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-3xl mb-2">설정</h1>
      <p className="text-[var(--color-ink-soft)] mb-8 italic">
        너의 키, 너의 데이터, 너의 일기.
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Anthropic API 키
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full border border-[var(--color-line)] bg-white rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:border-[var(--color-ink)]"
          />
          <p className="text-xs text-[var(--color-ink-soft)] mt-2 leading-relaxed">
            console.anthropic.com에서 발급받은 키를 입력해.<br />
            이 키는 너의 브라우저에만 저장되고, 외부 서버로 전송되지 않아.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!apiKey.trim()}
            className="bg-[var(--color-ink)] text-[var(--color-paper)] px-5 py-2 rounded-lg disabled:opacity-30 transition-opacity"
          >
            {saved ? '저장됨 ✓' : '저장하기'}
          </button>
          <button
            onClick={clear}
            className="border border-[var(--color-line)] px-4 py-2 rounded-lg text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            지우기
          </button>
        </div>
      </div>
    </div>
  )
}
