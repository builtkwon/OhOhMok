# AGENTS.md

OhOhMok: 빌드 없는 정적 오목 사이트(ZESTMOK에서 분리). 이 파일은 역할·소유·작업 흐름의 진입점이다. 규칙 표현과 이음새 목록은 [docs/rules/README.md](docs/rules/README.md), 결정 기록은 [docs/adr/](docs/adr/).

## 역할과 소유(owns)

| 역할 | 쓰기 가능 | 비고 |
| --- | --- | --- |
| profile-dev | `profile.js`, `tests/profile.test.js`, `vendor/mediapipe/**` | Google 로그인·사진 돌. 설계 [docs/profile-stones.md](docs/profile-stones.md) |
| room-dev | `room.js`, `team.js`, `clock.js`, `tests/team.test.js`, `tests/team.e2e.mjs`, `vendor/**`(`vendor/mediapipe/**` 제외) | 방 프로토콜·시계·아바타 전달 메시지 |
| ui-dev | `app.js`, `style.css`, `index.html`, `img/**`, `tests/ui.e2e.mjs` | 화면·입력·레이아웃 |
| ai-dev | `ai.js`(동기화로만), `tests/ai.test.js`, `tests/duel*.js`, `tests/analyze-losses.js`, `tests/ladder.js`, `docs/boss-ai.md` | [ADR 0001](docs/adr/0001-ohohmok-repo-split.md) 동기화 규칙 |
| integrator | `AGENTS.md`, `CLAUDE.md`, `README.md`, `TODO-CONTRACT.md`, `docs/**`(boss-ai.md 제외), `.claude/**`, `package.json`, `.gitignore` | 계약 반영·병합. 분할 작업(아래)도 맡음 |
| reviewer | 없음(읽기 전용) | 독립 리뷰 |

- 소유 밖 파일과 이음새(메시지·저장 키·CSS 변수·DOM id·전역 함수)는 직접 고치지 않고 [TODO-CONTRACT.md](TODO-CONTRACT.md)에 제안한다.
- 분할(계획 2단계): `index.html`을 `room.js`·`clock.js`·`app.js`·`style.css`로 나누는 일은 integrator가 마쳤다(브랜치 `refactor/split-default-stones`, 기본 돌 교체·`ohohmok-` 키 포함). 이제 위 표대로 소유가 나뉜다. 모듈 간 전역·DOM id: [docs/rules/README.md#이음새](docs/rules/README.md#이음새).

## 작업 흐름

1. `main`에서 직접 작업하지 않는다. 브랜치(역할별 worktree 허용) → PR → `gh pr merge --merge`(머지 커밋).
2. 머지 전 README 갱신(기능·규칙·테스트 명령이 바뀌면 필수). 바뀐 것이 없으면 PR 본문에 "README 확인, 변경 없음".
3. 머지 후 원격 브랜치 삭제. 원격에는 `main`만 남긴다.
4. 배포는 `main` 머지 시 GitHub Pages 자동 반영. 확인: `gh api repos/builtkwon/OhOhMok/pages/builds/latest`.
5. 완료 보고에는 실제로 실행한 명령·결과와 미검증 범위를 쓴다(verify-and-report).

스킬 목록: [.claude/skills/INDEX.md](.claude/skills/INDEX.md)(손으로 관리). 에이전트 정의: `.claude/agents/`.

## 검증 명령

| 목적 | 명령 | 언제 |
| --- | --- | --- |
| 단위(AI·방/시계) | `npm test` | 항상 |
| UI(Playwright, 로컬) | `npm run test:ui` | 화면·입력·레이아웃 변경 |
| 방 E2E(인터넷 필요) | `npm run test:team` | 방·네트워크·시계 변경 |
| AI 세기(수동, 느림) | `node tests/duel.js` 외 | [docs/boss-ai.md](docs/boss-ai.md) |
