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
| [docs/profile-stones.md](../profile-stones.md) | 사진 돌 설계 |

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

- 방 메시지(`type`): `hello`, `team`, `move`, `ping`, `avatar {src}`, `vote-start {kind}`, `vote-reply {ok}`(G→H) · `snap`, `reject`, `ping`, `avatar {id, src}`, `vote`(H→G). 시계는 `snap` 안 `clock`, 제안 횟수는 `offers`, `result.reason`은 `five`·`time`·`wipe`·`resign`·`agreed`. 형식: [docs/team-mode.md#메시지](../team-mode.md#메시지).
- 저장 키: localStorage `ohohmok-level`, `ohohmok-mem-<난이도>`, sessionStorage `ohohmok-tid`, 사진 `ohohmok-profile`·`ohohmok-hide-avatars`(profile.js), 테마 `ohohmok-theme`(`light`/`dark`, index.html `<head>`·app.js). 첫 실행 때 ZESTMOK의 `zestmok-level`·`zestmok-mem-*`를 새 키가 없을 때만 복사하고 옛 키는 지우지 않는다(`app.js`, [ADR 0001](../adr/0001-ohohmok-repo-split.md)).
- PeerJS 방 id 접두사 `ohohmok-team-`(`room.js` `TEAM_PREFIX`): ZESTMOK(`zestmok-team-`)과 방이 섞이지 않는다.
- CSS 변수: `style.css`의 `:root`. 돌: 색 `--stone-black`/`--stone-white`, 사진 `--stone-black-img`/`--stone-white-img`(기본 없음, [profile-stones.md §1](../profile-stones.md)). 테마: `--accent`(`--accent-rgb`, `--accent-light`), `--modal-bg`, `--inset-bg`, `--scrim`, `--danger`, 라이트 값은 `:root[data-theme="light"]`. room.js가 색을 쓸 때도 이 토큰을 쓴다.

### 스크립트와 전역

`index.html`이 classic `<script>`로 순서대로 읽는다(모듈 아님 → 최상위 `function`·`let`·`const`가 모두 전역). 순서: `vendor/peerjs.min.js` → `ai.js` → `team.js` → `profile.js` → `clock.js` → `room.js` → `app.js`. `clock.js`·`room.js`는 선언만 하고(시계 `setInterval` 제외), 실행은 `app.js` 끝 Init에서 시작한다(필수: 새 최상위 실행 코드는 `app.js`에).

| 제공 | 쓰는 곳 | 이름 |
| --- | --- | --- |
| `ai.js` | app.js | `GomokuAI` |
| `team.js` | clock.js, room.js, profile.js, app.js(`bestWindow`·`noMoves`·`VOTE_MAX`) | `TeamLogic` |
| `profile.js` | app.js, room.js | `Profile` ([profile-stones.md §6.1](../profile-stones.md)) |
| `clock.js` | room.js | `CLK`, `clockStart`, `clockStop`, `clockMove`, `clockDraw` |
| `clock.js` | app.js | `clockStart`, `clockStop`, `clockMove`, `timeUp` |
| `room.js` | clock.js | `TM`, `tmHostTimeUp` |
| `room.js` | app.js | `TM`, `tmMe`, `tmVoteStart`, `myTurn`, `myStoneColor`, `tmMyTurn`, `tmTurnText`, `tmSend`, `tmHostMove`, `tmShowEnd`, `tmRematch`, `tmLeave`, `teamEntry`, `teamBack`, `teamJoin` |
| `app.js` | clock.js | 상태 `gameMode`, `gameOver`, `currentPlayer`, `humanPlayer`, `aiPlayer`, `aiThinking`, `scores` · 함수 `announce`, `updateScores`, `updateTurn`, `showEndOverlay` |
| `app.js` | room.js | 상태 `board`, `gameMode`, `gameOver`, `currentPlayer`, `humanPlayer`, `scores`, `lastPlaced`, `winningCells`, `RULE`, `BOARD_SIZE`, `stonesLayer` · 함수 `flashTurn`, `initBoard`, `isForbidden`, `checkWin`, `addStoneElement`, `refreshStones`, `coordName`, `ruleName`, `announce`, `updateScores`, `updateTurn`, `showOverlay`, `hideOverlay`, `closeOverlay`, `resultTitle`, `showEndOverlay`, `showDrawOverlay` |

`index.html`의 인라인 `onclick`이 부르는 전역: room.js `teamCreate`, `teamJoin`, `teamPick`, `teamStart`, `teamBack`, `copyTeamCode`, `tmVoteReply` · app.js `offerDraw`, `resign`, `selectMode`, `selectRule`, `ruleBack`, `setLevel`, `selectColor`, `newGame`, `rematch`, `resetScore`, `closeOverlay`, `toggleTheme`, `toggleProfileMenu`, `profileLogin`, `profileUpload` · profile.js `Profile.clearUpload`, `Profile.setHideOthers`.

### 여러 모듈이 만지는 DOM id

- 결과 창 `overlay`, `modal-stone`, `modal-winner`, `modal-sub`: app.js(AI)·room.js(`tmShowEnd`)
- 무승부·항복 `game-actions`, `draw-btn`, `resign-btn`: app.js만. 투표 창 `vote-box`, `vote-text`, `vote-btns`: room.js만
- 연결 표시 `conn-status`: room.js가 켜고 app.js가 끔(`conn-dot`, `conn-text`는 room.js만)
- 방 코드 입력 `team-code`: room.js가 읽고 app.js가 Enter 키를 붙임
- 시계 `clock-1`, `clock-2`: clock.js만 씀
- 헤더 `theme-btn`, `profile-*`, `pm-*`(프로필 메뉴, `pm-gsi`는 Google 버튼 자리): app.js
- 그 밖의 `team-*`, `tv-*`, `tl1/2`, `tb1/2`는 room.js, 판·패널 id(`board-*`, `stones-layer`, `ghost-stone`, `kb-cursor`, `name-*`, `label-*`, `score-*`, `card-*`, `turn-*`, `sr-live`, `choice-*`)는 app.js 전용
