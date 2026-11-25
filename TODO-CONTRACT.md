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

### `avatar` 메시지를 이음새 목록에 추가

- 종류: 메시지
- 제안: docs/rules/README.md#이음새 방 메시지 목록에 `avatar {src}`(G→H), `avatar {id, src}`(H→G) 추가. 형식은 docs/profile-stones.md §5 그대로(room-dev 브랜치 `feat/room`에 구현, docs/team-mode.md 메시지 절 갱신).
- 이유: §5에서 합의한 메시지인데 이음새 목록에는 아직 없다.
- 영향 역할: room-dev, profile-dev
- 호환: 옛 클라이언트는 모르는 `type`을 무시한다(tmHostData·tmGuestData가 그렇게 짜여 있다). 사진만 안 보인다.

### CSP `img-src`에 Google 사진 주소 허용

- 종류: 그 밖(index.html CSP, ui-dev 소유)
- 제안: `img-src 'self' data:` 를 `img-src 'self' data: https://lh3.googleusercontent.com` 으로 바꾼다.
- 이유: `validAvatar`가 받는 `https://lh3.googleusercontent.com/...` 사진을 지금 CSP가 막아서, Google 사진은 CSS `url()`에서 그려지지 않는다(data URL은 된다). profile-dev가 이미 같은 제안을 냈다면 이 항목은 지운다.
- 영향 역할: ui-dev, profile-dev
- 호환: 허용만 넓힌다. 외부 요청은 Google 사진을 쓸 때만 생긴다(`tests/ui.e2e.mjs`의 외부 요청 0 검사에는 영향 없다).

### 방장의 "사진 끄기" 버튼 CSS

- 종류: CSS(style.css, ui-dev 소유)
- 제안: room.js가 로비 목록 `#tl1`/`#tl2`의 `li` 안에 `<button class="level-chip av-off">사진 끄기</button>`를 넣는다(방장에게만, 사진이 있는 남에게만). `.team-col li .av-off { padding: 0 8px; font-size: 0.75rem; margin-left: 4px; }` 정도로 작게 해 주면 좋겠다.
- 이유: 지금은 `.level-chip` 기본 크기(8px 16px)라 한 줄 목록에서 크다. `li`의 `overflow: hidden; white-space: nowrap`에 버튼이 잘릴 수 있다.
- 영향 역할: ui-dev
- 호환: 클래스 추가뿐이라 깨지는 것 없음.

<!-- end:room-dev -->

## ui-dev

### 테마 저장 키와 :root 토큰 기록 (이미 반영, 문서화 요청)

- 종류: 저장 키 / CSS 변수
- 제안: localStorage `ohohmok-theme` = `"light"` / `"dark"`(없으면 OS 설정). `:root` 강조색 `--accent-gold` → `--accent`(+ `--accent-rgb`), 새 토큰 `--modal-bg`, `--inset-bg`, `--scrim`, `--danger`. 라이트 값은 `:root[data-theme="light"]`. DOM id 추가: `theme-btn`, `profile-wrap`, `profile-btn`, `profile-menu`, `pm-*`(app.js 전용)
- 이유: 사용자 요청(다크/라이트, 진녹색 강조색). 키 이름은 PM 지시대로. 옛 `--accent-gold`는 style.css 밖에서 쓰는 곳이 없어 이름을 바꿨다
- 영향 역할: integrator(docs/rules/README.md 이음새 목록·README 갱신), room-dev(room.js가 새 색을 쓸 때 위 토큰 사용)
- 호환: 새 키라 옛 데이터 없음. ZESTMOK과 출처를 공유하지만 `ohohmok-` 접두사라 충돌 없음

### `Profile.hasUpload()` 추가

- 종류: 전역 함수
- 제안: `Profile.hasUpload()` → 업로드 사진이 있으면 `true`(§6.1 표에 추가)
- 이유: "사진 지우기"는 업로드가 있을 때만 보여야 하는데 `photo()`로는 업로드와 Google 사진을 구분할 수 없다. 지금 app.js는 §3 키 `ohohmok-profile`의 `upload`를 직접 읽는다(`shortcut:` 주석)
- 영향 역할: profile-dev(구현), ui-dev(app.js `renderProfile`에서 키 읽기를 이 호출로 교체)
- 호환: 함수 추가뿐이라 깨지는 것 없음

<!-- end:ui-dev -->

## ai-dev

<!-- end:ai-dev -->
