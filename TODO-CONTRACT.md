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

<!-- end:ui-dev -->

## ai-dev

<!-- end:ai-dev -->
