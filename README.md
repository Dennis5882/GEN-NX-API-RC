# Gen NX 대화형 RC 구조 모델링 도구

React·TypeScript 앱에서 MIDAS Gen NX 모델 생성, 하중, 해석과 결과 검토를 진행한다.
설계기준 프로필은 대만 TW·한국 KR·중국 CN을 지원하며 UI 언어와 독립적으로 선택한다.

## 개발과 검증

Node.js 24 환경에서 실행한다.

```sh
npm ci
npm run dev
npm run typecheck
npm run build
npm run test
npm run lint
```

`npm run test:watch`는 Vitest 감시 실행, `npm run lint:fix`는 Biome의 안전한 수정이다.
린트는 로컬에서만 실행하며 CI·Vercel 빌드에 연결하지 않는다. 기존 코드의 경고는 이전 단계별로 정리한다.

테스트는 기존 TW 105개·KR 92개의 규범 독립 계산을 유지한다. 엔진 출력은 기하·규격·코어·내력벽·Story Data·동적 페이로드의 53개 스냅샷과 Story QA·배근·DXF의 10개 스냅샷으로 고정했다. 이전 중에는 스냅샷을 갱신하지 않는다. 별도 테스트로 브라우저 전역 없이 엔진 전체를 로드할 수 있는지도 확인한다.

## 엔진과 빌드 구조

`src/engine/`은 `spec.ts`, `geometry.ts`, `story.ts`, `dynamic.ts`, `design.ts`, `draw.ts`의 순수 TypeScript 모듈이다. 소비처는 필요한 함수를 명시적으로 import하며 `window.RCEngine` 브리지는 사용하지 않는다. 자료형과 각 함수의 실제 반환형을 함께 사용한다.

`index.html`이 React 앱 진입점이고 `gen_nx_api_validation.html`은 독립 API 검증 페이지다. 빌드는 한국어·영어·번체·간체 공유 링크의 정적 메타도 만든다. 이전 Wizard는 `archive/MIDAS_RC_Modeling_Wizard.html`에 기록용으로 보관하며 빌드·사용 경로에서 제외했다. `shared/rc_engine.js`와 레거시 파일 복사 플러그인은 제거했다.

설계기준은 `src/codes/`, 앱 상태는 기존 `S` + `notify()` 구조를 유지한다. SDK 호출 방식과 `midas-nx` 2.10.2는 이번 이전에서 변경하지 않는다.

`src/i18n/{ko,en,zh-TW,zh-CN}.ts`가 UI·로그 사전의 단일 출처다. `LANG_DEFS`는 지원 언어를 정의하고, 검사 스크립트와 정적 페이지 빌드는 TS 사전을 직접 import한다. 기존 574개 UI 키·15개 로그 키와 함수 출력, 7개 정적 경로의 메타·언어 태그·폰트 링크가 이전 전과 동일하다.

## UI 스타일과 검증

- Tailwind v4의 진입점은 `src/styles/globals.css`, 테마·CJK 폰트 원본은 `src/styles/tokens.css`이다. `shared/app.css`는 제거했다. 기본·표 스타일은 `base.css`, HTML 메시지 상태 배지는 `content.css`, 컴포넌트의 크기·상태 선택자는 정적 Tailwind `@utility` 모음인 `components.css`에 있다. `data-theme`의 navy/cyber는 dark, light는 light로 동작하며 Preflight는 사용하지 않는다.
- `components.json`은 shadcn의 new-york·CSS 변수 모드다. Button·Input·NativeSelect·Tabs·Card·Dialog·Sheet·Tooltip·Badge·Switch·Textarea를 적용했다. `plain` 변형은 기존 크기와 간격을 보존하기 위해 제공하며, 실제 스타일은 Tailwind 클래스가 결정한다. `@/`는 TypeScript·Vite·Vitest 모두 `src/`로 해석하며 `cn()`은 `src/lib/utils.ts`에 있다.
- 상태 마커 클래스(`on`, `running` 등)와 공개 ID는 동작 계약으로 유지한다. `src/styles/component-classes.ts`가 기존 마커에 대응하는 정적 Tailwind 유틸리티를 연결한다. HTML 문자열이 사용하는 클래스 18개와 사용처는 `src/styles/html-classes.json`에 기록했다. 표시 스타일은 Tailwind로 옮겼고, 런타임 숫자로 결정되는 분할 폭·코어 셀 크기·접힘 높이는 CSS 변수만 인라인으로 전달한다.
- 기존 `--muted`는 텍스트 색이므로 A0에서는 호환성을 유지한다. `text-muted-foreground`는 해당 색, `bg-muted`는 `--panel2` 표면 색에 연결했다. 기존 텍스트 토큰과 shadcn 표면 토큰의 역할 차이를 이 매핑으로 유지한다.
- Biome 2.6의 실험 규칙 `useTailwindSortedClasses`를 경고로 켜고 실제 스타일시트를 연결했다. 클래스 정렬은 unsafe fix로 분류되므로 `lint:fix`가 자동 정렬하지 않는다. 별도 `prettier-plugin-tailwindcss`는 도입하지 않는다. 근거: [Biome 공식 규칙 설명](https://next.biomejs.dev/linter/rules/use-tailwind-sorted-classes/javascript/).

`npx playwright install chromium` 후 `npm run build && npm run test:ui`로 실제 Chromium에서 3개 테마·4개 언어·390/1440px, 설정 시트와 포커스, 분할 드래그, 편집 카드와 릴리즈 노트를 검사한다. 스크린샷·추적 파일은 로컬 산출물이며 git에서 제외한다. 실제 Gen NX·LLM 요청은 차단한다.

## Python 코어

기존 `midas_story/`와 Python 테스트는 유지한다.

```sh
pip install -r requirements.txt
python -m pytest tests/ -q
```

실제 Gen NX 연결 키는 브라우저에서 입력하며 메모리에만 보관한다. 키를 코드·파일·로그에 저장하지 않는다. 커밋·푸시는 사용자의 명시적 요청이 있을 때만 진행한다.
