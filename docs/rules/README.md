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

- 방 메시지(`type`): `hello`, `team`, `move`, `ping`(G→H) · `snap`, `reject`, `ping`(H→G). 시계는 `snap` 안 `clock`.
- 저장 키: localStorage `zestmok-level`, `zestmok-mem-<난이도>`, sessionStorage `zestmok-tid` → `ohohmok-` 전환은 [ADR 0001](../adr/0001-ohohmok-repo-split.md).
- PeerJS 방 id 접두사 `zestmok-team-`: 바꾸면 ZESTMOK과 방이 갈린다(미정).
- CSS 변수: `index.html`의 `:root`(분할 후 `style.css`). DOM id·전역 함수: 분할 뒤 모듈 간 참조하는 것.
