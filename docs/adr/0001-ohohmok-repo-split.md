# 0001. OhOhMok을 별도 저장소로 분리

- 상태: 채택
- 날짜: 2026-11-24

## 배경

ZESTMOK(https://builtkwon.github.io/ZESTMOK/)은 그대로 서비스하면서, 로그인·사진 돌 등 큰 변경을 할 새 사이트가 필요하다. AI(`ai.js`)는 두 사이트가 같이 쓴다.

## 결정 기준

- ZESTMOK 서비스를 건드리지 않는다.
- 두 사이트의 저장 데이터가 섞이지 않는다.
- AI 개선은 한 곳에서 측정하고 양쪽에 같게 들어간다.

## 검토한 대안

- 포크/브랜치: GitHub Pages는 저장소당 배포 원본이 하나라 두 사이트를 동시에 띄울 수 없다. 탈락.
- 새 저장소(OhOhMok): 배포 https://builtkwon.github.io/OhOhMok/ 를 따로 가진다. 채택.

## 결정

- 저장소: ZESTMOK을 씨앗으로 한 새 저장소 `builtkwon/OhOhMok`. ZESTMOK은 계속 서비스.
- 저장 키: 두 사이트는 같은 `builtkwon.github.io` 출처라 localStorage를 공유한다. OhOhMok은 접두사 `ohohmok-`를 쓴다. 첫 실행 때 한 번만 옛 AI 학습 데이터(`zestmok-mem-*`, `zestmok-level`)를 `ohohmok-`로 복사하고, 옛 키는 지우지 않는다(ZESTMOK이 계속 씀).
- ai.js 동기화(필수):
  - ai.js 변경은 ZESTMOK에 먼저 들어간다(측정 포함, docs/boss-ai.md).
  - OhOhMok은 그 ai.js 전용 커밋만 `git cherry-pick`한다.
  - ZESTMOK main을 통째로 merge하지 않는다(금지).
  - OhOhMok에서 ai.js는 동기화로만 바꾼다(직접 수정 금지).

## 영향

- 키 전환·복사는 분할 직후 구현했다(`app.js`: 새 키가 없을 때만 복사, `ohohmok-tid`는 세션 토큰이라 복사 없음).
- ai.js에 OhOhMok 전용 요구가 생기면 ZESTMOK에 먼저 넣는다.
- PeerJS 방 id 접두사는 `ohohmok-team-`로 정했다(2026-11-24). 두 사이트의 방은 섞이지 않는다(ZESTMOK 방 코드로 OhOhMok에 못 들어감, 반대도 같음).

## 재검토 조건

- ZESTMOK 서비스 종료 시: 동기화 규칙 폐기, ai.js 소유를 OhOhMok으로.
- 두 사이트 ai.js가 갈라져야 할 때.
