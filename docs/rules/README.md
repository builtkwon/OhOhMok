# 규칙 목차

규칙은 아래 중 한 곳에만 쓰고, 다른 문서는 링크한다.

| 파일 | 다루는 것 |
| --- | --- |
| [CLAUDE.md](../../CLAUDE.md) | 저장소 공통 작업 규칙, 게임 규칙 요약 |
| [AGENTS.md](../../AGENTS.md) | 역할·소유·작업 흐름·검증 명령 |
| [TODO-CONTRACT.md](../../TODO-CONTRACT.md) | 이음새 변경 제안 절차 |
| [docs/adr/](../adr/) | 되돌리기 어려운 결정 기록([template.md](../adr/template.md), 파일명 `NNNN-제목.md`) |
| [docs/team-mode.md](../team-mode.md) | 방 설계(일부 옛 내용, 상단 변경 메모 우선) |
| [docs/boss-ai.md](../boss-ai.md) | 보스 AI 측정 방법·기록 |
| [docs/profile-stones.md](../profile-stones.md) | 사진 돌 설계(작성 중) |

## 규칙 표현

규칙 문장은 아래 다섯 표현 중 하나로 강도를 밝힌다.

| 표현 | 의미 |
| --- | --- |
| 필수·금지 | 반드시 준수 |
| 기본·우선 | 특별한 이유가 없으면 따름. 다르면 이유 기록 |
| 허용 | 명시한 조건 안에서 자율 |
| 예시 | 설명용 |
| 미정 | 필요 시 합의. 임의 확정 금지 |

## 이음새

모듈 사이에 걸친 이름이다. 바꾸려면 TODO-CONTRACT.md로 제안한다(필수).

- 방 메시지(`type`): `hello`, `team`, `move`, `ping`(G→H) · `snap`, `reject`, `ping`(H→G). 시계는 `snap` 안 `clock`. 형식: [docs/team-mode.md#메시지](../team-mode.md#메시지).
- 저장 키: localStorage `zestmok-level`, `zestmok-mem-<난이도>`, sessionStorage `zestmok-tid` → `ohohmok-` 전환은 [ADR 0001](../adr/0001-ohohmok-repo-split.md).
- PeerJS 방 id 접두사 `zestmok-team-`: 바꾸면 ZESTMOK과 방이 갈린다(미정).
- CSS 변수: `style.css`의 `:root`.

### 스크립트와 전역

`index.html`이 classic `<script>`로 순서대로 읽는다(모듈 아님 → 최상위 `function`·`let`·`const`가 모두 전역). 순서: `vendor/peerjs.min.js` → `ai.js` → `team.js` → `clock.js` → `room.js` → `app.js`. `clock.js`·`room.js`는 선언만 하고(시계 `setInterval` 제외), 실행은 `app.js` 끝 Init에서 시작한다(필수: 새 최상위 실행 코드는 `app.js`에).

| 제공 | 쓰는 곳 | 이름 |
| --- | --- | --- |
| `ai.js` | app.js | `GomokuAI` |
| `team.js` | clock.js, room.js | `TeamLogic` |
| `clock.js` | room.js | `CLK`, `clockStart`, `clockStop`, `clockMove`, `clockDraw` |
| `clock.js` | app.js | `clockStart`, `clockStop`, `clockMove`, `timeUp` |
| `room.js` | clock.js | `TM`, `tmHostTimeUp` |
| `room.js` | app.js | `TM`, `myTurn`, `myStoneColor`, `tmMyTurn`, `tmTurnText`, `tmSend`, `tmHostMove`, `tmShowEnd`, `tmRematch`, `tmLeave`, `teamEntry`, `teamBack`, `teamJoin` |
| `app.js` | clock.js | 상태 `gameMode`, `gameOver`, `currentPlayer`, `humanPlayer`, `aiPlayer`, `aiThinking`, `scores` · 함수 `announce`, `updateScores`, `updateTurn`, `showEndOverlay` |
| `app.js` | room.js | 상태 `board`, `gameMode`, `gameOver`, `currentPlayer`, `humanPlayer`, `scores`, `lastPlaced`, `winningCells`, `RULE`, `BOARD_SIZE`, `stonesLayer` · 함수 `initBoard`, `isForbidden`, `checkWin`, `addStoneElement`, `refreshStones`, `coordName`, `ruleName`, `announce`, `updateScores`, `updateTurn`, `showOverlay`, `hideOverlay`, `closeOverlay`, `resultTitle`, `showEndOverlay`, `showDrawOverlay` |

`index.html`의 인라인 `onclick`이 부르는 전역: room.js `teamCreate`, `teamJoin`, `teamPick`, `teamStart`, `teamBack`, `copyTeamCode` · app.js `selectMode`, `selectRule`, `ruleBack`, `setLevel`, `selectColor`, `newGame`, `rematch`, `resetScore`, `closeOverlay`.

### 여러 모듈이 만지는 DOM id

- 결과 창 `overlay`, `modal-stone`, `modal-winner`, `modal-sub`: app.js(AI)·room.js(`tmShowEnd`)
- 연결 표시 `conn-status`: room.js가 켜고 app.js가 끔(`conn-dot`, `conn-text`는 room.js만)
- 방 코드 입력 `team-code`: room.js가 읽고 app.js가 Enter 키를 붙임
- 시계 `clock-1`, `clock-2`: clock.js만 씀
- 그 밖의 `team-*`, `tv-*`, `tl1/2`, `tb1/2`는 room.js, 판·패널 id(`board-*`, `stones-layer`, `ghost-stone`, `kb-cursor`, `name-*`, `label-*`, `score-*`, `card-*`, `turn-*`, `sr-live`, `choice-*`)는 app.js 전용
