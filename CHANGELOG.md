# Changelog — MIDAS RC Modeling Wizard

## v1.0.1 — 2026-06-11

Wizard 인터페이스 개선 (기능 동일, UX 추가).

- **Base URL 입력 필드** — 서버 주소를 직접 지정(기본 `https://moa-engineers.midasit.com:443`).
  제품 경로(`/gen`·`/civil`)는 자동 부착. 지역별 대체 서버 대응. localStorage 저장.
- **실시간 3D 미리보기** — 우측에 아이소메트릭 뷰. 그리드·층 입력 변경 시 즉시 갱신.
  층 역할별 색상(표준층/기단부/지붕/전이층/지하) + 범례, 최하단 지지 표시.
  부재 과밀 시 모서리만 표시(schematic)로 성능 유지. 다국어 제목.
- 키 입력 placeholder 중립값(`MAPI-Key …`)으로 변경.

## v1.0.0 — 2026-06-11 (1차 릴리즈)

표준층 기반 신규 RC 빌딩을 MIDAS Gen NX에 즉시 생성하는 첫 정식 버전.
대만(Taiwan) RC·Frame, CNS560(RC) / TWD-USD112.

### 엔지니어용 배포물
- **`MIDAS_RC_Modeling_Wizard.html`** — 설치·파이썬 불필요. 파일을 열어 MAPI-Key·그리드·층을
  입력하고 "생성" 클릭 → 실행 중인 본인 PC의 MIDAS Gen NX에 모델 생성.
  (MIDAS API의 CORS 전면 허용 확인 → 브라우저가 서버를 직접 호출)
  - 통경선 그리드 입력 → 기둥·보·슬래브 자동 생성
  - 다중 층 구성(기단부/기준층/지붕 등 역할), 용도별 바닥하중 프리셋
  - 강성 다이어프램, 대만 하중조합(TWD-USD112) 옵션
  - 드라이런 미리보기 + 실시간 전송 로그(숨은 본문 오류까지 감지)
  - **다국어** — 繁體中文(대만) / 한국어 / English. 구조 엔지니어 실무 용어 기준
    (예 繁中: 軸網·柱·梁·樓板·剛性樓板·斷面·載重組合·裙樓·轉換層). 브라우저 언어
    자동 감지(zh→繁中) + 수동 전환(헤더), 선택은 localStorage 저장. 문자열은
    `LANG` 사전 한 곳에 모아 언어 추가가 쉬움.

### 코어 라이브러리 (`midas_story/`, 개발/자동화용)
- **M1 — 모델 생성**: 표준층 도메인 모델 + 불변식 검증 + 전개기(표준층 → 자연층).
  node/elem/matl/sect/thik/stld/bodf/bmld/fbld/fbla/cons 생성. 단위계 옵션(M·TONF / M·KN).
- **M1.5 — 작성 강화**:
  - `grid.py` 통경선 그리드 + `build_frame()` 골조 자동 생성
  - 다중 표준층 + 특수층 역할(PODIUM/TRANSFER/ROOF/BASEMENT)
  - 층 다이어프램(`/db/rigd`, DOF 110001)
  - `combos.py` 대만 하중조합(`taiwan_strength_combos`, `/db/lcom-gen`)
- **대만 규격** `taiwan.py` — 라이브 검증: 콘크리트 `CNS560(RC)`/`CNS560-18(RC)`
  (C210~C420), 강재 `CNS(S)`/`CNS06(S)`, 설계코드 `TWD-USD112`.
- `MidasClient`(REST 전송) / `RecordingClient`(드라이런). 테스트 23개.

### 라이브 검증 (실제 MIDAS Gen NX)
- 그리드 3×2 + 기단부/기준층/지붕(13층) → 전송 14/14 성공.
  노드 168 · 요소 455 · 다이어프램 13 · 바닥하중 13 · 지지 12 · 하중조합 3.

### 검증으로 발견·수정한 제약
- 하중조합 이름 최대 **20자** (수식은 DESC로) — 검증 단계에 길이 체크 추가.
- 신규 문서 `/doc/save`/`saveas` 는 모달 대화상자 유발 → 기본 비활성(라이브 세션 생성).

### 알려진 한계 / 다음 단계
- 전단벽/코어, 지진·풍 횡하중 케이스는 미포함(M2/M3).
- M2: 기존 모델/IFC에서 표준층 자동 판정. M3: 해석 결과 기반 구간별 배근. M4: 도면 자동화.
