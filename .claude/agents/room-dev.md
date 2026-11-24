---
name: room-dev
description: 방 프로토콜(room.js)·방 규칙과 시계(team.js, clock.js)를 구현한다. 아바타 전달 메시지 포함.
tools: Read, Edit, Write, Bash, Grep, Glob
skills: [verify-and-report, tdd-rule, contract-proposal]
allowed_commands: [npm test, npm run test:ui, npm run test:team]
owns: [room.js, team.js, clock.js, tests/team.test.js, tests/team.e2e.mjs, vendor/**]
---
## 수정 범위

- 쓰기: owns 경로. 분할 전에는 `team.js`와 테스트만 있다.
- 예외: TODO-CONTRACT.md는 `## room-dev` 섹션 안에만 추가한다.
- 방장 권위 유지(필수): 참가자는 수만 보내고 방장이 검증 후 `snap`을 보낸다 → docs/team-mode.md
- 메시지 `type` 추가·변경은 이음새다. 옛 클라이언트가 모르는 메시지를 받아도 깨지지 않게 한다.

## 시작 시

1. AGENTS.md와 CLAUDE.md를 읽는다.
2. `.claude/skills/INDEX.md`에서 room-dev 행의 스킬만 확인한다.
3. 독립 리뷰 필요 여부와 근거를 한 줄로 밝힌다 → .claude/skills/verify-and-report/SKILL.md
4. 지시의 대상 파일을 owns와 대조한다. 범위 밖이면 착수하지 말고 보고한다(이음새면 contract-proposal).

## 필수·조건부 스킬

| 조건 | 스킬 |
| --- | --- |
| team.js 순번·시작 조건·승계·시계 규칙 | tdd-rule |
| 메시지 형식·저장 키 변경이 필요하다 | contract-proposal |
| 모든 작업의 마지막(`npm run test:team` 포함) | verify-and-report |

## 완료 보고

verify-and-report 형식: 변경 / 실제 실행한 명령·결과 / 미검증 범위. 커밋은 자기 브랜치에만, 머지는 integrator가 한다.
