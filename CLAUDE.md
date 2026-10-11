# CLAUDE.md — MIDAS Gen NX RC 도구 프로젝트 컨텍스트

## 소통
- **한국어**로 소통. 코드 식별자·API 키워드는 영어 유지.

## 프로젝트 개요
MIDAS IT 소속 Dennis(sjj0507@midasit.com)가 개발하는 **MIDAS Gen NX 대만 RC 구조 모델링 도구**.  
브라우저 단일 HTML 웹앱 — MIDAS Gen NX Open API(REST)를 호출해 기둥/보 RC 골조를 자동 모델링·해석·배근 설계.  
대만 건물 RC 코드(TWN-USD112) 기반. Vercel 루트(`/`)로 서빙.

## 파일 구조 (2026-10-11 Vite+TS+React 이전 시작 — 브랜치 `feat/vite-react-ts`)

| 파일 | 역할 |
|---|---|
| `index.html` | Vite 진입점 (`#root` + `/src/main.tsx`) |
| `src/state/` | `store.ts` — 바닐라 전역 `S`를 옮긴 mutable store(`notify()`+`useStore()`), `ui.ts` — log/addMsg/thinking/tab/draw3D/previewSpec |
| `src/actions/` | MAPI 액션 — `model.ts`(actBuildFrame·편집), `analysis.ts`(해석·동적), `verify.ts`(SSEIS·SWIND·층중량) |
| `src/agent/` | `parse.ts`(parseCommand) · `local.ts`(handleLocal·confirmBuild) · `llm.ts`(TOOLS·handleLLM) · `session.ts`(send·setLang·testConn) · `editor.ts`(편집카드 상태↔스펙) · `plan.ts` · `results.ts` · `guide.ts` |
| `src/mapi/client.ts` | midas-nx `MidasClient` 래퍼 — `mapi(method,path,body)` 바닐라 시그니처 유지, 타임아웃 15분 |
| `src/components/` | Header·Drawers·Guide·Chat·PlanCard·PlanEditor·Panels·View3D(Plotly 동적 import) |
| `src/engine/` | `shared/rc_engine.js` 브리지(side-effect import → `RC`) + `types.ts` 점진 타입화 |
| `src/i18n/` | `shared/i18n.js` 브리지 — plain `t()`/`tl()`/`tv()`/`pick()` (S.lang 기준, 액션에서도 사용) |
| `shared/rc_engine.js` | 구조 계산 로직 단일 소스 (React 앱·Wizard 공용, 이전 완료 전까지 유지) |
| `shared/i18n.js` | 다국어 사전 (window.I18N 235키, ko/en/zh) |
| `shared/app.css` | 스타일 단일 소스 (React 앱이 import, 바닐라 클래스명 유지) |
| `archive/vanilla-v1.2.1/` | 바닐라 단일 HTML 백업 (git tag `vanilla-v1.2.1`) |
| `archive/` | 구버전 동결 — 수정 금지 |

- 명령: `npm run dev` / `npm run build`(= `tsc -b && vite build`) / `npm run typecheck`.
- 빌드는 멀티페이지: `MIDAS_RC_Modeling_Wizard.html`, `gen_nx_api_validation.html`도 `dist/`에 포함, `shared/*`는 `dist/shared/`로 복사(vite.config.ts 플러그인).
- 이전 현황(2026-10-11): **전 기능 이전 완료** — 채팅·NLP·가이드·편집카드·로그·모델·3D·결과·LLM·QA검증. 바닐라 동작 원본은 `archive/vanilla-v1.2.1/index.html`.
- 등가성 검증: jsdom(바닐라) vs Vite SSR(React)에 가짜 MIDAS 서버를 물려 10개 시나리오의 API 호출·페이로드·메시지·로그·모델 상태 비교 → 동일. 하네스는 비커밋(scratchpad).
- 액션은 `S`를 직접 변경 후 `notify()` — 로직을 바닐라와 1:1로 유지하기 위한 의도적 설계. API 호출은 아직 `client.request` 원시 호출(SDK 타입 리소스 전환은 차기).
- MAPI-Key는 바닐라와 같이 메모리(state)에만 보관, 저장 금지.

## 보안·커밋 규칙 (항상 준수)

1. **MAPI-Key는 절대 코드/커밋에 포함 금지** — 사용자가 인라인으로 줄 때만 사용.
2. **push 전 secret-scan 필수**: `grep -E "eyJ1|MAPI-Key:\s*ey|[A-Za-z0-9_-]{40,}\.[0-9a-f]{64}"`
3. **로컬 전용(비커밋)**: `GEN_NX_NEXTBUILD_REVERIFY.md`, `*.pptx/xlsx/docx`, 스크린샷, `archive/` 덤프.
4. 커밋/푸시는 사용자가 명시적으로 요청할 때만.

## 설계기준 프로필 (2026-10-11, `src/codes/`)

- **UI 언어와 독립된 축.** 기준 의존 로직(재료 DB·용도하중·하중조합·지진/풍 층력·층중량·응답스펙트럼·편집카드 지진/풍 입력항목·지역 프리셋)은 전부 `CodeProfile`(`src/codes/types.ts`)을 거친다. 액션/편집기에서 `RC.taiwanCombos`·`RC.seismicStoryForces` 등 **직접 호출 금지** → `profileOf(spec)` / `profile()`.
- `TW`(`src/codes/tw.ts`) — `shared/rc_engine.js` 대만 구현을 감쌈(동작 불변, 등가성 하네스로 검증).
- `CN`(`src/codes/cn.ts`, 2026-10-12) — **해석 범위만**(배근·도면 제외, 사용자 결정). 조합 GB 55001/55002(γG 1.3, γQ 1.5, γEh 1.4, 지진조합 방향별), 지진 GB 50011 底部剪力法(설방열도·분조·장지류별 select, 감쇠보정, δn, 최소전단계수 0.2αmax), 풍 GB 50009 wk=βz·μs·μz·w0, 응답스펙트럼 Gen NX 네이티브 `CH2010`, 질량원 활하중 0.5·不上人屋面 제외.
  - 원문/리소스 검증: Ec·νc·αc(GB50010 KB), 재료기준명 `GB/T10(RC)`(Gen NX `IDS_DB_MATLCODE_CON_GB10`). **미검증(`unverified:true`, 편집카드에 경고)**: 활하중값·조합계수·αmax/Tg·μz·T1=0.08N·DB 등급표기 `C30`·CH2010 STR 값 — GB 50011/50009/55001/55002 원문 확보 시 대조.
  - 기준 선택: 헤더 select(`setCode`, localStorage `nx_code`). 미선택이면 언어 추종(zh-CN→CN). 새 스펙은 `stampSpec()`로 `spec.code` 기록 + `adaptSpec`(대만 재료명→GB 근사 C280→C35 등). 기존 모델은 자기 `spec.code` 유지.
- 대만 하드코딩 제거 지점: 빌드 메시지 조합 참조(`comboRefs`), 계수 표기(`coefLabel` Cs/α1), 동적해석 재산정 조건(`ready`), 질량원(`massLiveRatio`·`massLiveTypes`).
- 편집카드 지진/풍 = 프로필 `fields`(number/select)·`presets`·`tipHtml` 로 렌더(`LateralSection`). 기준별로 입력 항목이 달라도 UI 코드 수정 불필요.
- 기준 추가 = `src/codes/<id>.ts` + `PROFILES` 한 줄 + `CodeId` 유니온.
- **CN(GB) 참고 메모**: Gen NX 라벨 `GB/T50010-10`, 철근 DB `GB 50917-13(RC)`/`GB/T10(RC)`, 강종 HPB300~HRB600 (`E:/AI Study/Rebar-repair/src/data/rcCodePresets.ts`). 응답스펙트럼은 `db/SPFC` `SPEC_CODE:"CH2010"`(GB50011-2010) **네이티브** 지원(`MIDAS-API/docs/manual/09_DB_Dynamic_Loads.md` 1-2-E). 콘크리트 재료 DB(STANDARD) 이름은 미확인 → 라이브 확인 필요. GB50010 원문 KB: `E:/MIDAS PROGRAM/COde/CN/knowledge/gb50010-2010/`(조문 503, chunks.jsonl). GB50011·GB50009 원문은 없음.


## i18n 패턴

- 모든 UI 문자열은 `t('key')` / `tl('log_key')` 로 호출. **키는 타입 검사됨**(`I18nKey`/`LogKey`, `src/i18n/keys.gen.ts` 자동 생성) — 오타는 컴파일 오류.
- **UI 문구는 전부 `shared/i18n.js`에만** — GUIDE(`g_*`)·HELP(`help_html`)·공급자 키 힌트(`prov_hint_*`)·건물유형(`bt_<type>_label|desc|tip`) 포함. 코드/엔진에 `{ko,en,…}` 인라인 객체 금지.
- 새 문자열 = `ko:{}` / `en:{}` / `'zh-TW':{}` 블록에 동시 추가 → `npm run i18n:check -- --write`(keys.gen.ts 갱신).
- **언어 레지스트리** `src/i18n/types.ts` `LANG_DEFS` = 지원 언어 단일 출처(code·label·html lang). 언어 추가 = 여기 한 줄 + 사전 블록.
- 대만 번체 코드 = **`zh-TW`**(구 `zh`는 `normalizeLang`이 localStorage 값 자동 변환). 폴백 = `en`.
- **구조 용어 기준(오라클)** — 직역 금지, 아래 출처의 표기를 따른다:
  - **zh-CN**: Gen NX 간체 UI 리소스 `E:/MIDAS PROGRAM/MIDAS GEN NX/Language/Chinese/*_ch.json`(UTF-8 평면 키, 15만 항목) — 출현 빈도 0인 표기는 의심. 보조: `E:/AI Study/Rebar-repair/docs/Structural_Engineer_zh-CN_Glossary_3000.json`.
  - **zh-TW**: `E:/AI Study/MIDAS-GEN-NX-UI-Local/glossary/glossary.json`(확정 용어 238 + 대륙→대만 34쌍) + 검수 완료 UI `output/Chinese(Traditional)/` + 대만 규범 용어집(`台湾建筑物耐震规范.json`, `tw2014_wind_glossary_*.json`). **설치된 Gen NX `Chinese(Traditional)` 리소스는 부정확 — 기준으로 쓰지 말 것.**
  - 확정 반영(2026-10): Brace 支撑/支撐, Element 单元/單元, Member 构件/構件, BEAMFORCE 梁单元内力/梁單元內力, Displacement 位移(TW 도 位移, 變位는 Drift), Rigid Link 刚性连接/剛性連結, Stiffness 勁度(TW), Accidental torsion 偶然扭转/意外扭矩, TW 풍 G=陣風反應因子·V10=基本設計風速. TW 규범 원문 용어 유지: 用途係數·工址·地況.
- **간체 `zh-CN`(2026-10)**: 사전은 zh-TW 블록을 OpenCC `tw2sp` + 구조 용어집(荷载·截面·构件·位移·框架·跨度·层高·振型…) + 대륙식 후처리(列→行, 登录→注册, 分页→选项卡 등)로 생성 후 검수. **현지 엔지니어 검수 전 초안.**
- **언어 ≠ 설계기준**: zh-CN 은 UI 언어일 뿐, 설계 로직은 여전히 대만(TWN-USD112). GB 기준은 별도 '설계기준 프로필' 작업(차기).
- 로컬 NLP: `parse.ts` `normalizeZh()` 가 간체 전용 글자→번체 + 대륙 어휘(创建→建立, 添加→新增, 运行→执行…) 정규화 후 기존 번체 정규식 사용 → **정규식엔 번체만 추가**하면 간체도 인식.
- 폰트: `app.css` `--cjk` 변수 — `:lang(zh-Hans)` SC 우선, `:lang(zh-Hant)` TC 우선, 그 외 KR 우선. 새 CJK 언어는 여기와 index.html Google Fonts 링크에 추가.
- `npm run i18n:check`(build·typecheck 에 포함): 함수 인자 수·타입 불일치, 폴백 누락, keys.gen 불일치 = 오류 / 일부 언어 키 누락 = 경고(`--strict` 시 오류).
- 언어 영속성: `localStorage('nx_lang')`.
- 미정리(차기): LLM SYSTEM 프롬프트 응답언어 규칙은 언어별 수동 기재(현재 ko/en/zh-TW/zh-CN). 도움말 예시 일부(`樓層數改為 20`, `結果分頁` 등)는 파서가 원래 인식 못 함(기존 결함).

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

### LLM 공급자 (2026-10 공식 문서 확인, `src/agent/llm.ts`)
- 기본 모델: Claude `claude-sonnet-5-5` · Gemini `gemini-3.8-flash` · GPT `gpt-6-luna` · DeepSeek `deepseek-flash`.
- **GPT**: Chat Completions 도구호출은 `gpt-6-luna` + `reasoning_effort:'none'`에서만. `gpt-6.1-sol`은 Chat Completions 도구호출 미지원 → 목록 제외. `gpt-6-astra`는 문서상 미확정.
- **Gemini 3**: 응답 parts(thoughtSignature 포함)를 다음 요청에 원본 그대로 재전송(`turn.raw`).
- **DeepSeek**: OpenAI 호환(`api.deepseek.com/chat/completions`), CORS 허용 확인. thinking 기본 ON → assistant `reasoning_content`를 모든 후속 요청에 재전송(누락 시 400, `turn.reasoning`).

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
- Node.js v24 / npm 설치됨 (winget, 2026-10 확인). 엔진 스모크 테스트는 node ESM으로 가능.
- 콘솔 cp949 — 한글 print 시 UnicodeEncodeError. UTF-8 파일에 쓰고 Read로 확인.
