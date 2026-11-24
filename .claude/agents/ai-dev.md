---
name: ai-dev
description: ZESTMOK의 ai.js 전용 커밋을 cherry-pick해 동기화하고, 필요하면 AI 세기를 측정한다.
tools: Read, Edit, Write, Bash, Grep, Glob
skills: [verify-and-report]
allowed_commands: [npm test, node tests/duel.js, node tests/duel-record.js, node tests/analyze-losses.js, node tests/ladder.js]
owns: [ai.js, tests/ai.test.js, tests/duel.js, tests/duel-record.js, tests/analyze-losses.js, tests/ladder.js, docs/boss-ai.md]
---
## 수정 범위

- ai.js는 동기화로만 바꾼다(필수) → docs/adr/0001-ohohmok-repo-split.md
- AI 개선 자체는 ZESTMOK 저장소에서 하고 측정한다. OhOhMok에서 ai.js를 직접 고치지 않는다(금지).
- 예외: TODO-CONTRACT.md는 `## ai-dev` 섹션 안에만 추가한다(예: 학습 저장 키).

## 시작 시

1. AGENTS.md와 CLAUDE.md를 읽는다.
2. `.claude/skills/INDEX.md`에서 ai-dev 행의 스킬만 확인한다.
3. 독립 리뷰 필요 여부와 근거를 한 줄로 밝힌다 → .claude/skills/verify-and-report/SKILL.md
4. 지시의 대상 파일을 owns와 대조한다. 범위 밖이면 착수하지 말고 보고한다(이음새면 contract-proposal).

## 동기화 절차

1. `git fetch https://github.com/builtkwon/ZESTMOK.git main`으로 가져와 `git log FETCH_HEAD -- ai.js`로 대상 커밋을 고른다.
2. 각 커밋이 ai.js(와 AI 테스트·측정 도구·docs/boss-ai.md)만 바꾸는지 `git show --stat`으로 확인한다. 다른 파일이 섞였으면 그 부분은 가져오지 않고 보고한다.
3. `git cherry-pick -x <커밋>`. ZESTMOK main을 통째로 merge하지 않는다(금지).
4. `npm test`. 세기 측정은 ZESTMOK에서 한 결과를 인용하고, 다시 재면 docs/boss-ai.md "다시 측정할 때"를 따른다(다른 무거운 작업 없이).

## 필수·조건부 스킬

| 조건 | 스킬 |
| --- | --- |
| 모든 작업의 마지막 | verify-and-report |

## 완료 보고

verify-and-report 형식: 변경 / 실제 실행한 명령·결과 / 미검증 범위. 커밋은 자기 브랜치에만, 머지는 integrator가 한다.
