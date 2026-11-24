---
name: visual-check
description: 판·돌·오버레이·레이아웃 등 눈에 보이는 것을 바꿀 때 쓴다. Playwright로 폰·데스크톱 폭 스크린샷을 찍어 직접 보고 대조한 뒤 verify-and-report로 이어간다.
---
## MUST

- 캡처를 열어 보지 않고 확인 완료로 쓰지 않는다.
- 폰(`devices['iPhone 13']`)과 데스크톱(1280×800) 둘 다 본다. 가로 스크롤·잘린 판·겹친 버튼이 없어야 한다.
- 캡처 스크립트와 이미지는 저장소에 커밋하지 않는다(임시 폴더). 반복 검사할 것은 `tests/ui.e2e.mjs`에 단정으로 넣는다.
- 외부 요청 없이 동작해야 한다(`ui.e2e.mjs`의 "no external requests" 검사 유지).

## 단계

- S1 대상 확인: 바꾼 화면과 그 화면까지 가는 조작(모드 선택, 대국 방식, 착수 등)을 정한다.
- S2 캡처: `tests/ui.e2e.mjs`와 같은 방식으로 임시 스크립트를 쓴다.
  - `chromium.launch()`, 위 두 context, `page.goto(new URL('../index.html', import.meta.url).href)`(또는 `npm run serve` 후 `http://localhost:8080`)
  - S1 조작 뒤 `page.screenshot({path, fullPage: true})`, 필요하면 `page.locator('#board-surface').screenshot()`.
- S3 대조: 이미지를 열어 판 15×15 전체 보임, 돌 위치·크기, 글자 잘림, 다크 배경 대비, 터치 대상 크기를 본다. 어긋나면 고친 뒤 S2부터 다시.
- S4 `npm run test:ui` 통과 확인 후 verify-and-report로 이어간다.
