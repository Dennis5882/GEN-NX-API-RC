# 스타일·엔진 이전 계획 (Tailwind + shadcn/ui, rc_engine.js → TypeScript)

대상 독자: 이 저장소를 처음 받는 코딩 에이전트(Codex). 작업 전 `CLAUDE.md`를 먼저 읽을 것. 소통은 한국어, 코드 식별자·API 키워드는 영어.

## 0. 작업 규칙 (반드시 준수)

- 커밋·푸시는 사용자가 명시적으로 요청할 때만 한다. 브랜치 생성은 허용.
- MAPI-Key는 코드·커밋·로그 어디에도 넣지 않는다. push 전 secret-scan: `grep -E "eyJ1|MAPI-Key:\s*ey|[A-Za-z0-9_-]{40,}\.[0-9a-f]{64}"`
- `archive/` 는 동결, 수정 금지. 로컬 전용 파일(`GEN_NX_NEXTBUILD_REVERIFY.md`, `*.pptx/xlsx/docx`, 스크린샷, `docs/` 외 덤프)은 커밋하지 않는다.
- UI 문자열은 전부 `shared/i18n.js`(이전 후에는 새 사전 파일)에만 둔다. 코드에 `{ko,en,…}` 인라인 객체 금지. 새 키는 ko/en/zh-TW/zh-CN 블록에 동시 추가 후 `npm run i18n:check -- --write`.
- 사용자에게 보이는 변경을 푸시할 때는 `npm run release -- minor|patch` 로 버전·노트를 같은 커밋에 넣는다(손으로 버전 수정 금지). 내부 리팩터(테스트·엔진 이전)는 버전업 불필요.
- 검증 명령: `npm run typecheck`, `npm run build`, `npm test`(Part T 이후 Vitest), `npm run lint`(T2 이후, 신규·수정 파일 기준 오류 0). 각 단계가 끝날 때마다 모두 통과해야 한다.
- Gen NX 라이브 검증은 사용자가 Gen NX를 단독으로 쓸 때만 가능하다. 이 계획의 작업은 라이브 호출 없이 끝낼 수 있게 설계되어 있다.

## 1. 현황 (2026-11-11 확인)

- 스택: React 19, Vite 8, TypeScript 7. Tailwind·shadcn/ui·Radix 없음. 의존성은 `react`, `react-dom`, `plotly.js-dist-min`, `midas-nx` 뿐.
- 스타일: `shared/app.css` 496줄(바닐라 클래스명). **React 앱 전용**이다. `MIDAS_RC_Modeling_Wizard.html`·`gen_nx_api_validation.html` 은 `app.css`·`i18n.js` 를 쓰지 않는다.
- 엔진: `shared/rc_engine.js` 1127줄. `window.RCEngine` 으로 약 130개 항목 노출. `src/engine/index.ts` 가 side-effect import 로 `RC` 를 만든다. 소비 파일 19개. Wizard 도 이 파일을 classic script 로 쓰지만 **Wizard 는 폐기 확정**이다.
- 사전: `shared/i18n.js` 699줄, `window.I18N`/`window.LOGS`. `src/i18n/index.ts` 가 읽고, `vite.config.ts` 가 `runInNewContext` 로 읽어 언어별 정적 `index.html` 메타를 만든다. 키 타입은 `src/i18n/keys.gen.ts` (자동 생성).
- 컴포넌트: `src/components/` 11개 파일. 인라인 `style=` 가 PlanEditor 61곳, Panels 15곳, local.ts 7곳, Drawers 6곳, View3D 5곳 등에 있다.
- 상태: `src/state/store.ts` 의 mutable `S` + `notify()`. **이번 범위에서 제외**(아래 §5).

## 2. 사용자 결정 대기 항목 (기본값으로 진행하되 결과에 명시)

1. ~~Wizard 유지 여부~~ — **확정(2026-11-11, 사용자): Wizard(`MIDAS_RC_Modeling_Wizard.html`)는 종료·폐기한다.** 따라서 `rc_engine.js` 를 classic script 로 계속 제공할 필요가 없고, 엔진은 순수 TS 모듈로만 이전한다. `legacy-taiwan.ts`(Wizard 전용 ASCE 대만 함수)도 이전하지 않고 삭제 대상이다(§4 B1·B2 참조).
2. 디자인 방침. 기본값 = **현재 모양을 shadcn 컴포넌트로 그대로 재현**. 새 디자인은 별도 작업.

## 2.5 Part T — 공통 도구 (A·B 보다 먼저, 브랜치 `chore/tooling`)

### T1. Vitest 도입
- `vitest` 설치, `vite.config.ts` 의 `test` 설정(또는 `vitest.config.ts`). 환경은 기본 node. DOM 이 필요한 컴포넌트 테스트는 이번 범위 밖.
- 기존 `tests/tw.test.mjs`(99)·`tests/kr.test.mjs`(92)를 Vitest 문법(`describe`/`it`/`expect`)으로 옮기고 `tests/_harness.mjs`(Vite SSR 직접 구동)는 Vitest 의 모듈 로딩으로 대체한다. **검증식은 원문대로 독립 재구현한 현재 방식을 그대로 유지**(테스트 안에서 식을 다시 짜는 것이 목적) — 단언 개수(99·92)가 이전 전후 같아야 한다.
- `npm test` = `vitest run`. `npm run test:watch` = `vitest` 추가. `tests/*.py` 는 건드리지 않는다.
- 완료 조건: 이전 전과 같은 단언이 모두 통과, `npm run build` 영향 없음.

### T2. 린터·포매터 (Biome)
- `@biomejs/biome` 설치, `biome.json`. 규칙은 recommended 에서 시작하고 기존 코드가 대량으로 걸리는 규칙(예: `noExplicitAny`, 비 null 단언)은 일단 warn 으로 둔다. **한 번에 전체 포맷 커밋 금지 선행:** 포맷 변경 커밋을 분리해 이후 diff 가 읽히게 한다.
- `npm run lint`(= `biome check`)와 `npm run lint:fix` 추가. `npm run build` 에는 넣지 않는다(이전 중 빌드가 린트로 막히지 않게). **CI/Vercel 에는 넣지 않는다(확정, 로컬 실행만).**
- 제외 경로: `archive/`, `dist/`, `src/i18n/keys.gen.ts`(자동 생성), `shared/` (이전 완료 전까지).
- Biome 가 Tailwind 클래스 정렬을 지원하는 범위만 사용하고, 지원이 부족하면 `prettier-plugin-tailwindcss` 는 도입하지 않는다(도구 2개 방지) — 근거를 PR 설명에 적는다. Biome 로 막히는 요건이 나오면 ESLint + typescript-eslint 로 대체하고 사유를 기록.

## 3. Part A — 스타일: Tailwind + shadcn/ui

브랜치 `feat/ui-shadcn` (현재 `feat/vite-react-ts` 에서 분기).

### A0. 기반
- Tailwind v4 + `@tailwindcss/vite`, `components.json`, `cn()`(clsx + tailwind-merge), `@/` 경로 별칭(`tsconfig` + `vite.config.ts`).
- `app.css` 의 색·폰트 변수를 shadcn 테마 토큰으로 옮긴다. 다크/라이트와 `--cjk`(`:lang(zh-Hans)` SC, `:lang(zh-Hant)` TC, 그 외 KR 우선) 규칙을 보존.
- 이 단계에서는 기존 클래스를 지우지 않는다(공존).
- 완료 조건: build·typecheck 통과, 화면 변화 없음.

### A1. 컴포넌트 교체 (한 컴포넌트씩)
- 추가: Button, Input, Select, Tabs, Card, Dialog, Sheet(드로어), Tooltip, Badge, Switch.
- 순서: Footer → Header → Drawers(`⚙` `#drawerMapi`, `AI` `#drawerLlm`) → ReleaseNotes → Guide → Chat → Panels → View3D 툴바 → PlanCard → PlanEditor(가장 큼: 표·팔레트·코어 격자·인라인 style 61곳, 별도 단계로 분할).
- 교체한 컴포넌트의 `app.css` 클래스를 같은 커밋에서 삭제.

### A2. 정리
- 남은 전역 CSS 를 Tailwind 레이어 파일로 합치고 `shared/app.css` 제거. `vite.config.ts` 의 `app.css` 복사 항목도 함께 정리(`app.css` 는 React 앱 전용이라 안전).
- 인라인 `style=` 을 Tailwind 클래스로 교체.

### A3. 검증 포인트
- 다크/라이트, 4개 언어(ko/en/zh-TW/zh-CN)의 폰트, 모바일 폭, 채팅|우측 분할 폭(`--split`, localStorage `nx_split`) 드래그.
- `agent/local.ts`·`plan.ts` 등이 HTML 문자열을 채팅에 넣는다. 이 문자열이 의존하는 클래스 목록을 먼저 만들고, 클래스를 지우기 전에 대응을 확인.
- 유지할 id/클래스: 확인 없이 지우지 말 것(`#drawerMapi`, `#drawerLlm`, `gearBtn`, `llmGear` 등은 CLAUDE.md 에 명시).

## 4. Part B — 엔진: rc_engine.js → TypeScript

브랜치 `feat/engine-ts` (Part A 와 섞지 않는다).

### B0. 안전망 (가장 먼저, T1 Vitest 도입 후)
- 기존 `tests/tw.test.mjs`(99)·`tests/kr.test.mjs`(92)는 T1 에서 Vitest 로 옮긴 상태를 유지.
- 엔진 골든 테스트를 Vitest 의 `toMatchSnapshot`/`toMatchFileSnapshot` 으로 추가: 현재 JS 출력을 스냅샷으로 저장. 대상 `buildFrame`, `specSections`, `deriveFloorGroups`, `coreLayout`, `resolveWalls`, `buildStoryData`, `eigvPayload`, `splcPayload`, `pickModalPeriods`, 가능하면 다중 입력(1동·2동·코어·내력벽·다중 단면 팔레트).
- 이전 후에도 같은 스냅샷과 비교해 동일해야 한다.

### B1. 기능군별 분할 이전
| 새 파일 | 옮길 내용 |
|---|---|
| `src/engine/geometry.ts` | buildFrame, asSpans, cumPos, 코어·내력벽(coreLayout, coreWalls, bearingWalls, specWalls, resolveWalls), storyElevations, planAreaM2 |
| `src/engine/spec.ts` | DEFAULT_SPEC, BUILDING_TYPES, TYPE_KEYWORDS, detectBuildingType, MATERIALS, FLOOR_USE, paletteFor, specSections, deriveFloorGroups, specToGroupRows |
| `src/engine/story.ts` | buildStoryData, sseis·swind 자기계산(sseisSelfProfile, sseisGenRows, sseisDiff, storyWeightDiff, swindSelfPressures) |
| `src/engine/dynamic.ts` | eigvPayload, splcPayload, pickModalPeriods, twDesignSpectrum |
| `src/engine/design.ts` | 배근·PM 곡선(flexAs, rcBeamDesign, colPMcurve, rcColumnDesign 등) |
| `src/engine/draw.ts` | DXF 출력 |
| (이전하지 않음) | ASCE 계열 대만 함수(seismicCs, seismicStoryForces, windStoryForces, taiwanCombos, seismicKExp, effSD1, seismicStoryWeights, fundamentalPeriod 등)는 Wizard 전용이었다. 삭제 전에 `grep -rn` 으로 `src/` 에서 호출이 없는지 확인한다. **예외:** `src/codes/tw.ts` 등이 재료·용도하중·지역 프리셋 등 일부를 `rc_engine` 에서 공유하므로(CLAUDE.md '설계기준 프로필'), 호출이 남은 항목은 해당 모듈(`spec.ts` 등)로 옮긴다 |

- 한 묶음씩: TS 로 옮김 → `types.ts` 의 수동 타입을 실제 타입으로 교체 → 골든 테스트 통과 → `window.RCEngine` 에서 해당 항목 제거(Wizard 유지 시에는 아래 B2 참조).
- 로직은 바꾸지 않는다(동작 보존 이전). 버그를 발견하면 별도 이슈로 기록하고 이전과 분리.

### B2. 소비처 정리·Wizard 폐기
- 약 19개 파일의 `RC.xxx` 호출을 명시적 import 로 교체. `window.RCEngine` 브리지는 만들지 않는다.
- Wizard 폐기: `MIDAS_RC_Modeling_Wizard.html` 을 `archive/` 로 이동(동결). `vite.config.ts` 의 멀티페이지 입력에서 제거하고 `dist/shared/` 복사 플러그인에서 `rc_engine.js`·`i18n.js`·`app.css` 항목을 제거. `gen_nx_api_validation.html` 은 `rc_engine.js` 를 로드하지 않으므로 그대로 유지(빌드 입력 유지 여부만 확인).
- Wizard 를 가리키는 링크·문서·테스트(헤더 링크, README, 도움말, `tests/` 의 Wizard 참조)를 `grep -rni wizard` 로 찾아 정리. 문구 변경은 i18n 사전에서.
- `shared/rc_engine.js` 는 마지막에 `archive/` 로 이동하거나 삭제(git 이력에 남음).

### B3. 사전(i18n) 이전
- `shared/i18n.js` → `src/i18n/{ko,en,zh-TW,zh-CN}.ts` 로 분리, `window.I18N` 의존 제거.
- `keys.gen.ts` 생성 스크립트(`npm run i18n:check`)와 `vite.config.ts` 의 `runInNewContext`(메타 title/desc 생성)를 TS import 기반으로 교체. 언어별 정적 페이지(`/zh-CN/`·`/zh-TW/`·`/en/`·`/ko/`)와 og 메타는 그대로 나와야 한다.
- `LANG_DEFS`(`src/i18n/types.ts`)는 지원 언어 단일 출처로 유지.

## 5. 이번 범위에서 제외

- `S` + `notify()` 상태 구조. 바닐라 로직과 1:1 유지가 의도된 설계이며, 액션 파일 전반에 퍼져 있어 스타일·엔진과 동시에 바꾸면 회귀 원인을 구분하기 어렵다. A·B 완료 후 별도 계획(Zustand 등).
- Gen NX API 호출 방식(`client.request` 원시 호출 → SDK 타입 리소스)은 CLAUDE.md 상 차기 과제.

- **`midas-nx` 업데이트(2.10.2 → 2.11.1)는 이 계획이 모두 끝난 뒤 별도 작업으로 한다. 지금 올리지 말 것.** (2.10.3~2.11.1 변경 기록상 앱이 쓰는 `request()`·`verifyConnection()` 경로 영향은 작아 보이나 미확인. 올릴 때는 `typecheck`·`build`·`npm test` + Gen NX 라이브 해석 확인.)

## 6. 순서

1. T1 Vitest → T2 Biome (이후 단계의 전제)
2. B0 안전망 + A0 기반 (병행 가능)
3. A1 → A2 → A3
4. B1 → B2
5. B3
6. 각 단계 끝에서 `npm run typecheck && npm run build && npm test`. 사용자에게 보이는 변경(Part A)은 `npm run release -- minor` 와 4개 언어 릴리즈 노트.

## 7. 완료 정의

- Tailwind/shadcn 로 전환되어 `shared/app.css` 가 없다.
- `shared/rc_engine.js`·`shared/i18n.js` 가 TS 모듈로 대체되고 골든 테스트·`npm test` 가 이전과 동일 결과.
- 4개 언어·다크/라이트·모바일 폭에서 화면 이상 없음, 언어별 공유 링크 메타 동일.
- secret-scan 통과, 로컬 전용 파일 미커밋.
