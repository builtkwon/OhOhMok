# OhOhMok — 작업 규칙 (다른 PC/세션 공용)

정적 사이트(빌드 없음). `index.html`(마크업) + `style.css` + `app.js`(게임·UI) + `room.js`(방) + `clock.js`(시계) + `ai.js`(AI) + `team.js`(방·시계 순수 로직). classic `<script>` 순서는 [docs/rules/README.md#이음새](docs/rules/README.md#이음새). ZESTMOK(https://github.com/builtkwon/ZESTMOK)에서 분리한 저장소이고 ZESTMOK은 따로 계속 서비스한다. 설명은 `README.md`, 설계·측정 기록은 `docs/`, 역할·소유·스킬은 [AGENTS.md](AGENTS.md).

## 워크플로
- main에서 직접 작업하지 말고 브랜치 → PR → `gh pr merge --merge`(머지 커밋 방식).
- **머지 전 README 갱신** (기능·규칙·테스트 명령이 바뀌면 반드시).
- 머지 후 원격 브랜치 삭제 — **원격에는 `main`만 유지**.
- 배포 = `main` 머지 시 GitHub Pages 자동 반영 (https://builtkwon.github.io/OhOhMok/). 확인: `gh api repos/builtkwon/OhOhMok/pages/builds/latest`.
- 역할 사이 이음새(방 메시지·저장 키·CSS 변수·DOM id) 변경은 `TODO-CONTRACT.md`로 제안.

## ai.js 동기화 ([ADR 0001](docs/adr/0001-ohohmok-repo-split.md))
- ai.js 변경은 ZESTMOK에 먼저 들어가고, OhOhMok은 그 ai.js 전용 커밋만 cherry-pick.
- ZESTMOK main을 통째로 merge하지 않음. OhOhMok에서 ai.js는 동기화로만 수정.
- localStorage는 ZESTMOK과 같은 출처(`builtkwon.github.io`) → OhOhMok 키는 `ohohmok-` 접두사(옛 레벨·AI 학습 데이터는 새 키가 없을 때 복사).

## 테스트
- `npm test` (AI·방/시계 단위) — 항상
- `npm run test:ui` (Playwright, 로컬) — UI 바꾸면
- `npm run test:team` (인터넷 필요, PeerJS 공용 브로커) — 방/네트워크/시계 바꾸면
- AI 세기: `tests/duel.js`, `tests/duel-record.js`, `tests/analyze-losses.js` (수동, 느림). 방법·과거 결과·검토 대기 안: `docs/boss-ai.md`

## 알아둘 것
- 한국식 금수(흑 3-3·장목 금지)는 모든 모드 공통. AI 내부 규칙 플래그는 `bestMove` 호출마다 `koreanBlack`로 설정됨.
- 보스(원준)는 질 게 확실하면 상을 한 번 엎음(`move.doomed`) → AI 1패로 학습 후 AI 흑으로 재시작.
- AI 대전 시간 제한은 사람만 계산 (보스는 한 수 5초를 넘길 수 있음).
