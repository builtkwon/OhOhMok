# TODO-CONTRACT

역할 사이 이음새(방 메시지 형식, localStorage·sessionStorage 키, 모듈을 넘나드는 CSS 변수·DOM id·전역 함수) 변경을 제안하는 곳이다. 구현 역할은 이음새를 직접 바꾸지 않고 아래 양식으로 자기 섹션에 항목을 추가한다. integrator가 사용자 합의 후 반영하고 항목을 지운다. 현재 이음새 목록: [docs/rules/README.md#이음새](docs/rules/README.md#이음새)

## 양식

```md
### <짧은 제목>

- 종류: 메시지 / 저장 키 / CSS 변수 / DOM id / 전역 함수
- 제안: <이름과 형식, 예: `avatar {id, url}` H→G>
- 이유: <지금 이음새로 안 되는 점>
- 영향 역할: <profile-dev / room-dev / ui-dev / ai-dev>
- 호환: <옛 클라이언트·저장 데이터가 깨지는지, 대응>
```

## profile-dev

### index.html CSP: 누끼 wasm·Google 로그인·Google 사진 허용

- 종류: 기타(index.html `Content-Security-Policy`, ui-dev 소유)
- 제안: `script-src`에 `'wasm-unsafe-eval' https://accounts.google.com/gsi/client`, `style-src`에 `https://accounts.google.com/gsi/style`, `frame-src https://accounts.google.com/gsi/`, `connect-src`에 `https://accounts.google.com/gsi/`, `img-src`에 `https://lh3.googleusercontent.com` 추가
- 이유: 지금 CSP로는 MediaPipe wasm 컴파일이 막혀 누끼가 늘 원형 크롭으로 떨어진다(Chromium에서 확인: "WebAssembly.instantiateStreaming() … violates the following Content Security Policy"). GIS 스크립트·iframe과 Google 프로필 사진(`lh3`)도 막힌다. 허용만 늘리는 것이라 페이지 로드 때 외부 요청 0은 그대로다.
- 영향 역할: ui-dev
- 호환: 없음(허용 범위만 넓힘)

### profile.js 스크립트 태그

- 종류: 전역 함수(`Profile`)
- 제안: `index.html`에 `<script src="profile.js"></script>`를 `team.js` 다음, `clock.js` 앞에 넣고 docs/rules/README.md 스크립트 순서·전역 표에 `profile.js` → app.js, room.js: `Profile` 추가(§6.1 그대로)
- 이유: profile-dev는 index.html·docs를 못 고친다
- 영향 역할: ui-dev, integrator
- 호환: 없음

### TeamLogic.validAvatar 병합 후 profile.js 대체 검사 삭제

- 종류: 전역 함수(`TeamLogic.validAvatar`)
- 제안: room-dev의 `TeamLogic.validAvatar`가 병합되면 `profile.js`의 `validAvatar` 안 로컬 정규식(`AVATAR`, `shortcut:` 주석 줄)을 지우고 `TeamLogic.validAvatar`만 쓴다. `tests/profile.test.js`의 검증 케이스는 `require('../team.js')`를 먼저 불러 `globalThis.TeamLogic`로 두거나 team.test.js로 옮긴다.
- 이유: 병렬 작업 중이라 아직 없음. 지금은 `TeamLogic.validAvatar`가 있으면 그것을, 없으면 §5와 같은 정규식(≤ 44,000자)을 쓴다.
- 영향 역할: profile-dev, room-dev, integrator
- 호환: 없음

### 로그아웃 때 `name`도 지움

- 종류: 저장 키(`ohohmok-profile`)
- 제안: §3 "로그아웃은 `google`만 지운다"를 "`google`·`name`(Google에서 온 이름)과 Google 사진의 누끼를 지운다. 업로드는 남긴다"로 고친다
- 이유: `name`은 Google 이름이라(§6.1) 로그아웃 뒤 남으면 개인정보가 남는다. 구현은 이렇게 했다. 합의가 다르면 profile.js 한 줄만 바꾸면 된다.
- 영향 역할: profile-dev, ui-dev(방 이름 기본값)
- 호환: 옛 데이터 없음(새 키)

<!-- end:profile-dev -->

## room-dev

<!-- end:room-dev -->

## ui-dev

<!-- end:ui-dev -->

## ai-dev

<!-- end:ai-dev -->
