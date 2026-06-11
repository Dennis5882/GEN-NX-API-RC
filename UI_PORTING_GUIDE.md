# Gen NX Agent 인터페이스 재사용 가이드

`gen_nx_agent_v6_i18n.html`의 인터페이스를 다른 프로젝트에 이식하기 위한 정리.
핵심 원칙: **UI 껍데기(레이아웃·스타일·다국어·패널 상호작용)는 그대로 가져가고, MIDAS 전용 로직만 당신 프로젝트 것으로 갈아끼운다.**

---

## 1. 파일 구조 한눈에

| 영역 | 줄 범위 | 분류 | 이식 방법 |
|------|---------|------|-----------|
| `<head>` 폰트/Plotly CDN | 1–10 | 🟢 인터페이스 | 그대로 복사 |
| `<style>` 전체 CSS | 11–332 | 🟢 인터페이스 | 그대로 복사 (도메인 무관) |
| `<header>` 마크/언어선택/연결핀 | 336–348 | 🟢 인터페이스 | 로고·타이틀만 교체 |
| `<main>` 채팅+가이드+패널 레이아웃 | 350–418 | 🟢 인터페이스 | 그대로, 패널 내용만 교체 |
| 설정 서랍 `<drawer>` | 421–467 | 🟡 혼합 | MAPI 필드 → 당신 백엔드 필드로 교체 |
| 상태객체 `S` + i18n `I18N`/`LOGS` | 469~ | 🟢 인터페이스 | 텍스트만 당신 도메인으로 |
| UI 플러밍 함수 | 아래 표 참조 | 🟢 인터페이스 | 그대로 복사 |
| MIDAS 도메인 함수 | 아래 표 참조 | 🔴 교체 | 당신 로직으로 대체 |

---

## 2. 🟢 그대로 가져갈 "인터페이스 플러밍" 함수

이 함수들은 도메인과 무관한 순수 UI 기계장치다. 복사해서 바로 쓴다.

| 함수 | 줄 | 역할 |
|------|-----|------|
| `$(id)` | 678 근처 | `getElementById` 단축 |
| `t(key,...args)` | 679 | i18n 조회 (함수형 값 지원) |
| `tl(key,...args)` | 711 | 로그 i18n |
| `tab(id)` | 717 | 우측 패널 전환 |
| `openSettings` / `closeSettings` | 720–721 | 설정 서랍 |
| `nowTs()` | 723 | 타임스탬프 |
| `log(msg,type)` | 724 | 활동기록 패널에 줄 추가 |
| `addMsg(role,html)` | 730 | 채팅 버블 추가 |
| `thinking()` | 735 | 타이핑 애니메이션 |
| `escapeHtml(s)` | 1524 | XSS 방지 |
| `renderGuide` / `toggleSec` / `toggleGuide` | 1926–1965 | 좌측 가이드 사이드바 |
| `hint(tt)` / `quick(tt)` | 1967–1968 | 가이드 클릭 → 입력창 |
| `clearChat()` | 1971 | 대화 청소 |
| `setProvider` / `setConn` / `syncMode` | 1853–1882 | LLM 공급자·연결 핀·모드 |
| `applyStatic()` | 1981 | `data-i18n*` 속성 일괄 적용 |
| `setLang(l)` | 1988 | 언어 전환 |

### 다국어(i18n) 엔진 — 가장 재사용 가치 높음
- `I18N = { ko:{...}, en:{...}, zh:{...} }` — 키→문자열, 보간이 필요하면 **함수값** 사용
  ```js
  floors_built: (n)=>`${n}개 층 생성됨`   // t('floors_built', 15)
  ```
- `t(key,...args)` 가 함수면 호출, 아니면 그대로 반환
- HTML 마크업엔 `data-i18n="key"`(텍스트), `data-i18n-html="key"`(innerHTML),
  `data-i18n-ph="key"`(placeholder), `data-i18n-title="key"`(title) 부착
- `setLang()` → `applyStatic()` 가 전체 DOM 일괄 갱신
- **그대로 다른 다국어 웹앱에 이식 가능.** 키 이름과 사전 내용만 당신 도메인으로 교체.

---

## 3. 🔴 교체해야 할 MIDAS 도메인 함수

당신 프로젝트의 데이터/API로 갈아끼울 부분.

| 함수 | 줄 | MIDAS 전용 내용 | 교체 방향 |
|------|-----|-----------------|-----------|
| `cfg()` | 742 | MAPI base/key | 당신 백엔드 엔드포인트 |
| MAPI 호출부 | 742~ | `/db/*`, `/doc/anal`, `/post/table`, `MAPI-Key` 헤더 | 당신 REST 계약 |
| `asSpans`/`cumPos`/`buildFrame` | 822–1050 | 구조 프레임 지오메트리 | 당신 도메인 모델 |
| `BUILDING_TYPES`/`bt`/`detectBuildingType` | ~1051 | 건물 유형 템플릿 | 당신 프리셋 |
| `parseCommand`/`parseFloors`/`num` | 1066–1147 | 자연어 → 구조 명령 파서 | 당신 명령 스키마 |
| `planSummary`/`planEditor`/`readPlanEditor` | 1148–1235 | 사양 카드(읽기/편집) | 당신 입력 폼 |
| `resultBrief`/`statusBrief`/`extremum` | 1331–1416 | 해석 결과 요약 | 당신 결과 형식 |
| `buildLLMRequest`/`parseLLMResponse` | 1419–1484 | LLM tool-use 스키마 | 도메인 툴 정의만 교체(틀은 재사용 가능) |
| `draw3D`/`plot3D`/`gax`/`setCam`/`toggleVis`/`updateViewStats` | 1596–1852 | Plotly 3D 구조뷰 | 3D 안 쓰면 패널째 삭제 |

---

## 4. 어댑터 계약 (UI ↔ 로직 경계)

인터페이스를 살리려면 당신 로직이 이 5개 진입점만 채우면 된다:

```
1. onSend()            입력창 텍스트 → 당신 처리 → addMsg('bot', html)
2. testConn()          연결 테스트 → setConn(ok, err)
3. renderGuide()       가이드 항목 데이터(GUIDE 배열) 정의
4. draw3D()            (선택) 시각화 패널 갱신 — 안 쓰면 빈 함수
5. I18N/LOGS 사전       당신 도메인 텍스트로 교체
```

나머지(`tab`, 서랍, 언어전환, 버블, 타이핑, 청소)는 건드릴 필요 없음.

---

## 5. ⚠️ 이식 중 함정 (실제로 겪은 것들)

1. **폰트 콤마 트랩** — Plotly config의 `family`는 **한 문자열** 안에 콤마를 넣어야 한다.
   ```js
   family:'IBM Plex Mono, Noto Sans TC'   // ✅ 객체 리터럴 안 깨짐
   family:'IBM Plex Mono','Noto Sans TC'  // ❌ JS 객체 깨짐 (CSS에서만 OK)
   ```
2. **HTML5 native 검증 툴팁** — `min="1"` 쓰면 한글 OS에서 "값은 1보다 크거나 같아야 합니다" 가
   뜬다. 주석 문제 아님. `min` 빼고 JS에서 `Math.max(1,v)` 로 clamp.
3. **i18n 함수값** — 보간이 필요한 키는 문자열이 아니라 함수로. `t()`가 자동 호출.
4. **`data-i18n-html`** — 굵게/링크 들어가는 문구는 `data-i18n`(텍스트) 말고 이걸 써야 태그가 산다.

---

## 6. 권장 이식 순서

1. 새 HTML에 `<head>`(1–10) + `<style>`(11–332) + `<body>` 레이아웃(334–418) 복사
2. 헤더 로고/타이틀/`devinfo`를 당신 프로젝트 것으로 교체
3. UI 플러밍 함수(§2) 전부 복사 → 빈 `onSend`/`testConn`/`draw3D` 스텁으로 일단 실행
4. `I18N`/`LOGS` 키를 당신 도메인 텍스트로 채움 → 언어전환 동작 확인
5. `renderGuide`의 `GUIDE` 배열을 당신 명령 예시로 교체
6. 마지막에 `onSend` 안에서 당신 백엔드/파서 연결
7. 3D 안 쓰면 `viewP` 패널 + 관련 함수 삭제, 탭바에서 `◈ 3D` 제거

---

생성: 2026-06-11 · 대상 파일 `gen_nx_agent_v6_i18n.html`
