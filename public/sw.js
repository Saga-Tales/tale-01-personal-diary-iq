// diary PWA service worker
// 전략:
//   - navigation (HTML): network-first with 3s timeout, fallback to cache
//   - 그 외 GET: stale-while-revalidate (asset bundle은 hash-named이라 안전)
// 예외: api.anthropic.com 호출은 절대 캐시하지 않음 (인증 + 동적 응답)

const VERSION = 'v3'
const CACHE = `diary-${VERSION}`
const NAV_TIMEOUT_MS = 3000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add('./'))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[sw] install precache 실패:', err))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('diary-') && k !== CACHE)
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.hostname === 'api.anthropic.com') return
  if (!url.protocol.startsWith('http')) return

  // Navigation 요청 (HTML) → network-first.
  // 옛 cache-first 전략은 새 배포 후에도 사용자가 옛 버전을 보는 문제가 있어서 변경.
  // 자산 번들은 hash-named이라 immutable이지만 index.html은 매 배포마다 바뀌니
  // 항상 fresh HTML을 받아야 새 hash 자산을 로드함.
  // 오프라인 / 타임아웃 시에만 캐시 폴백 → SPA 라우팅 + 오프라인 첫 진입은 그대로 보장.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const fresh = await fetchWithTimeout('./', NAV_TIMEOUT_MS)
          if (fresh.ok) {
            cache.put('./', fresh.clone()).catch(() => {})
            return fresh
          }
          throw new Error(`navigation fetch returned ${fresh.status}`)
        } catch {
          const cached = await cache.match('./')
          return cached ?? Response.error()
        }
      }),
    )
    return
  }

  // 그 외 GET 요청 → stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request)
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone()).catch(() => {})
          }
          return response
        })
        .catch(() => cached || Response.error())

      return cached || fetchPromise
    }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

function fetchWithTimeout(url, ms) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
      reject(new Error('timeout'))
    }, ms)
    fetch(url, { signal: controller.signal })
      .then((r) => { clearTimeout(timer); resolve(r) })
      .catch((e) => { clearTimeout(timer); reject(e) })
  })
}
