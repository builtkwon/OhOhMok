---
name: merge-checklist
description: 역할 브랜치 PR을 main에 병합할 때 쓴다. 완료 보고 확인, 테스트 재실행, README 최신화, gh pr merge --merge, 원격 브랜치 삭제와 배포 확인 뒤 verify-and-report로 이어간다.
---
## MUST

- 병합 대상마다 완료 보고(실행 명령·결과·미검증 범위)가 있어야 한다. 없으면 병합하지 않고 보고한다.
- 병합은 `gh pr merge --merge`(머지 커밋)만. squash·rebase 금지. main에 직접 push 금지.
- 병합 전에 README를 최신화한다(S4). 병합 뒤 원격 브랜치를 지워 원격에는 `main`만 남긴다(S6).
- ai.js가 바뀐 PR은 ZESTMOK 커밋의 cherry-pick(`-x` 표시)인지 확인한다. 아니면 병합하지 않는다 → docs/adr/0001-ohohmok-repo-split.md

## 단계

- S1 보고 확인: 완료 보고·미검증 범위, 남은 TODO-CONTRACT 항목, 소유 밖 파일 변경 여부(`git diff --stat main...`)를 본다.
- S2 충돌·순서: 같은 이음새를 건드린 PR이 여럿이면 계약 반영 PR을 먼저 병합하고 나머지를 main 위로 다시 맞추게 한다.
- S3 재실행: `npm test`, `npm run test:ui`, 방·시계 변경이면 `npm run test:team`.
- S4 README(병합 전): 기능·규칙·테스트 명령이 바뀌었으면 그 브랜치에서 README를 고친다. 없으면 PR 본문에 "README 확인, 변경 없음".
- S5 병합: `gh pr merge <번호> --merge`.
- S6 정리: 원격 브랜치 삭제(`git push origin --delete <브랜치>`, 이미 지워졌으면 생략), 로컬은 `git branch -d`. worktree면 `git worktree remove`.
- S7 배포 확인: `gh api repos/builtkwon/OhOhMok/pages/builds/latest`의 status가 `built`인지 본다.
- S8 verify-and-report로 이어간다.
