---
name: tdd-rule
description: 순수 로직(team.js의 순번·시작 조건·승계·시계, profile.js의 검증·변환)을 만들거나 고칠 때 쓴다. 실패 테스트를 먼저 쓰고 구현한 뒤 verify-and-report로 이어간다.
---
## MUST

- 테스트를 구현보다 먼저 쓰고, 실패를 확인한 뒤 구현한다.
- 순수 로직은 DOM·PeerJS·localStorage·실제 타이머를 쓰지 않는다. 시간은 인자(ms 값)로 받는다.
- 테스트는 Node 내장만 쓴다(`tests/team.test.js` 형식: `assert`). 새 테스트 파일은 `npm test`에 넣도록 integrator에 제안한다(package.json은 integrator 소유).
- 규칙이 문서(README·docs/team-mode.md·docs/profile-stones.md)에 없거나 모호하면 구현을 멈추고 사용자에게 올린다.

## 단계

- S1 규칙 확인: 구현할 규칙을 문서에서 찾아 정상·실패·경계값 케이스로 옮긴다.
  - 예시: 팀 1~3명, 이탈 10초 유예, 초읽기 30초×3회, 속기 한 수 초과 즉시 패배, 금수(흑 3-3·장목).
- S2 실패 확인: 테스트를 쓰고 `npm test`로 새 테스트가 실패하는지 본다.
- S3 구현: 통과할 만큼만 구현하고 `npm test`로 통과를 본다.
  - 화면·방 연결이 필요하면 그 부분은 소유 역할 몫(contract-proposal).
- S4 verify-and-report로 이어간다(방장 검증·시계 변경이면 독립 리뷰 조건 해당).
