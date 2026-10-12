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
- `TW`(`src/codes/tw.ts`) — 2026-10-12 대만 규범 원문 기준 재구현(아래 '해석 신뢰성 보강' 참조). 재료·용도하중·지역 프리셋만 `shared/rc_engine.js` 공유.
- `CN`(`src/codes/cn.ts`, 2026-10-12) — **해석 범위만**(배근·도면 제외, 사용자 결정). 조합 GB 55001/55002(γG 1.3, γQ 1.5, γEh 1.4, 지진조합 방향별), 지진 GB 50011 底部剪力法(설방열도·분조·장지류별 select, 감쇠보정, δn, 최소전단계수 0.2αmax), 풍 GB 50009 wk=βz·μs·μz·w0, 응답스펙트럼 Gen NX 네이티브 `CH2010`, 질량원 활하중 0.5·不上人屋面 제외.
  - **원문 대조 완료(2026-10-12)** — KB `E:/MIDAS PROGRAM/COde/CN/knowledge/{gb50009-2012,gb50011-2010,gb55001-2021,gb55002-2021,gb50010-2010}/chunks.jsonl`: 활하중(55001 表4.2.2·4.2.8), γG·γQ(55001 3.1.13), 풍 ψc 0.6(50009 8.1.4), G_E 조합값(55002 表4.1.3), αmax·Tg(55002 表4.2.2), 곡선·감쇠(50011 5.1.5), Geq·δn(50011 5.2.1), γEh 1.4(55002 4.3.2 = 50011 2024 局部修订 5.4.1), μz(50009 表8.2.1 — 식이 표 재현), μs(表8.3.1-30), RC 단위중량 24~25(50009 附录A), Ec·νc·αc(50010).
  - 원문 대조로 고친 것: **최소 지진전단계수 = 층별 검사 + 주기보정**(55002 4.2.3, 미달 시 전 층력 증폭), **경험주기 T1 = 0.25+0.53e-3·H²/∛B**(50009 F.2.2-1, B=평면 장변 → 보수적), **βz ≥ 1.2·w0 ≥ 0.30 강제**(55001 4.6.5·4.6.2).
  - **Gen NX 라이브 확인 완료(2026-10-12)** → `unverified` 해제: 재료 `GB/T10(RC)`·`GB(RC)` + `C20~C80` 수용(`GB19(RC)`는 `C30` 거부), Gen DB 의 Ec = 10⁵/(2.2+34.7/fcu)(표값과 ≤1%), SPFC `CH2010` `EQ_` 은 `FREQUENT/MIDDLE/SCARCE` 대문자만, **생성 곡선이 앱 `alphaOf` 와 전 구간 일치**(감쇠 0.04~0.07 포함 4사례 오차 0), DCON `GB/T50010-10`·`GB50010-02` 수용, **SSEIS/SWIND 중국 코드 미지원**(Wrong Field). SPFC 는 PUT 키와 무관하게 1부터 재번호(이름으로 참조).
  - 알려진 단순화: 기계실(表4.2.2-7) ψc 0.9 대신 0.7 일괄, 최소전단 미달 시 층별이 아닌 전체 동일 배율 증폭, 풍 지형·풍향 계수 1.0.
  - 기준 선택: 헤더 select(`setCode`, localStorage `nx_code`). 미선택이면 언어 추종(zh-CN→CN). 새 스펙은 `stampSpec()`로 `spec.code` 기록 + `adaptSpec`(대만 재료명→GB 근사 C280→C35 등). 기존 모델은 자기 `spec.code` 유지.
- 대만 하드코딩 제거 지점: 빌드 메시지 조합 참조(`comboRefs`), 계수 표기(`coefLabel` Cs/α1), 동적해석 재산정 조건(`ready`), 질량원(`massLiveRatio`·`massLiveTypes`).
- 편집카드 지진/풍 = 프로필 `fields`(number/select)·`presets`·`tipHtml` 로 렌더(`LateralSection`). 기준별로 입력 항목이 달라도 UI 코드 수정 불필요.
- 기준 추가 = `src/codes/<id>.ts` + `PROFILES` 한 줄 + `CodeId` 유니온.

### 해석 신뢰성 보강 (2026-10-12, Gen NX 라이브 확인 완료 — CN·TW 사무 10층)
- **슬래브 자중**(TW·CN 공통, 의도적 동작 변경): `spec.slabThk`(mm, 기본 150, 편집카드) → FBLD DL = SDL + 두께×`concreteGamma`(TW 23.5 = 2400kgf/m³, CN 25). 바닥판은 요소가 아니므로 DL 로 재하. 이전엔 누락돼 Gen 질량 ≈5.3kN/㎡.
- **지진 중량 w0 빈칸(기본) = 모델 고정하중** — `src/codes/selfweight.ts` `modelDeadWeights`(buildFrame+specSections 로 기둥·벽 반분/보·바닥 전량 + SDL + 슬래브) → 정적 지진 중량 = 동적해석 질량 출처. w0 입력 시 기존 면적×w0. TW 는 `rc_engine.seismicStoryForces(params.W)` 로 주입.
- **CN 응답스펙트럼 주 해석**: 지진 입력 `method` auto/ESL/RS, auto = 지상 H>40m(GB 50011 5.1.2, `heightAboveGround` 지하 제외). `actDynamic` 에서 RS 강제 → `S.model.rsCases`(RSX/RSY, 조합 vCOMB `ANAL:'RS'`)로 지진 조합 교체(정적 EX/EY 는 规定水平力 참고용으로 모델에 남김, `loadCases` 와 분리 — 정적 결과 회수가 `(ST)` 를 붙이므로) → `STORY_SHEAR_FORCE_COEFFICIENT` 로 층별 剪重比 ≥ λ 검사 → 미달 방향은 **SPLC SCALE η 후 재해석**(5.2.5 조문설명: 내력·변위 모두 조정). 전 층 동일 배율 = 단순화.
- 라이브: Gen 층중량 = 앱 산정(CN 8,747=8,747, TW 7,886/7,882 kN), RS 조합 `ANAL:'RS'` 수용, SCALE 재해석 반영(TW 1F V = 0.9×정적 V 정확), 심사 지표 9항목 값. 질량참여는 SUB_TABLES `PRINTOUT (1)`(%)만 — `(2)` 는 절대질량.
- **CN 정적 EX/EY 우발편심**: `seismic.staticAccEcc` 0.05 → 층 비틀림 MZ = F·0.05·L⊥ 를 CNLD 에 함께 재하(3.4.3 '具有偶然偏心的规定水平力'). + 방향 1개만.
- **심사 지표(审图) 패널**: 프로필 `review` 훅(`src/codes/cnReview.ts`) + `actions/review.ts` → `S.review` → 결과 탭 상단 표 + 채팅 요약. 동적해석 끝에 자동, 인텐트 `review`(심사/审图/指标/review). 항목: 층간변위각(5.5.1, 框架 1/550·벽 有 1/800, Δ/h 는 Gen 'Story Drift'/높이 — Gen 'Modified Drift' 는 코드계수 포함이라 미사용), 剪重比(55002 4.2.3), 扭转位移比(3.4.3 >1.2·3.4.4 ≤1.5, 정적 EX/EY), 유효질량 ≥90%(5.2.2 조문설명), 주기비 ≤0.9(**JGJ 3-2010 3.4.5 — KB 없음, 미대조**). RS 미실행이면 변위는 EX/EY(ST).
  - 층 결과 테이블은 Story Calc(`ope/STOR`) 전제 → CN 은 동적해석 doc/anal **앞**에서 `putStoryCalc` (뒤에 부르면 결과 무효화).
- **2동 층력 중복 재하 수정**(바닐라부터 있던 결함): `applyLateral` 이 층력 합계를 동마다 통째로 재하 → CNLD 합 = 2V(풍 동일). 이제 같은 층 모든 동 절점에 합계를 분배(층력 함수는 동 수를 이미 곱함). 1동 출력 불변.
- **대만 프로필 원문 재구현(2026-10-12, 사용자 결정 A)** — `src/codes/tw.ts` 가 더 이상 `rc_engine` 의 ASCE 7 식(Cs=SDS·I/R, 0.0466hn^0.9, k 지수, TL 장주기, 1.0W 조합, qz=0.613Vz²)을 쓰지 않음(Wizard 는 여전히 rc_engine 사용). KB `E:/MIDAS PROGRAM/COde/TW/knowledge/{seismic-design-code,wind-load-2014,concrete-design-code-112}`:
  - 지진 2.2 V=I/(1.4αy)·(SaD/Fu)m·W(αy=1.0), 2.10.1 V*(÷4.2, 분지 3.5)·2.10.2 VM(SMS·SM1 입력 시) 중 최대, 2.9 Ra·Fu(2-12), 표2-5(a)/2-7(a)(T0 입력=대북분지), 2.6 T=0.070hn^¾(벽 0.050)·해석주기 ≤1.4Ta, 2.11 Ft=0.07TV + Wh 분배(지상 기준, 지하 0), 2.14 우발편심 5%(정적 MZ + SPLC ACCECC), 2.8 I(병원 1.5·학교/상업 1.25), R 4.8(표1-3 RC SMRF).
  - W(2.2): 모델 고정하중 + 칸막이 75kgf/m²(지붕 외 바닥 DL 에 포함 → FBLD·질량 동일) + 활하중비(기본 0, 창고·서고 0.25). 질량원 활하중비 = liveRatio(`finalizeLateral`).
  - 동적 3.1(지상 ≥50m 또는 ≥15층 → RS 주 해석, 비정형은 method RS), 3.2 SPLC SCALE = C(T₁)=V/W 계수÷SaD(T₁), 3.3 RS 총횡력 ≥ 정적 V(T≤1.4Ta)×0.9(정형)/1.0(비정형) — 방향별 T 는 질량참여 지배 모드. 기준 훅 `rsScale0`·`rsAdjust`(CN 은 최소 剪重比).
  - 조합 112 5.3.1 (a)~(g), 방향별(EX·EY 동시 조합 없음 — 바닐라는 같은 조합에 동시 포함), 풍 1.6W·0.8W, L 0.5 감소(5.3.3) 미사용.
  - 풍 2014: q(z)=0.06K(z)[I·V10(C)]² kgf/m², K=2.774(z/zg)^2α(표2.2), G 1.88, 풍상 0.8q(z)+풍하 Cp(L/B)·q(h)(표2.4), 풍 I(2.5: 병원·학교·상업 1.1) — 지진 I 와 분리.
  - 단순화: 지하층 지진력(2.12)·Ax 증폭·±편심 2케이스·VM 지배 시 SaM 스펙트럼(SaD×비율 근사)·풍 가로/비틀림/유연건물 미구현. 검증 `twtest.mjs`(scratchpad) 27/27 — 식은 테스트 안에서 원문대로 독립 재구현.
- **CN(GB) 참고 메모**: Gen NX 라벨 `GB/T50010-10`, 철근 DB `GB 50917-13(RC)`/`GB/T10(RC)`, 강종 HPB300~HRB600 (`E:/AI Study/Rebar-repair/src/data/rcCodePresets.ts`). 응답스펙트럼은 `db/SPFC` `SPEC_CODE:"CH2010"`(GB50011-2010) **네이티브** 지원(`MIDAS-API/docs/manual/09_DB_Dynamic_Loads.md` 1-2-E). 콘크리트 재료 DB(STANDARD) 이름은 미확인 → 라이브 확인 필요. GB50010 원문 KB: `E:/MIDAS PROGRAM/COde/CN/knowledge/gb50010-2010/`(조문 503, chunks.jsonl). GB50011·50009·55001·55002 원문 KB 는 2026-10-12 추가됨(위 대조 완료 참조).


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
- **공유 링크 언어**: `/zh-CN/`·`/zh-TW/`·`/en/`·`/ko/`(빌드 시 언어별 정적 index.html + og 메타 = i18n `meta_title`/`meta_desc`, `vite.config.ts` langPages — 메신저 미리보기는 JS 미실행이라 정적 메타 필수). 링크·`?lang=` 언어 > 저장값, 언어 변경 시 주소 동기화(`syncLangUrl`).
- 언어 영속성: `localStorage('nx_lang')`. 첫 방문은 **브라우저 언어**(`detectLang`: zh-TW/HK/MO·Hant→zh-TW, 그 밖의 zh→zh-CN, ko, en, 미지원→en). IP 기반 아님.
- 미정리(차기): LLM SYSTEM 프롬프트 응답언어 규칙은 언어별 수동 기재(현재 ko/en/zh-TW/zh-CN). 도움말 예시 일부(`樓層數改為 20`, `結果分頁` 등)는 파서가 원래 인식 못 함(기존 결함).

## 로컬 NLP 구조

```
parseCommand(txt) → {intent, ...params}
handleLocal(txt)  → intent에 따라 API 호출 or 즉시 응답
```

**인텐트 목록**: `help` · `tab{3d|result|log|model}` · `conn_check` · `clear` · `build` · `modify_section` · `resize_subset` · `add_load` · `add_bracing` · `change_spec{matName|hTyp|stories}` · `dynamic` · `analyze` · `result{disp|react|force}` · `status` · `unknown`

GUIDE 패널: `GUIDE` 배열(`src/agent/guide.ts`) → `Guide.tsx`. **클릭 = 입력창에 타이핑해 보인 뒤 실행**(`runCmd` → Composer `typeAndRun`, 전 항목 동일). `need:'review'` = 그 프로필 훅이 있을 때만 표시. 채팅|우측 분할 폭 = `--split`(드래그, localStorage `nx_split`).

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
- **층 결과 테이블(STORY_DRIFT·STORY_SHEAR_FORCE_COEFFICIENT·TORSIONAL/STIFFNESS/WEIGHT_IRREGULARITY 등)은 GUI 없이 동작** — `db/STOR`+`ope/STOR`만으로 충분(2026-10-12 라이브). SSEIS/SWIND 만 GUI Auto Generate 의존.
- **SPLC `DIR`은 `"XY"`/`"Z"`만** — 수평 RSX/RSY 는 `ANGLE` 0°/90°. 우발편심 `bACCECC` 네이티브(Gen NX 전용).
- **자동저장 `doc/saveas` = `C:/temp/…` 고정** — 사용자 폴더 추정 경로는 Gen NX 모달("잘못된 경로")로 해석을 막음.

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

### LLM 도구·프롬프트 (2026-10-12, `src/agent/llm.ts`)
- **`tools()`·`system()` 은 요청마다 현재 프로필에서 생성** — build_frame/update_spec 의 `seismic`·`wind` 스키마 = 프로필 `fields`(키·라벨·단위·select 선택지·기본값), `matName` enum = 프로필 재료 카탈로그, 시스템 프롬프트 = 기준 요약(`CODE_BRIEF`) + 현재 모델·연결 상태. 기준/필드 추가 시 LLM 쪽 수정 불필요(`CODE_BRIEF` 한 줄만).
- 도구 26 — Gen NX: build_frame·update_spec(스펙 병합 재생성)·modify_section·resize_subset·add_load·add_bracing·run_analysis·run_dynamic(rs)·review_indicators·get_result·get_status·set_design_code·clear_model·verify_*. 동적·심사 결과 HTML 은 채팅에 그대로 남기고 LLM 에는 평문.
- **웹 UI 제어(Gen NX 불필요)**: propose_model(확인 카드+3D 미리보기)·confirm_build, set_view(카메라 iso/front/side/top·확대·표시 항목 — `S.view3d` 를 툴바 버튼과 공유, `View3D.setView`), show_results·query_results(결과 표를 kN·kN·m·mm 로 읽기 — 열 최대·상위 N·절점/요소·하중케이스 필터), get_dynamic·get_review, set_theme, show_panel.
- 3D 뷰: 입면·평면 = 정투영(front/side 수평 시점, top 은 X 가로), 정투영 확대는 aspectratio 배율(Plotly 정투영은 카메라 거리 무시).
- 검증: 가짜 Claude + 가짜 MIDAS 로 CN 기준 전환→빌드(8度·III类)→정적→RS→审图→update_spec 연쇄(scratchpad `llme2e.mjs`), Gemini 스키마 정규화·GPT/DeepSeek 생성 확인.

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
도구 버전: **`package.json` version 이 단일 출처**(현재 `3.3.0`) — 헤더는 vite `define`(`__APP_VERSION__`·`__BUILD_DATE__` KST)로 자동 표시, 문자열 하드코딩 금지. 릴리즈 시 version 올리고 `CHANGELOG.md` 맨 위에 항목 추가 + git 태그 `vX.Y.Z`. (바닐라 시절 태그 v2.x·v1.2.1 과 겹치지 않게 React 판은 3.x부터.) 0616·0617·0624 검증은 Gen NX 06/12 빌드 기준.

## 개발 환경 주의
- Node.js v24 / npm 설치됨 (winget, 2026-10 확인). 엔진 스모크 테스트는 node ESM으로 가능.
- 콘솔 cp949 — 한글 print 시 UnicodeEncodeError. UTF-8 파일에 쓰고 Read로 확인.
