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
