# tale-01-personal-diary-iq

> 너의 사적인 일기 에이전트.
> 모든 데이터는 너의 브라우저에만 산다.

🔗 **Live**: https://saga-tales.github.io/tale-01-personal-diary-iq/
📁 **Repo**: https://github.com/Saga-Tales/tale-01-personal-diary-iq

[Saga-Tales](https://github.com/Saga-Tales) venture studio의 첫 번째 tale. 6일 빌드, BYOK, 백엔드 0대.

---

## 무엇

소중한 사람들 — 연인, 가족, 친구, 동료 — 에 대한 정보를 기록하면, 시간이 지날수록 LLM 에이전트가:

1. 사람별 사실(MBTI, 알러지, 직업, 취미 등)을 **자동으로 누적**
2. 과거 대화 일화를 **의미 검색**으로 회상
3. 맥락에 맞는 **구체적 조언** 제공 (일반론 금지)
4. 긴 대화를 **다이제스트**로 압축 (단톡방 catch-up)

ChatGPT와 가장 큰 차이: **기억이 너의 브라우저에만 살고**, Anthropic API 키도 너 본인 것을 직접 쓴다. 백엔드 서버 자체가 존재하지 않는다.

## 왜

기존 관계 CRM 도구들(Volley, Monaru, Dex, Recall, Mem) 대부분 SaaS — 친구·가족·연인에 대한 매우 사적인 정보를 그들의 서버에 위탁해야 한다. Notion으로 직접 정리하던 사람도 많지만, 정리는 수동 작업이고 회상은 grep + 인간 기억에 의존한다.

이 프로젝트가 검증하려는 가설:

| 가설 | 검증 방법 | 현재 상태 |
|---|---|---|
| Local-first AI가 충분히 가능한가 | transformers.js로 임베딩 로컬 실행 | ✅ multilingual-e5-small, 32MB 양자화, 첫 로드 후 캐시 |
| BYOK 모델이 사용자 신뢰를 얻는가 | 데이터가 서버에 가지 않는다는 것을 코드로 증명 | 🟡 dogfooding으로 검증 중 |
| 자동 fact extraction이 수동 정리보다 낫나 | 6주 dogfooding 후 회고 | 🟡 진행 중 |
| Streaming UX가 "기다림"을 "관찰"로 바꾸는가 | A/B 체감 비교 | ✅ 같은 응답 시간, 다른 만족도 |

---

## 빠른 시작

### 사용자 입장

1. [Live 사이트](https://saga-tales.github.io/tale-01-personal-diary-iq/) 접속
2. [console.anthropic.com](https://console.anthropic.com)에서 API 키 발급 (보통 $5 충전이면 한 달 사용)
3. **설정** → API 키 입력 → 저장 (브라우저 localStorage에만)
4. **사람들** → 중요한 사람 등록 (이름, 관계, 생일, 자유 메모)
5. **대화** → 일상 적기. 시간 지날수록 에이전트가 맥락 알게 됨.
6. **다이제스트** → 단톡방 .txt/.eml 임포트해서 핵심만 추출 (선택)
7. **데이터** → 정기 백업 (브라우저 캐시 날아가도 복구 가능)

### 모바일 PWA로 설치

- **iOS Safari**: 하단 공유 버튼 → "홈 화면에 추가"
- **Android Chrome**: 메뉴 ⋮ → "앱 설치" 또는 "홈 화면에 추가"

홈 화면 아이콘 누르면 브라우저 chrome 없이 standalone 앱처럼 열림. 데이터는 IndexedDB에 그대로.

### 개발자 입장

요구사항: **Node 20+**

```bash
git clone https://github.com/Saga-Tales/tale-01-personal-diary-iq
cd tale-01-personal-diary-iq
npm install      # .npmrc에 ignore-scripts=true (sharp 등 native binary 스킵)
npm run dev      # http://localhost:5173/tale-01-personal-diary-iq/
```

빌드:
```bash
npm run build    # dist/ 에 정적 파일 생성
```

`main` 브랜치 push 시 GitHub Actions가 자동 배포 (`.github/workflows/deploy.yml`).

---

## 아키텍처

5 레이어 구조 — 위로 갈수록 추상화:

```mermaid
graph TB
  subgraph L5[Distribution]
    PWA[PWA · Service Worker · 404 fallback]
  end
  subgraph L4[운영 도구 · Operations]
    Backup[암호화 백업/복원<br/>PBKDF2 + AES-GCM]
    Cal[iCal 기념일 export]
    Kakao[카톡 .txt/.eml import]
    Digest[다이제스트<br/>긴 대화 → 핵심 추출]
  end
  subgraph L3[Episodic Memory]
    Embed[임베딩<br/>multilingual-e5-small]
    Retrieve[Cosine similarity<br/>top-k 검색]
  end
  subgraph L2[Semantic Memory]
    Person[Person 테이블]
    Fact[Fact 테이블<br/>personId+key 복합 인덱스]
    Extract[Fact extractor<br/>+ Hard-constraint validator]
  end
  subgraph L1[Storage]
    DB[(IndexedDB · Dexie)]
  end
  L5 --> L4
  L4 --> L3
  L4 --> L2
  L3 --> L1
  L2 --> L1
```

각 레이어는 독립적으로 작동 — 상위 레이어가 망가져도 하위는 정상 동작 (예: 임베딩 모델 로드 실패해도 채팅 + fact 추출은 동작).

### 메시지 처리 파이프라인 (Streaming)

사용자가 "오늘 티뉴랑 점심 먹는데 떡볶이 알러지 있다고 함" 보낸 후:

```mermaid
sequenceDiagram
  participant U as 사용자
  participant UI as Chat UI
  participant Ctx as Context Builder
  participant LLM as Claude Haiku
  participant Mem as Memory (BG)

  U->>UI: 메시지 전송
  UI->>UI: empty assistant 버블 즉시 추가
  UI->>Ctx: buildSystemPrompt(query)
  Ctx->>Ctx: 사람들 + facts 수집
  Ctx->>Ctx: query 임베딩 → top-3 episode (cosine)
  Ctx-->>UI: enriched system prompt
  UI->>LLM: stream(message, system)
  loop 각 토큰
    LLM-->>UI: text delta
    UI->>UI: 마지막 메시지 incremental update
  end
  UI-->>U: 완성 — DB 저장 1회

  par 백그라운드 (fire-and-forget)
    UI->>Mem: saveEpisode(user+assistant)
    Mem->>Mem: 임베딩 → episodes 테이블
  and
    UI->>Mem: extractFromMessage(user)
    Mem->>LLM: 추출 prompt + 등록된 사람들
    LLM-->>Mem: JSON facts
    Mem->>Mem: validator → upsert facts
  end
```

핵심: 백그라운드 작업은 fire-and-forget. 채팅 UX는 결코 fact extraction이나 임베딩을 기다리지 않는다.

---

## 핵심 설계 결정

### 1. Hard-constraint validator 패턴

LLM이 fact 추출 시 헛소리할 수 있다. 그래서 추출 결과를 받은 후 코드 레벨에서 검증:

```typescript
function validateAndResolve(raw: RawFact[], people: Person[]): ValidationResult {
  // 1. confidence >= 0.5
  // 2. key는 1~30자, 문장 형태(.?!) 거부
  // 3. value는 1~200자
  // 4. person_name이 등록된 사람과 매칭 (정확 이름 OR 관계어)
  // 위 4개 모두 통과한 것만 DB에 입력
}
```

`iq-blogger` 프로젝트에서 처음 적용한 패턴 — LLM이 만들어낸 거 그대로 신뢰하지 않고 deterministic 검증을 그 위에 둔다.

### 2. Upsert by composite key

Fact는 `(personId, key)` 쌍이 unique. 같은 카테고리에서 새 정보 들어오면 갱신:

```typescript
// "티뉴 알러지: 떡볶이" → 나중에 "티뉴 알러지: 견과류"
// → 떡볶이가 견과류로 갱신, 중복 row 안 생김
```

Dexie `[personId+key]` 복합 인덱스로 O(log n) 조회.

### 3. Local embedding으로 비용 + 프라이버시 동시 해결

OpenAI/Voyage 임베딩 API 쓰면 메시지 데이터가 또 다른 외부에 나간다. transformers.js로 브라우저 로컬 실행하면:

- **비용**: $0 (Anthropic 채팅 비용만 남음)
- **프라이버시**: 임베딩 = 의미 표현, 외부에 안 나가면 검색용 벡터가 누구에게도 안 보임
- **트레이드오프**: 첫 로드 시 ~32MB 모델 다운로드 (이후 IndexedDB 캐시)

### 4. BYOK as architecture, not feature

사용자 API 키가 브라우저 localStorage에만 산다. 우린 키를 절대 만질 수 없다. 이건 단순 기능이 아니라 **백엔드 부재**의 자연스러운 결과 — 중앙 집중형 키 보관 자체가 불가능하다.

### 5. Fire-and-forget 백그라운드 워크

```typescript
const reply = await callStreaming(...)  // user-visible work — await
setMessages(...)                         // UX update

// background — fire and forget
saveEpisode(user, reply).catch((e) => console.warn('episode 저장 실패:', e))
extractFromMessage(user)
  .then(({ inserted, updated }) => {
    if (inserted + updated > 0) setToast(`🔖 추가됨`)
  })
  .catch((e) => console.warn('extractor 실패:', e))
```

`await` 없이 background promise. UX는 결코 메모리 쓰기를 기다리지 않는다.

### 6. Streaming은 "기다림"을 "관찰"로 바꾼다

API 응답이 같은 5초여도 토큰이 즉시 보이기 시작하면 체감 속도 완전히 다르다. 다이제스트는 더 강력 — 응답이 JSON이라 부분 응답에서 정규식으로 화제 제목 뽑아 실시간 표시:

```typescript
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

미완성 JSON이어도 완성된 `"title": "..."` 쌍은 잡혀. 화제가 하나씩 fade-in으로 나타남.

### 7. PWA without plugins

`vite-plugin-pwa` 안 쓰고 직접 manifest + service worker 작성. 100줄 미만으로 끝남:

- `public/manifest.webmanifest` (앱 메타데이터)
- `public/sw.js` (stale-while-revalidate, api.anthropic.com 제외)
- `public/404.html` (GitHub Pages SPA fallback)
- `index.html`에 inline restoration script

서비스 워커는 navigation 요청에 cached shell을 즉시 반환 → SPA 새로고침 0 latency + 오프라인 동작. api.anthropic.com 응답은 절대 캐시하지 않음 (인증 + 동적).

---

## Privacy & 데이터 소유권

| 항목 | 처리 방식 |
|---|---|
| 채팅 메시지 | IndexedDB (사용자 브라우저) + Anthropic API 호출 시 일시 전송 |
| 사람·사실·일화 | IndexedDB only, 외부 전송 없음 |
| 임베딩 벡터 | 브라우저에서 생성, IndexedDB 저장. 외부 전송 없음 |
| API 키 | localStorage (사용자 브라우저). 우리 코드 내부 함수만 접근 |
| 백업 파일 | PBKDF2 (100K iter) + AES-GCM 256-bit. 비밀번호 잃으면 복구 불가 |
| 다이제스트 입력 | Anthropic API 호출 시 일시 전송, 결과만 화면에 표시 (저장 안 함) |
| 분석 / 트래킹 | 없음 |

⚠️ **솔직한 한계**: 채팅 메시지·다이제스트 입력은 Anthropic API에 전송된다 ([Anthropic 데이터 정책](https://www.anthropic.com/privacy) 적용). 완전 로컬 LLM 채팅은 향후 과제.

---

## Tech stack

| 영역 | 선택 | 이유 |
|---|---|---|
| Build | Vite | 빠른 dev, 간단한 정적 빌드, GH Pages 친화 |
| UI | React 18 + TypeScript | 익숙함, 타입 안정성 |
| Styling | Tailwind v4 | 낮은 설정 부담, paper/ink 디자인 토큰 |
| Storage | IndexedDB via Dexie | 브라우저 기본 NoSQL, 큰 용량, 트랜잭션 |
| Chat LLM | Anthropic Claude Haiku 4.5 | 한국어 품질 + 가성비, streaming 지원 |
| Fact extraction LLM | 같은 Haiku 4.5 | 단일 키 운영 |
| Embedding | @xenova/transformers + multilingual-e5-small | 한국어 retrieval 충분, 양자화 후 32MB |
| Email parsing | postal-mime | .eml 카톡 export 처리 |
| Crypto | Web Crypto API | 브라우저 native, 외부 lib 없음 |
| PWA | manifest + sw.js (no plugin) | 의존성 zero, 투명 |
| Hosting | GitHub Pages | 무료, public, 자동 배포 |

---

## 비용

운영 비용 (사용자당, 2026-05 기준):

```
chat 1회 (streaming):     ~500 input + ~300 output tokens
fact extraction 1회:      ~500 input + ~150 output tokens
다이제스트 1회 (큰 대화):  ~30k input + ~1k output tokens
embed:                    $0 (브라우저 로컬)

Claude Haiku 4.5 가격대 가정 (변동 가능):
chat / extraction:  ~$0.0008~0.0014 / 호출
digest:             ~$0.03 / 호출

하루 30개 메시지 사용자: ~$0.04/day = 약 $1.2/month
하루 100개 + 주 1회 다이제스트: ~$4~5/month
```

인프라 비용: **$0** (정적 호스팅 + BYOK).

---

## 프로젝트 구조

```
src/
├── App.tsx                  # 라우터 + 네비
├── main.tsx                 # React entry, ErrorBoundary, SW 등록
├── index.css                # Tailwind + 디자인 토큰 (paper/ink)
│
├── db/
│   └── schema.ts            # Dexie: people / facts / episodes / messages
│
├── lib/
│   ├── anthropic.ts         # Claude 클라이언트 (BYOK) — chat / callJson / callStreaming
│   ├── context.ts           # System prompt 빌더 (사람 + facts + 관련 episodes)
│   ├── extractor.ts         # Fact extractor (Claude → JSON → upsert)
│   ├── validator.ts         # Hard-constraint 검증 (iq-blogger pattern)
│   ├── embedder.ts          # transformers.js 싱글톤 (dynamic import)
│   ├── retriever.ts         # Cosine similarity 검색 + episode 저장
│   ├── summarizer.ts        # 다이제스트: streaming + 부분 JSON 추출
│   ├── ical.ts              # 생일 .ics 생성
│   ├── backup.ts            # PBKDF2 + AES-GCM 암호화 백업
│   └── kakao.ts             # 카톡 .txt/.eml 파서 + bulk import
│
├── components/
│   ├── ApiKeyGate.tsx       # API 키 없으면 /settings 리다이렉트
│   ├── ErrorBoundary.tsx    # 에러 시 빈 화면 대신 진단 표시
│   ├── FileDropZone.tsx     # 재사용 파일 업로드 (드래그+클릭)
│   ├── InstallHint.tsx      # PWA 설치 안내 (iOS/Android/desktop 분기)
│   └── digest.tsx           # 공유 다이제스트 UI (ProgressDisplay, DigestResult)
│
└── pages/
    ├── Home.tsx             # 홈 대시보드 (카운터, 기념일, 최근 facts, 주간 다이제스트)
    ├── Chat.tsx             # 채팅 (streaming + 임베딩 preload + toast)
    ├── People.tsx           # Person CRUD + facts 표시 + 개별 삭제
    ├── Digest.tsx           # 긴 대화 요약 (paste/file → 구조화된 결과)
    ├── Settings.tsx         # API 키 입력 / 삭제 + PWA 설치 안내
    └── Data.tsx             # 기념일 + 백업 + 카톡 import (3 카드)

public/
├── manifest.webmanifest     # PWA 메타데이터
├── sw.js                    # Service worker (stale-while-revalidate + SPA navigation)
├── 404.html                 # GitHub Pages SPA fallback (redirect script)
├── icon-192.png             # PWA 아이콘 (192×192)
├── icon-512.png             # PWA 아이콘 (512×512)
├── icon-maskable-512.png    # Android adaptive 아이콘
└── apple-touch-icon.png     # iOS 홈 화면 아이콘 (180×180)

scripts/
└── generate-icons.py        # PIL로 아이콘 PNG 생성 (paper bg + italic 'd')

.github/workflows/
└── deploy.yml               # Push to main → 자동 빌드 → GitHub Pages 배포
```

---

## 로드맵

**완료**

- ✅ **Day 1**: Storage + 기본 채팅 + Person CRUD + 자동 배포
- ✅ **Day 2**: System prompt에 사람 정보 주입 + Fact extraction + Hard-constraint validator
- ✅ **Day 3**: Episode embedding (multilingual-e5-small) + RAG retrieval + ErrorBoundary
- ✅ **Day 4**: 기념일 .ics + 암호화 백업/복원 + 카톡 .txt/.eml import + UX 다듬기
- ✅ **Day 5**: 다이제스트 — 긴 대화에서 핵심 추출 (주요 화제, 결정, 액션 아이템, 인용, 분위기, 참여자별 요약)
- ✅ **Day 6**: 채팅 streaming — 토큰별 즉시 표시 + 다이제스트 streaming + 진행 상황 시각화
- ✅ **Day 7**: 홈 대시보드 — 카운터, 다가오는 기념일, 최근 추출된 facts, 이번 주 다이제스트
- ✅ **Day 8**: PWA + SPA fallback — manifest, service worker, 홈 화면 추가, 오프라인 기본 동작, GitHub Pages 새로고침 404 우회

**Dogfooding 페이즈 (현재)**

코어 시스템 feature-complete. 매일 사용하면서 다음을 측정:
- Fact extraction precision (잘못된 fact 비율, 목표: > 80%)
- Retrieval relevance (RAG로 가져온 episode가 진짜 관련 있는가, 목표: > 60%)
- Action rate (받은 조언 중 행동에 옮긴 것, 목표: > 30%)
- 사용 빈도 (매일 펴는가)

**검토 중 (Day 9+)**

- Person 상세 페이지 (한 사람의 모든 episode 타임라인)
- 검색 (전체 메시지·일화 키워드/의미 검색)
- 온보딩 플로우 (첫 사용자 가이드)
- 음성 입력 (감정 토로용)
- 다이제스트를 episode로 저장 (요약된 메모리)
- 로컬 LLM 옵션 (전체 오프라인, 채팅까지 로컬)

---

## Saga-Tales 맥락

이 프로젝트는 [Saga-Tales](https://github.com/Saga-Tales) venture studio의 **첫 번째 tale**.

Vibe-coding 방법론의 검증 과제:
- **사이즈**: 6일 안에 끝남 ✓
- **공개 가능**: 코드와 라이브 사이트 공개 ✓
- **Dogfoodable**: 만든 사람이 매일 쓸 수 있는가 → 검증 중
- **측정 가능**: 결과를 정량/정성적으로 평가할 수 있는가 → metric 정의 후 검증 중

Promotion ceremony 후보로 제출 예정.

### 빌드 과정에서 배운 것

1. **MVP는 layered하게 쌓아라.** Day 1 = pure storage, Day 2 = semantic, Day 3 = episodic. 한 번에 다 짜려 했으면 첫 주에 갇혔을 것.
2. **Hard-constraint validator는 LLM 시대의 필수.** LLM이 항상 정상 작동한다고 가정하지 말고, 결과를 deterministic 코드로 검증하는 레이어가 항상 필요하다.
3. **로컬 임베딩은 진짜 가능하다.** transformers.js + 양자화 모델이면 충분히 production-grade. 비용 zero, 프라이버시 자동 해결.
4. **Fire-and-forget이 UX의 핵심.** AI 기능은 종종 느리다 (수 초~수 분). 사용자를 기다리게 하지 않는 비동기 구조가 결정적.
5. **BYOK는 architecture로 봐야 한다.** 단순 "사용자 키 입력 받기" 기능이 아니라, 백엔드 부재의 자연스러운 귀결로서 설계되어야 신뢰가 작동.
6. **Streaming은 "기다림"을 "관찰"로 바꾼다.** API 응답이 같은 5초여도 토큰이 즉시 보이기 시작하면 체감 속도가 완전히 다르다. 부분 JSON에서 정규식으로 부분 결과 뽑아 보여주는 패턴은 일반화 가능.
7. **PWA는 vite-plugin-pwa 없이도 가능.** manifest.webmanifest + sw.js + main.tsx에서 register — 100줄 미만. 의존성 추가 + 빌드 복잡도 트레이드오프 안 해도 됨.
8. **Static SPA 호스팅은 404 fallback이 필수.** GitHub Pages는 client-side routing을 모른다. `404.html` redirect + `index.html` restoration script (rafgraph/spa-github-pages 패턴)으로 해결. SW navigation handler가 더 빠른 경로 제공.

---

## 만든 사람

- **한동희 (IQ)** — 설계, 구현, dogfooding
- **보욱 (BW)** — Saga-Tales 공동 창업, dogfooding partner

## Acknowledgments

- **Anthropic** — Claude API
- **Xenova / Hugging Face** — transformers.js, multilingual-e5
- **Dexie** — IndexedDB wrapper
- **postal-mime** — .eml 파싱
- **rafgraph/spa-github-pages** — SPA fallback 패턴
- **iq-blogger** — Hard-constraint validator 패턴의 출처

## License

MIT — 자유롭게 fork, 수정, 배포 가능.
