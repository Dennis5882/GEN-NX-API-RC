# CLAUDE.md — MIDAS Gen NX RC 도구 프로젝트 컨텍스트

## 소통
- **한국어**로 소통. 코드 식별자·API 키워드는 영어 유지.

## 프로젝트 개요
MIDAS IT 소속 Dennis(sjj0507@midasit.com)가 개발하는 **MIDAS Gen NX 대만 RC 구조 모델링 도구**.  
브라우저 단일 HTML 웹앱 — MIDAS Gen NX Open API(REST)를 호출해 기둥/보 RC 골조를 자동 모델링·해석·배근 설계.  
대만 건물 RC 코드(TWN-USD112) 기반. Vercel 루트(`/`)로 서빙.

## 파일 구조 (2026-06-27 대개편)

| 파일 | 역할 |
|---|---|
| `index.html` | **유일한 작업 소스** — 모든 수정은 여기만 |
| `shared/rc_engine.js` | 구조 계산 로직 단일 소스 |
| `shared/i18n.js` | 다국어 사전 (window.I18N 221키+, ko/en/zh) |
| `shared/app.css` | 스타일 단일 소스 |
| `archive/` | 구버전 동결 — 수정 금지 |

- `standalone`, `v1.1.9`, `v1.2.0` HTML 파일은 archive 동결, 유지보수 중단.
- `MIDAS_RC_Modeling_Wizard.html`, `gen_nx_api_validation.html`은 루트에 별도 유지.

## 보안·커밋 규칙 (항상 준수)

1. **MAPI-Key는 절대 코드/커밋에 포함 금지** — 사용자가 인라인으로 줄 때만 사용.
2. **push 전 secret-scan 필수**: `grep -E "eyJ1|MAPI-Key:\s*ey|[A-Za-z0-9_-]{40,}\.[0-9a-f]{64}"`
3. **로컬 전용(비커밋)**: `GEN_NX_NEXTBUILD_REVERIFY.md`, `*.pptx/xlsx/docx`, 스크린샷, `archive/` 덤프.
4. 커밋/푸시는 사용자가 명시적으로 요청할 때만.

## i18n 패턴

- 모든 UI 문자열은 `t('key')` / `tl('log_key')` 로 호출. 하드코딩 금지.
- 새 문자열 추가 = `shared/i18n.js`의 `ko:{}` / `en:{}` / `zh:{}` 블록에 동시 추가.
- 언어 영속성: `localStorage('nx_lang')`. `S.lang` 초기화 시 IIFE로 읽음.
- HTML 속성: `data-i18n`, `data-i18n-html`, `data-i18n-ph`, `data-i18n-title` → `applyStatic()`이 처리.

## 로컬 NLP 구조

```
parseCommand(txt) → {intent, ...params}
handleLocal(txt)  → intent에 따라 API 호출 or 즉시 응답
```

**인텐트 목록**: `help` · `tab{3d|result|log|model}` · `conn_check` · `clear` · `build` · `modify_section` · `resize_subset` · `add_load` · `add_bracing` · `change_spec{matName|hTyp|stories}` · `dynamic` · `analyze` · `result{disp|react|force}` · `status` · `unknown`

GUIDE 패널: `GUIDE` 배열 → `renderGuide()`. `send:true` 항목은 클릭 시 즉시 전송.

## 다중 단면·재료 모델링 (팔레트 + 구역 배정, 2026-06-29)

기둥/보 단면·재료를 **구역(지하·표준층·루프…)별로 다르게** 배정. 단일 단면이면 기존과 동일(하위호환).

- **팔레트**: 편집 카드에서 기둥/보 단면(H×B) 정의 + 재료(MATERIALS 카탈로그) 체크. **첫 항목 = 기본(대표) 단면**.
- **배정**: 표준층 표 각 행에 `기둥·보·재료` 드롭다운 → 구역별 단면 선택.
- **엔진** `shared/rc_engine.js`:
  - `paletteFor(p)` → `{cols,beams,mats}` (없으면 최상위 colName/beamName/matName 폴백).
  - `specSections(p)` → distinct 단면/재료 dedup → `{sections[](sect id), mats[](matl id), storyAssign{story:{colSect,beamSect,mat}}, def}`.
  - `deriveFloorGroups`/`specToGroupRows` = 그룹 행에 `col/beam/mat/h` 패스스루(단면/재료 차이로도 행 분리).
- **등록** `index.html`: `putMaterials`/`putSections`(배치), `putElements`가 **요소별 MATL·SECT**(`actBuildFrame`이 `storyAssign`대로 기둥·보·연결보·전단벽 배정).
- **UI**: `paletteHTML`·`fgRow`(드롭다운 열)·`readPlanEditor`(팔레트·배정 읽기)·`palAdd/Del/Resize`·`refreshFgSectionDropdowns`.
- **상태 필드**: `S.model.secReg`(레지스트리), `.sections`(id맵), `.materials`, `.nextSect`/`.nextMat`. `p.palette`+`p.groups[].col/beam/mat`가 단일 출처.

⚠ **범위 경계(의도적)**: **모델 지오메트리·단면·재료까지만** 다중화. **설계·배근·`colPMcurve`·`rcBeamDesign`·M4 스케줄은 대표(1차) 단면 기준 유지** — 다중단면 설계 분기는 차기. 최상위 `p.colName/colH/matName` 등은 팔레트 1차 항목으로 채워 설계 입력·표시 유지.

## MIDAS Gen NX API 핵심 제약

### Story Manager (SSEIS/SWIND)
- **`db/SSEIS`** (구 `db/SEIS`는 레거시). **`db/SWIND`** (v975+).
- **SSEIS/SWIND 지원 코드**: KDS + **USER TYPE** 만. 해외코드(TWN 등)는 차기 예정.
- **대만 경로 = USER TYPE 고정** — 자체 층력 계산 후 주입.
- **SSEIS/SWIND PUT이 동작하려면 GUI "Auto Generate Story Data" 선행 필수**.  
  순수 API(`ope/STOR`)만으로는 Story Manager 등록 불가 → PUT 시 "Wrong Key".
- `ope/STOR` = 편심 자동산정만(층 생성 X). `db/STOR` 선행 필수.
- `db/STOR.STORY_LEVEL` PUT 무시 — `ope/STOR`이 노드 좌표에서 재계산(N-MM 단위 필수).
- **SWIND USER TYPE**: `SCALE_FACTOR_X`, `SCALE_FACTOR_Y` 필수 포함.
- `ope/STORPROP` = 현재 빌드(06/12/2026) 404 미탑재.

### Story Calc 호출 순서
```
runAnalysis() → fetchTable(×3) → renderResults() → putStoryCalc()  ← 여기만
```
`ope/STOR`를 fetchTable 앞에 두면 `[SS] no analysis result` 오류.

### POST/PM 라이브 곡선
`db/RCHK` = 404. GUI RC Design 선행이 유일 경로 (또는 DCON TWN-USD112 native).

### 모달 주기
T₁은 `EIGENVALUEMODE` 테이블에서 회수 (`PARTICIPATIONVECTORMODE` 아님).

### ISO 뷰 API
`POST view/ANGLE {Argument:{HORIZONTAL:30,VERTICAL:15}}` → ISO 뷰.

### Gemini 스키마
`functionDeclarations`의 type은 단일 string 필수. `gSchema()` 재귀 정규화로 union type 변환(Gemini 분기만 적용).

## 설정 드로어 구조

| 버튼 | 드로어 ID | 용도 |
|---|---|---|
| `⚙` (`gearBtn`) | `#drawerMapi` | MIDAS API (Base URL, MAPI-Key) |
| `AI` (`llmGear`) | `#drawerLlm` | LLM (공급자, API Key, 모델) |

`closeSettings()` = 두 드로어 동시 닫기. `openSettings()` = `openMapi()` 별칭.

## 현재 빌드 버전
MIDAS GEN NX 2026 (v2.1), Build **06/12/2026**.  
도구 내부 버전: `v1.2.1`. 0616·0617·0624 검증 전부 이 단일 빌드 기준.

## 개발 환경 주의
- Node.js **미설치** (exit 127). JS 검증은 `py-mini-racer` 사용.
- 콘솔 cp949 — 한글 print 시 UnicodeEncodeError. UTF-8 파일에 쓰고 Read로 확인.
