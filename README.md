# tale-01-personal-diary-iq

> 너의 사적인 일기 에이전트.
> 모든 데이터는 너의 브라우저에만 산다.

Saga-Tales의 첫 번째 tale. Local-first AI 에이전트로, 중요한 사람들에 대한 정보를 기억하고 맥락 기반의 조언을 제공하는 개인용 다이어리.

## Architecture

- **Frontend**: Vite + React + TypeScript + Tailwind v4
- **Storage**: IndexedDB (via Dexie) — 모든 데이터는 사용자 브라우저에만 저장됨
- **LLM**: Anthropic API direct call (BYOK — bring your own key)
- **Deploy**: GitHub Pages (static, free)
- **Cost**: $0 인프라 비용

## Local Development

```bash
pnpm install
pnpm dev
```

`http://localhost:5173` 에서 확인.

## Deploy

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 + 배포.
GitHub repo Settings → Pages → Source를 `GitHub Actions`로 설정해야 함.

## Roadmap

- **Day 1** (✓): IndexedDB 스키마 + 기본 채팅 + Person CRUD + 자동 배포
- **Day 2** (✓): Person 정보를 system prompt에 자동 주입 + Fact extraction (validator + upsert)
- **Day 3**: Episode embedding (transformers.js, 로컬 실행) + RAG retrieval
- **Day 4+**: 기념일 리마인더 (iCal export), 암호화된 백업/복원, 카톡 import
