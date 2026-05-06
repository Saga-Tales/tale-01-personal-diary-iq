# CLAUDE.md — tale-01-personal-diary-iq

> 이 문서는 Claude Code (또는 새로 합류한 사람)가 이 프로젝트를 이해하고 이어갈 수 있도록 작성된 핸드오프 문서다. 코드는 직접 읽으면 되니 여기서는 **의도**, **잠긴 결정**, **반드시 보존해야 할 패턴**, **절대 하지 말아야 할 것**, **남은 열린 질문** 위주로 다룬다.

---

## 목차

1. [프로젝트 정체성](#1-프로젝트-정체성)
2. [현재 출시 상태](#2-현재-출시-상태)
3. [아키텍처 (canonical)](#3-아키텍처-canonical)
4. [반드시 보존해야 할 패턴](#4-반드시-보존해야-할-패턴)
5. [절대 하지 말아야 할 것](#5-절대-하지-말아야-할-것-anti-patterns)
6. [코드베이스 투어](#6-코드베이스-투어)
7. [작업 플레이북](#7-작업-플레이북)
8. [열린 질문 / 보류된 결정](#8-열린-질문--보류된-결정)
9. [알려진 함정 / 디버깅 사례](#9-알려진-함정--디버깅-사례)
10. [Workflow](#10-workflow)
11. [다음 단계 옵션](#11-다음-단계-옵션)
12. [Style & convention](#12-style--convention)

---

## 1. 프로젝트 정체성

### 무엇인가

브라우저-only personal diary agent. 사용자가 채팅으로 일상을 기록하면 LLM이:
- 사람별 사실(facts)을 자동 추출 + 누적
- 과거 일화(episodes)를 임베딩 기반 의미 검색으로 회상
- 맥락 있는 조언 제공
- 긴 대화(단톡방 등)를 다이제스트로 압축

### 누구를 위한 것인가

**Primary user**: 한동희 (IQ) — 만든 사람 본인. dogfooding 대상.
**Secondary**: 보욱 — Saga-Tales 공동 창업자, 두 번째 dogfooder.
**Tertiary**: 향후 일반 공개 가능성 있으나 현 단계에서는 우선순위 아님.

설계 결정 시 우선순위: IQ의 매일 사용 → 보욱의 dogfooding → 일반 사용자.

### 성공 기준

이건 **product**가 아니라 **tale**이다. Saga-Tales venture studio의 첫 번째 검증 과제.

성공 기준 (promotion ceremony용):
- ✓ 6주 내 빌드 완료 (실제: 6일)
- ✓ 공개 가능한 코드 + 라이브 사이트
- ⏳ Dogfoodable: 6주 dogfooding 후 매일 쓰는 도구가 됐는가
- ⏳ 측정 가능: 정량/정성 평가 가능한가 (metric 정의 + 추적)

지금은 빌드 페이즈가 끝나고 dogfooding 페이즈에 진입한 상태.

### 핵심 가치

설계 결정의 충돌이 있을 때 다음 우선순위로 판단:

1. **데이터 소유권** — 사용자 데이터는 사용자 기기에만. 외부 서버에 저장하는 어떤 기능도 안 됨.
2. **신뢰** — BYOK은 단순 기능이 아니라 architectural commitment. 우리가 사용자 키를 만질 수 없는 구조여야 함.
3. **dogfooding 효율** — 매일 쓰게 만드는 친화도가 새 기능 추가보다 중요.
4. **Static-only 호스팅 가능** — backend 추가는 즉시 NO. GitHub Pages에서 그대로 동작해야 함.
5. **Korean-first** — UI 텍스트, 에러 메시지, 추출 prompt 모두 한국어 우선.

---

## 2. 현재 출시 상태

### 라이브 사이트
- https://saga-tales.github.io/tale-01-personal-diary-iq/
- `main` push 시 GitHub Actions 자동 배포 (`.github/workflows/deploy.yml`)

### 완료된 빌드 단계 (Day 1 ~ Day 8)

```
Day 1: Storage + 채팅 + Person CRUD + 자동 배포
Day 2: System prompt 사람 정보 주입 + Fact extraction + Validator
Day 3: Episode embedding (multilingual-e5-small) + RAG retrieval + ErrorBoundary
Day 4: 기념일 .ics + 암호화 백업/복원 + 카톡 .txt/.eml import + UX 다듬기
Day 5: 다이제스트 (긴 대화 → 핵심 추출)
Day 6: Streaming chat + 다이제스트 진행 상황 표시
Day 7: 홈 대시보드 (카운터, 기념일, 최근 facts, 주간 다이제스트)
Day 8: PWA (manifest + SW + 아이콘) + GitHub Pages SPA fallback (404.html)
```

코어 시스템은 **feature-complete**.

### 무엇이 동작하는가

- ✅ 채팅 (streaming, 타이핑 커서, fact extraction toast, 임베딩 preload)
- ✅ Person CRUD + facts 표시 + 개별 fact 삭제
- ✅ 다이제스트 (paste/file 업로드, 포커스 사람 선택, streaming progress)
- ✅ 카톡 .txt/.eml import (5개 파서 패턴 — 모바일/PC, 시스템 메시지 무시)
- ✅ 백업/복원 (PBKDF2 + AES-GCM, 비밀번호 보호)
- ✅ 기념일 .ics export
- ✅ PWA (홈 화면 추가, standalone 모드, 오프라인 기본 동작)
- ✅ SPA 새로고침 (404.html redirect + index.html restoration)
- ✅ 홈 대시보드 (카운터, 기념일, 최근 facts, 주간 다이제스트)

### 알려진 미완성

- **검색 페이지 없음** — 전체 episode/message 키워드/의미 검색 기능 없음. 채팅에서 RAG로 일부 회상 가능하지만 명시적 검색 UI는 없음.
- **Person 상세 페이지 없음** — `/people/:id` 라우트 없음. Person 리스트에 facts 표시되긴 함.
- **온보딩 없음** — 첫 사용자가 알아서 헤매야 함. 친구나 가족에게 공유하기 전엔 우선순위 낮음.
- **음성 입력 없음** — 감정 토로용으로 유용할 듯하나 미구현.
- **다이제스트를 episode로 저장 안 함** — 다이제스트 결과는 화면에만, IndexedDB 저장 안 함. 메타-메모리 미구현.
- **다중 사용자 / 동기화 없음** — 의도된 결정. 아키텍처상 추가도 어려움.

### 의도적으로 안 만든 것 (중요)

이것들은 **요청받아도 만들지 마라**:

- ❌ **Backend / 서버** — 절대. BYOK + IndexedDB 모델의 기반.
- ❌ **분석 / 트래킹 / Sentry** — privacy 약속의 일부.
- ❌ **API key 서버 저장** — 백엔드 없으니 자연스럽게 불가능. localStorage만.
- ❌ **로그인 / 계정** — 데이터가 기기에만 산다는 모델과 충돌.
- ❌ **Push 알림 (서버 기반)** — backend 필요. 로컬 알림은 가능하지만 미구현.
- ❌ **데이터 공유 (다른 사용자에게)** — 다른 사람 정보를 다루는 도구이기에 confidentiality 강함.

---

## 3. 아키텍처 (canonical)

### 5-layer 구조

```
┌─────────────────────────────────────────────┐
│ L5: Distribution                            │
│   PWA, Service Worker, 404 fallback         │
├─────────────────────────────────────────────┤
│ L4: Operations                              │
│   Backup/Restore, iCal, Kakao Import,       │
│   Digest                                    │
├─────────────────────────────────────────────┤
│ L3: Episodic Memory                         │
│   Embeddings (multilingual-e5-small),       │
│   Cosine Retrieval                          │
├─────────────────────────────────────────────┤
│ L2: Semantic Memory                         │
│   People, Facts, Extractor + Validator      │
├─────────────────────────────────────────────┤
│ L1: Storage                                 │
│   IndexedDB via Dexie                       │
└─────────────────────────────────────────────┘
```

각 레이어 독립 — 상위 망가져도 하위는 동작.

### 데이터 모델 (Dexie schema)

```ts
// src/db/schema.ts — 변경할 때 reasoning 신중히
people:   '++id, name, relationship'
facts:    '++id, personId, key, [personId+key]'  // 복합 인덱스 핵심
episodes: '++id, personId, createdAt'             // createdAt 인덱스로 range query
messages: '++id, createdAt'
```

**중요**: 스키마 변경 시 Dexie `version()` bump + migration 필요. 사용자 데이터는 IndexedDB에 있으니 destructive change 절대 안 됨.

### 메모리 레이어 분리 이유

**Semantic memory** = 키-값 fact ("티뉴 알러지 = 떡볶이"). **무엇을** 알고 있는가.
**Episodic memory** = 일화 텍스트 + 임베딩. **언제 무엇이 있었나**.

이 분리가 중요한 이유:
- Semantic은 빠른 lookup, 정확한 사실 회상에 유리
- Episodic은 풍부한 맥락, 의미 기반 검색에 유리
- 둘 다 system prompt에 들어감. 하나만으로는 부족.

새 기능 추가 시 어느 레이어에 속하는지 먼저 판단:
- 정확한 사실? → semantic
- 일화/대화? → episodic
- 둘 다? → 둘 다 저장 OK (extractor가 episode에서 fact 뽑아냄)

### 상태 흐름 (메시지 전송 시)

```
사용자가 채팅 메시지 전송
   ↓
1. UI에 user 메시지 + 빈 assistant placeholder 즉시 추가
2. db.messages에 user 메시지 저장 (await — UI 흐름의 일부)
3. buildSystemPrompt(userMsg) 호출
   - db.people, db.facts 전부 조회 → prompt에 주입
   - userMsg 임베딩 생성 → episodes 중 cosine 유사도 top-3 → prompt에 주입
4. callStreaming(system, userMsg, 1024, onDelta) 호출
   - 토큰 받을 때마다 마지막 메시지 incremental update (setMessages)
5. 스트림 종료 → reply 전체를 db.messages에 저장 (await — 영구 저장은 1회)
6. 백그라운드 (fire-and-forget):
   - saveEpisode(userMsg, reply) — episode 저장 + 임베딩
   - extractFromMessage(userMsg) — Claude로 fact 추출 → validator → upsert
```

이 흐름의 핵심: **UX는 5번까지만 await**. 6번은 백그라운드. 사용자는 메모리 쓰기를 기다리지 않음.

---

## 4. 반드시 보존해야 할 패턴

### Pattern 1: Hard-constraint validator

**원칙**: LLM 출력을 받은 후 deterministic 코드로 항상 검증한다.

**왜**: LLM은 prompt 잘 따라도 가끔 헛소리 한다. 검증 없이 DB에 저장하면 데이터 오염됨.

**위치**: `src/lib/validator.ts`

**적용 예시**:

```ts
// extractor.ts
const rawFacts = await callJson(system, msg, 512)
const parsed = JSON.parse(rawFacts)

const result = validateAndResolve(parsed.facts, registeredPeople)
// result.valid: 검증 통과한 fact만
// result.rejected: reason과 함께 거부됨
// 통과한 것만 db.facts.put()
```

**확장 시**: 새 LLM 출력을 DB에 저장하는 모든 코드 경로에 같은 패턴 적용. JSON parse 후 → 검증 → 통과한 것만 저장.

### Pattern 2: Fire-and-forget background work

**원칙**: 사용자가 결과를 기다릴 필요 없는 작업은 `await` 없이 백그라운드 promise.

**왜**: AI 작업은 종종 느리다 (수 초~수 분). UX가 그걸 기다리면 안 됨.

**적용 예시**:

```ts
// Chat.tsx — 채팅 응답 후
await db.messages.add({ role: 'assistant', content: reply, ... })

// 여기까진 await — UX 흐름의 일부

saveEpisode(userMsg, reply).catch((e) =>
  console.warn('[chat] episode 저장 실패:', e),
)

extractFromMessage(userMsg)
  .then((res) => {
    if (res.inserted + res.updated > 0) setToast(`🔖 추가됨`)
  })
  .catch((e) => console.warn('[extractor] 실패:', e))

// await 없음. UI는 즉시 다음 입력 받을 수 있음
```

**확장 시**: 에러는 반드시 `.catch()`로 잡아서 console.warn (silent failure 방지). UI 토스트로 사용자에게 알릴지는 작업 성격에 따라 결정.

### Pattern 3: Composite key upsert

**원칙**: 같은 카테고리의 fact는 갱신, 새 카테고리는 추가.

**구현**: Dexie `[personId+key]` 복합 인덱스로 조회 후 update or insert.

```ts
// src/lib/extractor.ts (의역)
const existing = await db.facts
  .where('[personId+key]')
  .equals([personId, key])
  .first()

if (existing) {
  await db.facts.update(existing.id, { value, confidence, ... })
} else {
  await db.facts.add({ personId, key, value, confidence, ... })
}
```

**왜**: 같은 사람의 같은 카테고리에서 "최신 정보" 가 맞는 동작. 중복 row 누적 방지.

### Pattern 4: BYOK with localStorage only

**원칙**: API 키는 사용자 브라우저 localStorage에만. 우리 코드에서 절대 외부로 전송하지 않음.

**구현**: `src/lib/anthropic.ts`의 `getApiKey()`, `setApiKey()`, `clearApiKey()`만 사용. Anthropic SDK에 `dangerouslyAllowBrowser: true` 명시.

```ts
const KEY_STORAGE = 'anthropic-api-key'

export function getApiKey(): string | null {
  return localStorage.getItem(KEY_STORAGE)
}

export function setApiKey(key: string) {
  localStorage.setItem(KEY_STORAGE, key)
  client = null  // 다음 호출 시 새 client
}
```

**확장 시**: 키를 cookies, sessionStorage, IndexedDB, 또는 다른 어떤 곳에도 저장하지 마라. localStorage가 유일한 진실의 원천이어야 함.

### Pattern 5: Streaming with progress

**원칙**: 사용자가 응답을 기다리는 모든 LLM 호출은 streaming + 진행 표시.

**위치**: `src/lib/anthropic.ts`의 `callStreaming()`.

```ts
export async function callStreaming(
  system: string,
  userMessage: string,
  maxTokens: number,
  onDelta: (accumulated: string) => void,
): Promise<string> {
  const stream = getClient().messages.stream({...})
  let accumulated = ''
  stream.on('text', (delta) => {
    accumulated += delta
    onDelta(accumulated)  // 콜백 — UI 업데이트
  })
  await stream.finalMessage()
  return accumulated
}
```

**적용 예시**:
- `Chat.tsx` — 메시지 incremental update + 타이핑 커서
- `summarizer.ts` — JSON 부분 응답에서 정규식으로 화제 제목 추출 → 실시간 표시

**확장 시**: 새 사용자 대면 LLM 호출 추가하면 무조건 streaming. `callJson` (non-streaming)은 백그라운드 fact extraction 같은 비대면용으로만.

### Pattern 6: 부분 JSON에서 부분 결과 추출

**원칙**: streaming 중 미완성 JSON에서도 완성된 필드는 정규식으로 뽑아 보여준다.

```ts
// summarizer.ts
function extractPartialTopics(json: string): string[] {
  const titles: string[] = []
  const titleRegex = /"title"\s*:\s*"([^"]+)"/g
  let match
  while ((match = titleRegex.exec(json)) !== null) {
    titles.push(match[1])
  }
  return titles
}
```

**왜**: JSON parser는 완성된 JSON에만 동작. 정규식으로 "완성된 string 필드" 만 뽑으면 streaming 중에도 UI에 띄울 수 있음.

**확장 시**: 새 streaming + JSON 출력 작업 만들 때, prompt에 "필드 X를 가장 먼저 출력해라"고 명시 + 정규식으로 그 필드 추출.

### Pattern 7: PWA 정적 자원 + Anthropic API 분리

**원칙**: Service worker는 정적 자원만 캐시. `api.anthropic.com`은 절대 캐시하지 않음.

**위치**: `public/sw.js`

```js
// fetch handler
if (url.hostname === 'api.anthropic.com') return  // SW 개입 안 함

// navigation 요청 → cached shell 즉시 반환 (SPA)
if (event.request.mode === 'navigate') {
  // ... cache.match('./')
}

// 그 외 GET → stale-while-revalidate
```

**왜**: API 응답은 동적 + 인증. 캐시하면 잘못된 응답 재사용 위험.

**확장 시**: 다른 API endpoint 추가하면 동일하게 캐시 제외 처리.

### Pattern 8: 디자인 토큰

**위치**: `src/index.css`

```css
@theme {
  --color-paper: #faf8f3;
  --color-ink: #1a1a1a;
  --color-ink-soft: #4a4a4a;
  --color-line: #e8e2d4;
  --color-accent: #8b3a3a;
  --font-display: "Newsreader", Georgia, serif;
  --font-body: "Pretendard Variable", -apple-system, sans-serif;
}
```

**원칙**: 색상 / 폰트는 디자인 토큰만 사용. 직접 `#rrggbb` 박지 마라. 신규 컬러 추가 시 토큰부터 정의.

**적용**: Tailwind v4 `@theme` 변수 사용 → `bg-[var(--color-paper)]`, `text-[var(--color-ink)]` 등.

### Pattern 9: 에러는 ErrorBoundary로

**위치**: `src/components/ErrorBoundary.tsx`

App 전체가 ErrorBoundary로 감싸져 있음. 컴포넌트 에러나면 빈 화면이 아니라 진단 메시지 표시.

**확장 시**: 새 위험한 작업 (외부 lib 로딩, dynamic import 등) 추가 시 try-catch + 사용자에게 해결 가능한 에러 메시지 보여주기.

---

## 5. 절대 하지 말아야 할 것 (Anti-patterns)

### ❌ Backend 추가하지 마라

서버 사이드 코드, API endpoint, Edge function, Supabase, Firebase 등 어떤 형태든 백엔드 도입은 **NO**.

**이유**: 우리 가치 명제(BYOK + 데이터 소유권)의 기반이 사라짐. 사용자가 신뢰하는 이유를 없앰.

**예외**: 없음. 어떤 기능을 위해서 백엔드가 필요해 보이면, 그 기능을 다시 설계하거나 포기한다.

### ❌ 분석 / 트래킹 도구 추가하지 마라

Google Analytics, Sentry, PostHog, Mixpanel, Plausible 등.

**이유**: 사용자에게 한 privacy 약속 위반. dogfooding은 너 본인이 사용 패턴 직접 추적 (수동 회고).

**예외**: 사용자가 명시적으로 opt-in한 익명 metric (예: "이번 주 사용량")은 IndexedDB 로컬 추적은 OK. 외부 전송은 NO.

### ❌ API key를 어디에도 저장하지 마라 (localStorage 외)

cookies, sessionStorage, IndexedDB, hidden form, base64 encoding, 일반 변수에 stash 하기 등.

**이유**: localStorage가 유일한 진실의 원천. 다른 곳에 사본 두면 보안 표면이 늘어나고 (XSS 등), 사용자가 키 지웠을 때 stale copy 사용할 위험.

### ❌ 메모리 쓰기를 await로 막지 마라

```ts
// 절대 이렇게 하지 마라:
await saveEpisode(...)        // ❌ 이거 await 하면 채팅이 멍 때림
await extractFromMessage(...) // ❌ 같은 이유
setLoading(false)
```

```ts
// 올바른 방법:
saveEpisode(...).catch(...)        // ✓ fire-and-forget
extractFromMessage(...).then(...).catch(...)  // ✓
setLoading(false)  // 즉시 UI 정상화
```

### ❌ LLM 출력을 검증 없이 DB에 저장하지 마라

```ts
// ❌ 위험
const facts = JSON.parse(await callJson(...))
for (const f of facts) {
  await db.facts.add(f)  // 검증 없음 — 헛소리도 들어감
}

// ✓ 안전
const result = validateAndResolve(facts, people)
for (const f of result.valid) {
  await db.facts.add(f)
}
```

### ❌ 동기적 무거운 작업을 main thread에서 하지 마라

임베딩 생성, 큰 파일 파싱, 큰 JSON.parse 등은 UI를 freeze 시킬 수 있음. 가능하면 web worker로, 안 되면 chunk 단위로 분할 + `await new Promise(r => setTimeout(r, 0))`로 yield.

지금 임베딩은 transformers.js가 알아서 worker 비슷하게 처리. 카톡 import는 chunk 단위 (일별)로 처리.

### ❌ `cache.match(req)`을 navigation 요청에 사용하지 마라

SPA route에서는 모든 navigation이 결국 같은 `index.html`을 받아야 함. URL이 다르다고 다른 cache entry 만들지 말 것.

```js
// ✓ 올바름 (sw.js의 navigation handler)
if (event.request.mode === 'navigate') {
  const cached = await cache.match('./')  // 항상 같은 키
  return cached
}
```

### ❌ Tailwind classes를 임의로 만들지 마라

디자인 토큰 (paper, ink, line, accent) 외에 새 색상이나 폰트 추가하지 마라. 일관성 위해. 색이 정말 필요하면 `index.css`의 `@theme`에 토큰부터 추가.

### ❌ 카톡 파서를 단일 패턴으로 단순화하지 마라

`src/lib/kakao.ts`의 5가지 패턴 (A-E)이 모두 실제 데이터에서 발견된 케이스. 단순화하려다 사용자 데이터 손실 일으키기 쉽다. 변경 시 실제 .eml/.txt 파일로 회귀 테스트.

### ❌ Dexie schema를 destructive하게 변경하지 마라

기존 사용자 데이터 IndexedDB에 있음. `version()` 안 올리고 schema 바꾸면 사용자 데이터 깨짐.

```ts
// ✓ 올바름
this.version(1).stores({ people: '++id, name', ... })
this.version(2).stores({ people: '++id, name, email', ... }).upgrade(tx => {
  // 옛 데이터 마이그레이션
})
```

---

## 6. 코드베이스 투어

### 진입점

- **`src/main.tsx`** — React 부팅 + ErrorBoundary + ServiceWorker 등록.
- **`src/App.tsx`** — Router + Nav + 모든 페이지의 ApiKeyGate 래핑.

### `src/lib/` — 비즈니스 로직 (UI 무관)

| 파일 | 역할 | 수정 가이드 |
|---|---|---|
| `anthropic.ts` | Claude API 클라이언트, BYOK | 키 저장 위치 절대 변경 금지 |
| `context.ts` | System prompt 빌더 | prompt 변경 시 fact extraction에도 영향 |
| `extractor.ts` | Fact extractor | validator 호출 절대 빼지 마라 |
| `validator.ts` | Hard-constraint 검증 | 새 fact 형태 추가 시 여기 먼저 업데이트 |
| `embedder.ts` | transformers.js 싱글톤 | dynamic import 유지 (top-level import 금지) |
| `retriever.ts` | Cosine 검색 + episode 저장 | top-k 값 (기본 3) 변경 시 prompt 길이도 검토 |
| `summarizer.ts` | 다이제스트 streaming | extractPartialTopics regex 변경 시 prompt도 |
| `ical.ts` | 생일 .ics 생성 | RFC 5545 spec 따라야 함 |
| `backup.ts` | 암호화 백업 | crypto 파라미터 변경 시 backward compat 깨짐 |
| `kakao.ts` | 카톡 파서 (txt/eml) | 5개 패턴 보존 — 회귀 테스트 필수 |

### `src/components/` — 재사용 UI

| 파일 | 역할 |
|---|---|
| `ApiKeyGate.tsx` | API 키 없으면 /settings 리다이렉트 |
| `ErrorBoundary.tsx` | React 에러 캐치 |
| `FileDropZone.tsx` | 드래그+클릭 파일 업로드 |
| `InstallHint.tsx` | PWA 설치 안내 (iOS/Android/desktop 분기) |
| `digest.tsx` | 다이제스트 UI 공유 컴포넌트 (ProgressDisplay, DigestResult) |

### `src/pages/` — 라우트별 페이지

| 파일 | 라우트 | 역할 |
|---|---|---|
| `Home.tsx` | `/` | 홈 대시보드 — 카운터, 기념일, 최근 facts, 주간 다이제스트 |
| `Chat.tsx` | `/chat` | 채팅 (streaming) |
| `People.tsx` | `/people` | Person CRUD |
| `Digest.tsx` | `/digest` | 긴 대화 요약 |
| `Settings.tsx` | `/settings` | API 키 + PWA 설치 |
| `Data.tsx` | `/data` | 기념일/백업/카톡 import |

### `public/` — 정적 자원

```
manifest.webmanifest    # PWA 메타데이터
sw.js                   # Service worker (stale-while-revalidate, navigation handler)
404.html                # GitHub Pages SPA fallback (redirect script)
icon-*.png              # PWA 아이콘 4종 (192, 512, maskable, apple-touch)
```

수정 시 주의:
- `manifest.webmanifest`: `start_url`, `scope` 모두 `.` (상대) — base URL 자동 처리
- `sw.js`: 기능 변경 시 `VERSION` bump (캐시 invalidation)
- `404.html`: `pathSegmentsToKeep = 1` — repo 이름 1단계 유지

### `scripts/`

`generate-icons.py` — PIL로 아이콘 PNG 생성. 디자인 토큰 변경 시:
1. `index.css`에서 `--color-paper`, `--color-ink` 변경
2. `generate-icons.py`의 `PAPER`, `INK` 색상도 변경
3. `python3 scripts/generate-icons.py` 실행

### `.github/workflows/deploy.yml`

`main` push 시 빌드 + GitHub Pages 배포. 일반적으로 건드릴 일 없음.

---

## 7. 작업 플레이북

### 새 페이지 추가하기

1. `src/pages/X.tsx` 생성
2. `src/App.tsx`에 라우트 추가:
   ```tsx
   <Route path="/x" element={<ApiKeyGate><X /></ApiKeyGate>} />
   ```
3. Nav에 NavLink 추가 (선택)
4. ApiKeyGate 필요 여부 판단 (LLM API 쓰면 필수)

### 새 LLM 기능 추가하기

1. **사용자 대면 (사용자가 결과 기다림)?** → `callStreaming` 사용
2. **백그라운드 (사용자 모름)?** → `callJson` 사용
3. JSON 출력 받으면 항상 검증 layer 추가
4. 사용자 대면이면 progress callback으로 UI에 진행 표시
5. Prompt는 한국어로 작성, Markdown/code-fence 출력 명시적으로 금지

예시:
```ts
const result = await callStreaming(
  SYSTEM_PROMPT_KO,
  userInput,
  2048,
  (accumulated) => setProgress(extractPartialFromAccumulated(accumulated))
)
const parsed = JSON.parse(stripCodeFences(result))
const validated = validateMyOutput(parsed, ...)
await saveValidated(validated)
```

### 새 데이터 모델 추가하기

1. `src/db/schema.ts`에 인터페이스 + Dexie 테이블 추가
2. `version()` bump:
   ```ts
   this.version(2).stores({
     people: '++id, name, relationship',
     facts: '++id, personId, key, [personId+key]',
     episodes: '++id, personId, createdAt',
     messages: '++id, createdAt',
     newTable: '++id, ...',  // 추가
   })
   ```
3. 기존 사용자 마이그레이션 필요하면 `.upgrade(tx => ...)` 추가
4. 인덱스 신중히 — 자주 query 하는 필드만 (예: `createdAt` range query 필요하면 인덱스 필수)

### 새 fact 카테고리 추가하기

별도 코드 변경 없이 LLM이 자동으로 추출함. validator의 key 길이 제약 (1-30자)만 만족하면 OK.

만약 특정 카테고리를 강제하고 싶으면:
- `extractor.ts`의 prompt에 "다음 카테고리 우선: 알러지, 직업, 취미..." 등 가이드 추가
- 너무 강제하면 다양성 줄어드니 trade-off

### PWA 자산 업데이트하기

1. 디자인 토큰 변경하면 `scripts/generate-icons.py` 의 색상도 변경 → 재실행
2. `public/manifest.webmanifest`의 `theme_color`, `background_color` 동기화
3. SW 코드 변경 시 `public/sw.js`의 `VERSION` bump
4. `index.html`의 `<meta name="theme-color">` 동기화
5. 빌드 + 배포 후 사용자가 다음 방문 시 새 SW activate

### 카톡 파서 패턴 추가하기

1. 실제 .eml/.txt 샘플 확보
2. `src/lib/kakao.ts`의 `tryParseMessageLine()`에 새 정규식 추가 (A-E 다음에 F)
3. 회귀 테스트: 기존 5개 패턴 + 새 패턴 모두 잘 동작하는지 실제 파일로 검증
4. 문서화: 패턴 이름과 예시 형식 주석으로 추가

### 새 컴포넌트 추가하기

- 한 페이지에서만 쓰면 → `src/pages/X.tsx` 안에 inline
- 두 페이지 이상 공유 → `src/components/` 로 추출
- 디자인 토큰 사용, Tailwind 임의 색상 금지

---

## 8. 열린 질문 / 보류된 결정

이것들은 dogfooding 후 답할 질문들. 지금 임의로 답하지 말고 데이터 기반으로 결정.

### Q1. 일일 사용 루프가 무엇인가

가설들:
- A. 아침/저녁 일기형 (정해진 시간에 5-10분)
- B. 갈등 즉응형 (싸움 직후 토로 + 조언)
- C. 의사결정 보조형 (선물/데이트 추천 등)
- D. 회상형 (지난 대화 검색)

지금 시스템은 A/B/C/D 모두 가능하지만, dogfooding 후 어디 한 시나리오에 집중해야 다음 빌드 우선순위가 정해짐.

**Claude Code에게**: 사용자가 "X 기능 추가해줘"라고 하면 어느 시나리오 강화하는지 물어볼 것.

### Q2. Consent narrative

다른 사람 정보를 다루는 도구이기에 ethical positioning 필요. 세 가지 옵션:
- (a) 일기 프레임 강화: "내 머릿속 정신 모델 외장. 다른 사람 dossier 아님"
- (b) 투명성 우선: "사용자는 친구에게 이 도구 존재를 말하고 동의받음"
- (c) 명시적 reflection: 카톡 import 시 "이 사람이 알면 동의할까?" 체크박스

지금 사용자(IQ)는 모든 데이터를 동의 받았다고 함. 향후 일반 공개 시 narrative 정해야 함.

**Claude Code에게**: 다른 사람 정보 수집 강화하는 기능 (예: 자동 카톡 모니터링) 요청 받으면 신중히. (a)/(b)/(c) 중 어느 narrative 따르는지 먼저 확인.

### Q3. 품질 측정 metric

Dogfooding 데이터로 추적할 metric:
- Fact extraction precision (잘못된 fact / 전체) — 목표 > 80%
- Retrieval relevance (retrieve된 episode 중 진짜 관련 있는 것 / top-3) — 목표 > 60%
- Action rate (받은 조언 중 행동에 옮긴 것 / 전체) — 목표 > 30%
- 사용 빈도 (매일? 주 N회?)

**현재**: 추적 인프라 없음. 사용자가 수동 노트로 매주 회고 권장.

**Claude Code에게**: 자동 metric 수집 인프라 만들어달라는 요청 받으면 — IndexedDB 로컬 카운터 OK. 외부 전송 NO.

### Q4. 다중 사용자 (보욱 dogfooding)

지금 single-user 가정. 보욱이도 dogfooding 시작하면:
- 두 사람의 데이터는 완전 독립 (각자 브라우저)
- 비교 / 공유 기능은 의도적으로 없음
- 회고 시 두 사람의 학습 따로 정리

**Claude Code에게**: "데이터 동기화" 요청 받으면 거부. 백엔드 필요한 작업.

### Q5. Promotion ceremony 기준

Saga-Tales tale 프로모션 기준 4개 (Saga-Tales convention):
1. 6주 내 빌드 ✓
2. 공개 가능 ✓
3. Dogfoodable ⏳
4. 측정 가능 ⏳

3, 4가 통과하려면 6주 dogfooding 완료 후 회고 작성 필요.

---

## 9. 알려진 함정 / 디버깅 사례

### sharp 패키지 install 실패 (npm install 시 403)

**증상**: `npm install` 시 sharp의 postinstall이 sandbox/일부 환경에서 403 받아 실패.

**해결**: `.npmrc`에 `ignore-scripts=true` 명시. sharp는 어차피 transformers.js 또는 vite-plugin-pwa 부속 의존성으로만 들어오는데, 우리 코드는 sharp 직접 사용 안 함. native binary install 스킵해도 무방.

**Claude Code에게**: `npm install --legacy-peer-deps` 같은 우회 옵션 시도 전에 `.npmrc` 먼저 확인.

### transformers.js top-level import 시 빈 화면

**증상**: Day 3 작업 중 `import { pipeline } from '@xenova/transformers'` 를 모듈 top-level에 두니 페이지 로드 시 크래시.

**해결**: `src/lib/embedder.ts`에서 dynamic import:
```ts
async function loadPipeline() {
  const { pipeline } = await import('@xenova/transformers')
  return pipeline(...)
}
```

또한 ErrorBoundary로 App 전체 감싸기. 한 모듈 로드 실패해도 다른 페이지는 동작.

### GitHub Pages 504 (간헐적)

**증상**: `actions/deploy-pages` 가 가끔 504 반환. GitHub backend 일시적 이슈.

**해결**: workflow 재실행. 코드 문제 아님.

추가로 처음 deploy 시 GitHub Pages 활성화 자동 처리:
```yml
- uses: actions/configure-pages@v5
  with:
    enablement: true   # 첫 배포 시 자동 활성화
```

### 카톡 .eml 파서가 메시지 0개 추출

**증상**: 사용자가 .eml 업로드했는데 "메시지를 추출하지 못했어요" 표시.

**원인 분석**:
1. `날짜 헤더 패턴`이 메시지 라인의 시작 부분만 보고 매칭해버림 (e.g., "2026년 4월 16일" 부분)
2. 패턴 시도 순서 잘못: 날짜 헤더 → 메시지. 더 구체적인 패턴(메시지)이 나중에 시도되니 도달 못 함

**해결**:
1. 메시지 패턴 먼저 시도 (가장 구체적)
2. 날짜 헤더 패턴에 `$` 끝 앵커 추가 (단독 라인일 때만 매칭)
3. 시스템 메시지 (e.g., "X님이 Y를 초대했습니다") 명시적으로 무시

이런 종류의 변경은 실제 .eml 파일로 회귀 테스트 필수.

### SW가 옛 캐시 반환해서 새 코드 안 보임

**증상**: SW 코드 변경했는데 사용자 브라우저는 옛 동작.

**원인**: SW 라이프사이클 — 새 SW가 install되어도 모든 탭이 닫혀야 activate. 사용자가 탭 안 닫으면 무한히 옛 SW.

**해결**:
1. `self.skipWaiting()` install 끝에 호출 → 즉시 activate 후보
2. `self.clients.claim()` activate 시 호출 → 기존 클라이언트 통제
3. CACHE 이름의 VERSION bump → activate 시 옛 캐시 자동 삭제

### GitHub Pages SPA 새로고침 404

**증상**: `/chat`에서 새로고침하면 404. GitHub Pages는 SPA 라우팅 모름.

**해결**: rafgraph/spa-github-pages 패턴
1. `public/404.html`: redirect script로 `/?/chat` 로 이동
2. `index.html`: inline script로 URL을 `/chat` 으로 normalize
3. SW의 navigation handler가 cached shell 즉시 반환 (반복 방문 시 redirect 라운드트립 우회)

`pathSegmentsToKeep = 1` 의미: repo 이름 1 segment 유지. 다른 repo로 fork 시 이 값 그대로.

### IndexedDB 트랜잭션 충돌

**증상**: 카톡 import 시 가끔 fact 추출이 실패.

**원인**: bulk import 중 같은 facts 테이블에 동시 쓰기.

**해결**: import 시점에 fact extraction 끄거나 sequential하게 처리. 현재는 카톡 import는 chunk별로 sequential.

### 다이제스트 응답이 너무 짧음 (max_tokens 도달)

**증상**: 큰 단톡방 다이제스트 시 결과 잘림.

**해결**: `summarizer.ts`의 `callStreaming(..., 2048)` 의 max_tokens 늘림 (기본 2048). 너무 큰 입력은 chunk 분할 + map-reduce 패턴 필요할 수도 있으나 현재는 미구현 (Claude Haiku의 200K context로 대부분 케이스 커버됨).

---

## 10. Workflow

### 로컬 개발

```bash
npm install      # .npmrc 덕분에 native binary install 스킵
npm run dev      # http://localhost:5173/tale-01-personal-diary-iq/
```

dev 서버에서 SW 동작은 약간 다름 (캐시 안 됨). 프로덕션 SW 테스트는 `npm run build && npx serve dist`로.

### 빌드

```bash
npm run build    # → dist/
```

빌드 후 `dist/`에:
- `index.html` (PWA meta 포함, restoration script 포함)
- `404.html` (SPA fallback)
- `manifest.webmanifest`, `sw.js`, `icon-*.png`
- hashed asset bundles (`assets/index-XXXX.js` 등)

### 배포

`main` 브랜치 push 시 자동:

```bash
git add .
git commit -m "feat: ..."
git push origin main
```

GitHub Actions가 빌드 + GitHub Pages에 배포. 보통 1~2분.

### SW 캐시 invalidation

코드 변경 후 사용자가 새 버전 받게 하려면 `public/sw.js`의 VERSION bump:

```js
const VERSION = 'v3'  // 'v2' → 'v3'
```

다음 방문 시 새 SW install + 옛 캐시 삭제.

### 아이콘 재생성

디자인 토큰 변경 시:

```bash
python3 scripts/generate-icons.py
```

Python 3 + Pillow 필요. 결과: `public/icon-*.png`.

### 백업/복원 테스트

브라우저 개발 시:
1. `/data` 페이지에서 백업 → JSON 파일 다운로드
2. IndexedDB 비우기 (DevTools > Application > IndexedDB > 삭제)
3. 같은 파일로 복원 → 데이터 복구 확인

destructive 변경 전엔 항상 백업.

---

## 11. 다음 단계 옵션

### Option A: 2주 dogfooding pause (강력 추천)

빌드 멈추고 매일 사용:
- 매일 저녁 5분 회고 (무엇이 작동했나, 짜증났나)
- 잘못 추출된 fact 카운트
- retrieve된 episode 중 진짜 관련 있는 것 비율
- 사용 빈도 추적

2주 후:
- Day 9+ 우선순위가 데이터 기반으로 결정됨
- Saga-Tales promotion ceremony 발표 자료 자연스럽게 쌓임
- 진짜 필요한 기능 vs 짐작했던 기능 구분 가능

### Option B: 작은 개선 + dogfooding 병행

빌드를 0으로 멈추는 게 어려우면, 안전한 작은 개선만:
- 폰트 / 색상 미세 조정
- 에러 메시지 다듬기
- 문서화 (이 CLAUDE.md 자체 업데이트)

새 기능은 추가하지 마라.

### Option C: 다음 큰 기능

dogfooding 데이터 없이도 가시적 가치가 있는 기능들:

| 기능 | dogfooding 임팩트 | 구현 난이도 |
|---|---|---|
| 검색 (전체 episode/message) | 중-높 | 낮음 (임베딩 인프라 재사용) |
| Person 상세 페이지 | 중 | 중 |
| 온보딩 플로우 | 낮 (만든 사람은 필요 없음) | 중 |
| 음성 입력 | 중 | 중 (Web Speech API) |
| 다이제스트 → episode 저장 | 중 (메타-메모리) | 낮 |

내 추천: **검색**. 이미 있는 임베딩 인프라 재사용 가능. RAG 채팅에 들어가는 것과 같은 검색을 명시적 UI로 노출.

### Option D: Polish for promotion

Saga-Tales ceremony 발표용:
- README 다듬기 (이미 잘 되어있음)
- 영상 데모 녹화
- "lessons learned" 발표 자료 정리
- 보욱이 dogfooding 시작 가이드

dogfooding을 완료한 후 Option D로 넘어가는 게 자연스러움.

---

## 12. Style & convention

### 언어

- UI 텍스트: 한국어
- 에러 메시지: 한국어
- 주석: 한국어 (필요 시)
- 변수/함수명: 영어
- 커밋 메시지: 영어 (conventional commits 스타일)
  - `feat(day5): ...`
  - `fix: ...`
  - `docs: ...`

### 파일 명명

- 컴포넌트: `PascalCase.tsx` (예: `Home.tsx`, `InstallHint.tsx`)
- 라이브러리: `camelCase.ts` (예: `summarizer.ts`, `kakao.ts`)
- 페이지: 컴포넌트 규칙 따름
- 공유 컴포넌트가 여러 export 가지면: `lowercase.tsx` (예: `digest.tsx`)

### Import 순서

```ts
// 1. React / 외부 라이브러리
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// 2. 프로젝트 src/lib (alias @)
import { db } from '@/db/schema'
import { callStreaming } from '@/lib/anthropic'

// 3. 프로젝트 src/components
import { ProgressDisplay } from '@/components/digest'
```

### Tailwind class 순서

대략 다음 순서 (엄격하지 않음):
- layout (flex, grid)
- spacing (p-, m-)
- sizing (w-, h-)
- typography (text-, font-)
- color (bg-, text-, border-)
- effects (shadow, transition)

### 컴포넌트 구조

```tsx
export function MyPage() {
  // 1. State
  const [foo, setFoo] = useState(...)

  // 2. Effects
  useEffect(() => { ... }, [])

  // 3. Handlers
  async function handleSubmit() { ... }

  // 4. Render
  return ( ... )
}

// 5. 같은 파일 내부 helper 컴포넌트 (한 페이지에서만 쓰면)
function HelperComponent() { ... }

// 6. Pure helper functions
function formatDate() { ... }
```

### 비동기 처리

- 사용자 대면 (UI 흐름의 일부) → `await`
- 백그라운드 → `fire-and-forget` + `.catch()` (로깅)
- 절대 `.catch()` 빼먹지 마라 — silent failure는 디버깅 악몽

### 에러 메시지

- 사용자 대면: 친근한 한국어, 해결 방법 시사
  - ❌ "Error: 500 Internal Server Error"
  - ✓ "Claude API 응답이 이상해요. 다시 시도해주세요."
- 콘솔: `[모듈명] 에러 설명: 상세` 형식
  - `console.warn('[chat] episode 저장 실패:', e)`

### 타입

- TypeScript strict 유지
- `any` 사용 최소화 — 정말 모를 때만
- 복잡한 타입은 interface 분리 명명
- LLM JSON 출력 받을 때는 `Partial<X>` 후 defensive parsing

```ts
const parsed: Partial<MyOutput> = JSON.parse(text)
return {
  topics: Array.isArray(parsed.topics) ? parsed.topics : [],  // defensive
  // ...
}
```

### 디자인 일관성

- 카드: `border border-[var(--color-line)] bg-white rounded-xl p-5 shadow-sm`
- 헤더 (페이지 타이틀): `font-display italic text-3xl`
- 섹션 헤더: `font-display text-lg`
- 본문: `text-sm` 또는 default
- Muted 텍스트: `text-[var(--color-ink-soft)]`

### 코딩 스타일

- 가독성 > 영리함
- 함수는 한 가지 책임만
- early return 환영
- 100줄 넘는 함수는 나누는 거 고려
- 파일 300줄 넘으면 분리 고려

---

## 마무리

이 코드베이스는 **6일 만에 빌드된 tale**이지만 **production-grade 패턴**으로 구축되었다 — 단순히 "동작하는" 코드가 아니라 향후 일반 공개 가능한 수준을 목표로 했다.

현재 페이즈 (dogfooding) 에서 가장 중요한 일은 **사용**이다. 새 기능 추가는 dogfooding 데이터가 충분히 쌓인 후에 결정.

이 문서는 living document. 새 결정이나 패턴이 추가되면 여기 업데이트할 것.

질문이 있으면 IQ에게 물어볼 것. 결정의 reasoning을 알면 새로운 상황에서도 맞는 답을 도출할 수 있다.

— 마지막 업데이트: Day 8 완료 시점 (2026-05-06)
