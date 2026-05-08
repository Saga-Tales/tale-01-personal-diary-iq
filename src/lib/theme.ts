import { useEffect, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'theme'

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* localStorage 차단 — system fallback */
  }
  return 'system'
}

function applyTheme(t: Theme) {
  if (t === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', t)
  }
  // PWA standalone에서 status bar 색이 즉시 따라가도록 meta theme-color도 swap
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const metas = document.querySelectorAll('meta[name="theme-color"]')
  metas.forEach((m) => m.setAttribute('content', dark ? '#1a1612' : '#faf8f3'))
}

export function useTheme(): {
  theme: Theme
  resolved: 'light' | 'dark'
  setTheme: (t: Theme) => void
  cycle: () => void
} {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    getStoredTheme() === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : (getStoredTheme() as 'light' | 'dark'),
  )

  // 시스템 테마 변화 감지 — 'system' 모드일 때만 반응
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    function onChange() {
      if (theme === 'system') {
        setResolved(mq.matches ? 'dark' : 'light')
        applyTheme('system')
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* noop */ }
    applyTheme(t)
    setResolved(
      t === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        : t,
    )
  }

  function cycle() {
    const next: Theme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    setTheme(next)
  }

  return { theme, resolved, setTheme, cycle }
}
