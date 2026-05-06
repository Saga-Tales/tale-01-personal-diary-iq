// diary PWA service worker
// 전략: stale-while-revalidate (cache 있으면 즉시 반환 + 백그라운드 갱신)
// 예외: api.anthropic.com 호출은 절대 캐시하지 않음 (인증 + 동적 응답)

const VERSION = 'v1'
const CACHE = `diary-${VERSION}`

// 설치 시 핵심 path만 우선 캐시 (오프라인 첫 진입 시 셸 생존)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add('./'))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[sw] install precache 실패:', err))
  )
})

// 활성화 시 옛 버전 캐시 정리
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

// fetch handler
self.addEventListener('fetch', (event) => {
  // GET만 캐싱 (POST/PUT 등은 그대로 통과)
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Anthropic API 호출은 절대 캐시 안 함 (그대로 네트워크로)
  if (url.hostname === 'api.anthropic.com') return

  // chrome-extension:// 같은 비표준 scheme도 무시
  if (!url.protocol.startsWith('http')) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request)
      const fetchPromise = fetch(event.request)
        .then((response) => {
          // 200 OK 응답만 캐시 (오류 응답 캐시하면 안 됨)
          if (response.ok) {
            cache.put(event.request, response.clone()).catch(() => {})
          }
          return response
        })
        .catch(() => cached || Response.error())

      // cache 있으면 즉시 반환 + 백그라운드 갱신 (stale-while-revalidate)
      // cache 없으면 fetch 결과 대기
      return cached || fetchPromise
    }),
  )
})

// 메인 스레드에서 'SKIP_WAITING' 메시지 받으면 즉시 활성화
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
