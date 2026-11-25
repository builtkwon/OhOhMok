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

<!-- end:ui-dev -->

## ai-dev

<!-- end:ai-dev -->
