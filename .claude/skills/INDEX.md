<!-- 손으로 관리한다(생성기 없음). 스킬·에이전트 frontmatter를 바꾸면 이 표도 같이 고친다(integrator). -->
# 스킬 INDEX

## 스킬

| 스킬 | 설명 | 배치 에이전트 | 명령 | 경로 |
| --- | --- | --- | --- | --- |
| verify-and-report | 작업 마지막에 범위에 맞는 테스트로 검증하고 완료 보고를 쓴다. 독립 리뷰 조건 판정 포함. | profile-dev, room-dev, ui-dev, ai-dev, integrator | `npm test`, `npm run test:ui`, `npm run test:team` | .claude/skills/verify-and-report/SKILL.md |
| contract-proposal | 이음새·owns 밖 변경이 필요할 때 TODO-CONTRACT.md 자기 섹션에 제안만 추가한다. | profile-dev, room-dev, ui-dev | - | .claude/skills/contract-proposal/SKILL.md |
| contract-apply | TODO-CONTRACT.md 제안을 사용자 합의 후 반영하고 항목을 지운다. | integrator | - | .claude/skills/contract-apply/SKILL.md |
| merge-checklist | 역할 브랜치 병합: 보고 확인, 재실행, README, `gh pr merge --merge`, 원격 브랜치 삭제, 배포 확인. | integrator | `npm test`, `npm run test:ui`, `npm run test:team`, `gh` | .claude/skills/merge-checklist/SKILL.md |
| independent-review | 읽기 전용 리뷰: 보고 대조, 재실행, 체크 5항목, 지적 분류. | reviewer | `npm test`, `npm run test:ui`, `npm run test:team` | .claude/skills/independent-review/SKILL.md |
| tdd-rule | team.js·profile.js 순수 로직을 실패 테스트 먼저로 구현한다. | profile-dev, room-dev | `npm test` | .claude/skills/tdd-rule/SKILL.md |
| visual-check | Playwright로 폰·데스크톱 폭 스크린샷을 찍어 보고 대조한다. | ui-dev | `npm run test:ui` | .claude/skills/visual-check/SKILL.md |

## 에이전트

| 에이전트 | 스킬 | 허용 명령 |
| --- | --- | --- |
| profile-dev | verify-and-report, tdd-rule, contract-proposal | `npm test`, `npm run test:ui` |
| room-dev | verify-and-report, tdd-rule, contract-proposal | `npm test`, `npm run test:ui`, `npm run test:team` |
| ui-dev | verify-and-report, visual-check, contract-proposal | `npm test`, `npm run test:ui` |
| ai-dev | verify-and-report | `npm test`, `node tests/duel.js` 외 측정 도구 |
| integrator | verify-and-report, merge-checklist, contract-apply | `npm test`, `npm run test:ui`, `npm run test:team`, `gh` |
| reviewer | independent-review | `npm test`, `npm run test:ui`, `npm run test:team` |
