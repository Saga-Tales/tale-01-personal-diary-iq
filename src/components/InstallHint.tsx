import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  if (/macintosh|windows|linux/.test(ua)) return 'desktop'
  return 'unknown'
}

function isStandalone(): boolean {
  // Android Chrome 등
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari
  if ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone) return true
  return false
}

export function InstallHint() {
  const [platform] = useState<Platform>(detectPlatform())
  const [installed, setInstalled] = useState(isStandalone())
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) {
    return (
      <section className="border border-[var(--color-line)] bg-white rounded-xl p-5">
        <h2 className="font-display text-lg mb-1">홈 화면에 추가됨 ✓</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">
          PWA로 실행 중. 데이터는 모두 너의 기기에 저장돼.
        </p>
      </section>
    )
  }

  async function triggerInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const result = await installPrompt.userChoice
    if (result.outcome === 'accepted') {
      setInstallPrompt(null)
    }
  }

  return (
    <section className="border border-[var(--color-line)] bg-white rounded-xl p-5 space-y-3">
      <header>
        <h2 className="font-display text-lg">홈 화면에 추가</h2>
        <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">
          모바일에서 일반 앱처럼 사용하기
        </p>
      </header>

      {installPrompt ? (
        <button onClick={triggerInstall} className="btn-primary w-full">
          지금 설치하기
        </button>
      ) : platform === 'ios' ? (
        <div className="text-sm text-[var(--color-ink-soft)] leading-relaxed space-y-2">
          <p>iOS Safari에서:</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>하단 공유 버튼 (네모 + 위 화살표) 탭</li>
            <li>"홈 화면에 추가" 선택</li>
            <li>"추가" 탭</li>
          </ol>
        </div>
      ) : platform === 'android' ? (
        <div className="text-sm text-[var(--color-ink-soft)] leading-relaxed space-y-2">
          <p>Android Chrome에서:</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>주소창 옆 ⋮ (세로 점 3개) 탭</li>
            <li>"앱 설치" 또는 "홈 화면에 추가" 선택</li>
          </ol>
        </div>
      ) : (
        <div className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
          <p>
            데스크톱 Chrome/Edge: 주소창 우측의 설치 아이콘 (모니터 + 화살표) 클릭.
            모바일에서는 브라우저 메뉴에서 "홈 화면에 추가" 선택.
          </p>
        </div>
      )}
    </section>
  )
}
