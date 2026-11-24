# 프로필 사진 돌 (설계)

기본 돌에서 특정 인물 사진(`img/stone-black.jpg`, `img/stone-white.jpg`)을 빼고, 누구나 자기 사진을 돌로 쓰게 한다.
서버 없이 정적 사이트로 동작한다. 로그인은 선택 사항이다.

## 1. 기본 돌 (사진 없음)

- `img/stone-black.jpg`, `img/stone-white.jpg`를 삭제한다. 기본 돌은 CSS 그라디언트로 그린다(외부 요청 0).
- 돌 그림은 CSS 변수 두 개로만 바꾼다. 모든 돌 셀렉터(`.stone`, `.ghost-stone`, `.modal-stone`, `.player-stone`, 돌 선택 버튼)가 이 변수를 쓴다.
  ```css
  :root { --stone-black: radial-gradient(circle at 35% 30%, #666, #111 60%, #000);
          --stone-white: radial-gradient(circle at 35% 30%, #fff, #ddd 60%, #bbb); }
  .stone.black-stone { background-image: var(--stone-black); }
  ```
- 사진을 쓸 때는 JS가 `--stone-black` / `--stone-white`를 `url("...")`로 덮는다. 변수를 지우면 기본 돌로 돌아간다.
- `stoneImgs`의 `getComputedStyle` URL 추출과 돌 선택 `<img>`는 없앤다. 돌 선택 버튼은 `<div>`로 바꾸고 같은 변수를 쓴다.
- 보스(원준) 사진 규칙(`body.boss-*`, rage, win)은 유지한다. 변수보다 우선한다(`!important` 그대로).
- `img/og.png`도 인물 사진이 들어 있어 교체한다(§7).

## 2. 사진 출처 (우선순위)

1. 이 브라우저에 업로드한 사진 (있으면 항상 우선)
2. Google 로그인 프로필 사진
3. 없음 → 기본 돌

- 업로드: `<input type="file" accept="image/*">` → canvas로 가운데 정사각 크롭 → 128px → `image/jpeg` data URL.
  32KB(base64 길이 ≤ 44,000자)를 넘으면 품질을 0.8 → 0.6 → 0.4로 낮춘다. 그래도 넘으면 거절한다.
- Google: GIS(Google Identity Services) ID 토큰의 `picture` 클레임을 쓴다. `=s96-c`를 `=s128-c`로 바꿔 쓴다.
  토큰은 서명 검증 없이 payload만 디코드한다. 표시용 사진·이름에만 쓰고 권한 판단에는 쓰지 않는다.
- GIS 스크립트(`https://accounts.google.com/gsi/client`)는 로그인 버튼을 누를 때만 로드한다. `tests/ui.e2e.mjs`가 외부 요청 0을 검사하기 때문이다.
- 누끼(배경 제거)는 v1에서 하지 않는다. 원형 크롭만 한다(§8 결정 대기).

## 3. 저장 (localStorage, 접두사 `ohohmok-`)

| 키 | 값 |
| --- | --- |
| `ohohmok-profile` | `{name, google: {sub, picture} \| null, upload: dataURL \| null}` |

- 로그아웃은 `google`만 지운다. 업로드는 "사진 지우기"로만 지운다.
- 같은 github.io 출처를 ZESTMOK과 공유하므로 모든 새 키는 `ohohmok-`로 시작한다.
- 기존 `zestmok-*` 키(레벨, AI 학습 `zestmok-mem-*`)는 첫 실행 때 `ohohmok-*`로 한 번 복사한다. 원본은 지우지 않는다(ZESTMOK이 계속 씀).

## 4. 어디에 누구 사진이 붙나

- **AI 대전**: 내가 고른 색에 내 사진. AI 쪽은 기본 돌(보스면 원준 사진).
- **방(팀) 모드**: §8 결정 대기. 추천은 **팀 대표 사진**(각 팀 첫 플레이어). 돌 색당 사진 하나라 CSS 변수 두 개로 끝난다.
  두는 사람별 사진은 칸마다 놓은 사람을 기록해야 해서 보드 상태·snap 메시지가 바뀐다.

## 5. 방 프로토콜: `avatar` 메시지

- guest → host: `{type: 'avatar', src}` (입장 직후, 사진이 바뀔 때)
- host는 검증 후 `TM.players[i].avatar = src`로 저장하고, 모든 guest에게 `{type: 'avatar', id, src}`를 보낸다.
  새로 들어온 guest에게는 아는 사진을 전부 한 번씩 보낸다. 32KB × 4명을 매 snap에 싣지 않으려고 snap에는 넣지 않는다.
- 검증(host와 받는 쪽 모두, 신뢰 경계):
  - `^https://lh3\.googleusercontent\.com/[A-Za-z0-9_\-/=]+$` 또는
  - `^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$` 이고 길이 ≤ 44,000
  - 통과 못 하면 버리고 기본 돌. 이 문자 집합이라 `url("...")`에 넣어도 CSS 주입이 안 된다.
- 검증 함수는 `team.js`(순수 로직)에 두고 `tests/team.test.js`로 테스트한다.

## 6. 파일 배치 (index.html 분리 후)

| 파일 | 담당 | 내용 |
| --- | --- | --- |
| `profile.js` | profile-dev | 업로드 리사이즈, GIS 지연 로드, JWT 디코드, `ohohmok-profile` 저장, `--stone-*` 적용 |
| `team.js` / `room.js` | room-dev | `avatar` 메시지, `validAvatar(src)` |
| `style.css` / `app.js` / `index.html` | ui-dev | 기본 돌 그라디언트, 돌 선택 버튼, 프로필 버튼·메뉴, 사진 숨기기 토글 |

공유 경계(계약): CSS 변수 `--stone-black`/`--stone-white`, 키 `ohohmok-profile`, `avatar` 메시지 모양. 바꾸려면 `TODO-CONTRACT.md`에 제안한다.

## 7. 순서

1. 하네스(문서·에이전트·스킬) — 진행 중
2. `index.html` 분리 + **기본 돌 교체(§1)** — 한 에이전트가 순서대로. 이후 병렬 작업의 공통 바탕이다.
3. 병렬: profile-dev(업로드 먼저, Google은 클라이언트 ID 받은 뒤) / room-dev / ui-dev
4. 통합, `og.png`·타이틀 교체, README 갱신, 배포

## 8. 결정 대기 (사용자)

| 항목 | 추천 |
| --- | --- |
| Google OAuth 클라이언트 ID | 사용자가 발급 (§9) |
| 방 모드 사진 | 팀 대표 사진 |
| 누끼(MediaPipe) | v1 제외. 원형 크롭만 |
| 남의 부적절한 사진 | 받는 쪽 "다른 사람 사진 숨기기" 토글만 (서버가 없어 신고·차단 불가) |
| `og.png`·페이지 제목 | OhOhMok 이름으로 새로 만듦 |

## 9. Google 클라이언트 ID 발급 절차

1. https://console.cloud.google.com 에서 프로젝트를 만든다(예: `ohohmok`).
2. **Google 인증 플랫폼 → 브랜딩(OAuth 동의 화면)**: 사용자 유형 "외부", 앱 이름 `OhOhMok`, 지원 이메일 입력.
   범위는 기본(`openid`, `email`, `profile`)만 쓴다. 민감 범위가 아니어서 Google 검토가 필요 없다.
3. **대상(Audience)**: 게시 상태를 "프로덕션"으로 바꾼다. "테스트"로 두면 등록한 테스트 사용자만 로그인된다.
4. **클라이언트 → 클라이언트 만들기**: 유형 "웹 애플리케이션".
   승인된 JavaScript 원본: `https://builtkwon.github.io`, `http://localhost:8080`. 리디렉션 URI는 비운다.
5. 만들어진 **클라이언트 ID**(`…apps.googleusercontent.com`)를 전달한다. 클라이언트 보안 비밀번호는 필요 없고 전달하지 않는다.

클라이언트 ID는 공개 값이라 `profile.js`에 그대로 넣는다.
