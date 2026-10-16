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
| `shared/i18n.js` | 다국어 사전 (window.I18N ~550키, ko/en/zh-TW/zh-CN) |
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
  - **JGJ 3-2010·GB 55008-2021 KB 추가 후 재대조(2026-10-12)**: 심사 지표에 房屋高度(JGJ 3 3.3.1 A/B级 — 框架는 B级 없음)·抗震等级(GB 55002 5.2.1)·混凝土强度等级(GB 55008 2.0.2: RC ≥C25, 抗震等级 二级 이상 ≥C30) 추가. 周期比 = JGJ 3 3.4.5 대조 완료(A 0.9/B 0.85, **고층(1.0.2)에만**), 扭转位移比 상한 A 1.5/B 1.4 + 층간변위각 ≤40% 층 1.6(注), 층간변위각 150~250m 보간(3.7.3). CN 재료 카탈로그에서 C20 제외(素混凝土용). 강성비(3.5.2)는 Gen `STIFFNESS_IRREGULARITY_*` 헤더 라이브 확인 후 추가 예정. 강구조 규범(GB 50017·50018·55006)은 범위 밖.
  - **GB 50223-2008 KB 추가 후(2026-10-12)**: 지진 입력 `category`(抗震设防类别 auto/B/C) — auto = 병원(4.0.3-2)·학교(6.0.8) → 乙类, 그 외 丙类(3.0.4·6.0.12). 乙类 = 내진조치 열도 +1도로 抗震等级 산정(GB 55002 2.3.2-2), 9度+1 → 特一级(JGJ 3 3.9.3), 올린 열도의 표 높이 상한 초과 → warn(GB 50011 6.1.3-4). **지진작용은 불변**(해석 영향 없음, 심사 지표 抗震等级·混凝土强度等级만). 甲·丁类·대형 상가 규모 판정은 미구현(사용자가 B 선택).
  - **周期折减·中梁刚度放大·连梁刚度折减(2026-10-13, Gen NX 라이브 확인)** — 지진 입력 `psiT`·`beamAmp`·`cbRed`:
    - ψT(JGJ 3 4.3.17) 빈칸 = 자동(벽·코어 없음 0.7 / 있음 0.8). **모달 주기에만** 곱해 α1·δn 산정(경험식·T1 직접입력은 미적용, 최소 剪重比 λ 주기보정은 미절감 T). RS 는 CH2010 에 절감 항목이 없어 ψT<1 이면 **USER 스펙트럼 α(ψT·T)**(122점) — ψT=1 이면 네이티브 CH2010. 라이브: 같은 SPLC 배율에서 USER α(T) = 네이티브 밑면전단 0.001% 일치.
    - 中梁刚度放大 Bk(5.2.2, 기본 2.0) / 가장자리 보 (1+Bk)/2 (YJK 규칙, 층·동별 평면 외곽선) / 连梁(양 끝 벽 절점·벽 패널 테두리 아님·跨高比<5, 7.1.3) × cbRed(기본 0.7, ≥0.5). 프로필 훅 `beamStiffness` → `actBuildFrame` 이 **`/db/ESSF` 요소별 IYY_SF** PUT(보 연직 휨 = Iyy, 요소 ESSF 가 SECF 보다 우선, 전체 DELETE 502·개별 삭제 정상). 순수 함수 `src/codes/cnStiffness.ts`.
    - 라이브(사무 10층): 보 310 = 중간 ×2 170 + 가장자리 ×1.5 140, T₁ 2.194→1.849s, RS 밑면전단 ψT 0.7/1.0 = 1.33배. 단순화: 连梁 折减을 풍하중에도 적용, 연결보(link) 1.0.
  - **审图 추가 지표(2026-10-13, `src/codes/cnReviewExtra.ts`, Gen NX 라이브 확인)**:
    - 侧向刚度比 JGJ 3 3.5.2(框架 γ1 0.7·상부3층 0.8 / 벽 有 고층 γ2 0.9·1.1·嵌固层 1.5, 비고층 GB 50011 3.4.3) — `STIFFNESS_IRREGULARITY_X/Y` + `ADDITIONAL.SET_CALCULATION_METHOD.STORY_STIFFNESS_METHOD:'Story Shear / Story Drift'`(K = V/Δ kN/m, 라이브). 표 행 Level = 층 바닥 표고 → elev 로 층 매핑.
    - 刚重比 5.4.4/5.4.1 — 框架 Di·hi/ΣGj ≥10(≥20 P-Δ 생략), 벽 有 EJd = 11·V0·H³/(60u)(정적 EX/EY, `STORY_DISPLACEMENT` 평균변위) ≥1.4(2.7). G = 1.2D+1.4L(`storyGravityCN`).
    - 倾覆力矩比 8.1.3 — 벽 有만. 판 요소 벽은 Gen `OVERTURNING_MOMENT` 가 Wall 로 분류 못 함(Frame=전체) → 총 M0 는 표, 框架 Mc = Σ 기둥전단×층고 직접(BEAMFORCE). EY 는 Angle1 열이 '-'. 검증: 골조 전용에서 100.0%.
    - 轴压比 GB 50011 6.3.6 — N = 1.3(D+0.5L)+1.4|E|(RS 또는 정적), fc GB 50010 표4.1.4. 라이브: Gen 조합(gLCB) 축력과 일치(μ 1.148 vs 1.15). 框剪 계열은 倾覆力矩比 >50% 면 框架 한계, 特一级 −0.05.
    - 嵌固端刚度比 5.3.7·E.0.1(지하층 있을 때) — 등가전단강성 G·A/h 기하 산정. 风振舒适度(H≥150m)는 안내만(附录 J·H 횡풍 스펙트럼 필요).
    - 기둥 국부축: EX → Shear-z(단면 H ∥ 전역 X). review 훅 ctx 에 `model` 전달, `ReviewTable.extra` 로 post/table 인자 확장.
  - **새 스펙 보정 `prepareNew`(2026-10-13, CN 만)**: 자유 골조 = 1동(2동 연결은 JGJ 3 10.5 연체 구조 — "2栋" 명시 시만), 기둥 = 내부 부담면적×Σ1.3(D+0.5L) 로 축력 추정해 μ ≤ 0.9×轴压比 한계(`axialLimitCN`) 되게 정사각 확대(50mm 단위). 명령·도구 인자로 직접 준 항목(`_explicit`)은 보존, 안내는 계획 카드 `prepNotes`. 결과: 자유 골조 10층 600→850(라이브 μ 0.52), 사무 10층 600→900. **연체 구조**(2동+연결층) = 주 해석 RS 강제 + 审图 '连体结构' 경고(10.5.2 수직지진·10.5.4·10.5.6 미처리).
  - 알려진 단순화: 기계실(表4.2.2-7) ψc 0.9 대신 0.7 일괄, 최소전단 미달 시 층별이 아닌 전체 동일 배율 증폭, 풍 지형·풍향 계수 1.0.
  - 기준 선택: 헤더 select(`setCode`, localStorage `nx_code`). 미선택이면 언어 추종(zh-CN→CN, ko→KR). 새 스펙은 `stampSpec()`로 `spec.code` 기록 + `adaptSpec`(대만 재료명→GB 근사 C280→C35 등). 기존 모델은 자기 `spec.code` 유지.
- `KR`(`src/codes/kr.ts` + `krReview.ts`, 2026-10-12) — **해석 범위**(TW·CN 과 같은 수준, 배근·도면 제외). 원문 KB `E:/MIDAS PROGRAM/COde/KR/knowledge`(KCSC OpenAPI, 26기준).
  - 중요도 KDS 41 10 05 3.(특·1·2·3, 자동 = 종합병원 특 / 학교·5층 이상 아파트·연면적 5,000㎡ 이상 판매 1 / 그 외 2) → 41 17 00 표 2.2-1 내진등급·I_E, 풍 I_W 표 5.5-5(초고층 1.05).
  - 지진 41 17 00: S = 2.0Z(구역 I 0.22·II 0.14, Z 는 KDS 17 10 00 — KB 미보유 통상값) 또는 위험도지도 직접, 지반 S1~S5(기본 S4, 4.1.1③), Fa·Fv 표 4.2-1·4.2-2 보간, S_DS·S_D1(4.2.2), 스펙트럼 4.2.1(T_L 5s), 내진설계범주 5.2, 시스템 표 6.2-1(RC 12종 R·Ω0·Cd·범주 D 높이제한 — 2026-10-13 내력벽시스템 1-a 특수 R5·1-b 보통 R4/60m 추가, 벽식은 기둥 자동 확대 제외), Cs 7.2.2(상·하한), Ta 7.2.4(골조 0.0466hn^0.9 / 벽 0.0488hn^0.75), Cu 표 7.2-1, k 7.2.5, W 7.2.1(창고 활하중 25%), 우발편심 5%(7.2.6.4).
  - 동적 7.1: 범주 C 정형 ≥70m·21층 / 비정형 ≥20m·6층, D 정형 ≥70m / 비정형 >20m·5층 → RS 주 해석. RS 는 Gen 네이티브 `KDS(41-17-00:2019)` SPFC(IE·R_ 1.0 = 탄성 곡선) + SPLC SCALE I_E/R(7.3-3), V_t < 0.85V 이면 C_m(7.3.3.5).
  - 조합 41 12 00 1.7.1(풍 1.0W — 500년 강도설계 5.1.3), 지진 직교 100%+30%(8.1.3.3)를 범주 무관 항상 포함(정적 ±, RS +). 풍 5.: V_H = V0·K_zr(H)·I_W(K_D·K_zt 1.0), q_H = ½ρV_H², 표 5.7-1 풍상 0.8k_z(+0.05 D/B>1)·풍하 −0.5/−0.35, G_D 5.6.1(n_D ≤1Hz, β 골조 0.5/코어 1.0, 균등질량 M/M* = 2β+1)·5.6.2. n_D 기본 1/Ta, ζ_D 기본 0.02(KDS 에 수치 없음).
  - 재료 `KS19(RC)` + C21~C60, Ec = 8500∛(fck+Δf)(KDS 14 20 10 4.3.3), 단위중량 24 kN/m³(실무값). 사무실 칸막이: 활하중 +1.0(3.2.3) + SDL +0.5(7.2.1② 지진중량 = 동적 질량 일치, 중력은 0.5 보수적).
  - 검토 지표: 내진설계범주·시스템 높이(범주 D)·해석법(7.1)·층간변위 Δ = Cd·δe/I_E ≤ 0.010/0.015/0.020h(RS 는 C_m 제외)·비틀림 비정형 H-1(>1.2)·유효질량 90%·C_m. P-Δ 증폭 a_d·A_x 미반영.
    + (2026-10-13) 연층 V-1(표 5.3-2, 0.7·상층/0.8·상부 3층, `STIFFNESS_IRREGULARITY` K=V/Δ — 5.3.2 ① 130% 예외 미적용)·중량비 V-2(150%)·P-Δ 안정계수 θ = P_x/(I_E·K·h)(7.2.8.2, ≤0.1 / θ_max 0.5/C_d). 비정형 발견 + 등가정적 → 해석법 경고.
  - **균열단면(2026-10-13, Gen NX 라이브)**: 41 17 00 7.3.2 ④ → 지진 입력 `crack` kds(KDS 14 20 20 4.4.4: 기둥 0.70·보 0.35·벽 0.70)/half(14 20 10 4.3.6 50%)/none. 프로필 훅 `memberStiffness`(CN 보 배율과 공용) → `db/ESSF` 기둥·보 IYY·IZZ + **벽은 `db/WSSF` BENDING**(v3.10 WALL 요소 전환 — v3.9 의 PSSF 는 PLATE 전용). 막요소 바닥 제외. 라이브 T₁: 순수 골조 10층 ×1.55, 코어 사무 10층 ×1.22. 풍 사용성 ×1.43(4.3.6(1)) 구분 없이 전 하중 적용(단순화).
  - **새 스펙 보정 `prepareNew`(KR)**: 자유 골조 1동(2동+연결 = 격막 불연속 비정형, "2동" 명시 시만 — 그때 정형/비정형 기본 'N'), 기둥 = 내부 부담면적 Pu = Σmax(1.4D, 1.2D+1.6L) ≤ 0.9·φPn,max(14 20 20 4.1.2(7), ρ 1%·SD400·φ 0.65 — 0.9 는 휨 여유 가정). 결과: 자유 골조 10층 600→800, 사무 10층 600→950, 아파트 15층 500→900.
  - **Gen NX 라이브 확인(2026-10-12)**: 재료 `KS19(RC)` C18~C80 수용·Ec 앱 식과 −0.08%(매뉴얼 예시 `KS21(RC)` 는 이 빌드에서 Unknown Error, `KS01(RC)` 는 구 기준 Ec), 네이티브 KDS SPFC 곡선 = S_a·IE/R_(오차 0%), DCON `KDS 41 20 : 2022` 수용. 사무 10층(RS 지정)·25층(7.1 자동 RS) 전체 흐름: Gen 층중량 = 앱 산정 0.6% 이내, 0.85V 보정 후 1층 전단 = 0.85V 정확, 검토 지표 11항목. 검증 `krtest.mjs`(식 독립 재구현 76/76)·`kre2e.mjs`(가짜 MIDAS) — scratchpad.
  - 기준 자동 선택(직접 고르기 전): zh-CN→CN, **ko→KR**, 그 외 TW (`codeForLang`, store·session 공용). 한국어 도움말·가이드 재료 예시는 KDS 등급 `C30`. 기준 전환 재료 환산 `toKR(m, from)`: TW kgf/cm²→MPa, CN 입방체×0.8 → 가장 가까운 KDS 등급.
- 대만 하드코딩 제거 지점: 빌드 메시지 조합 참조(`comboRefs`), 계수 표기(`coefLabel` Cs/α1), 동적해석 재산정 조건(`ready`), 질량원(`massLiveRatio`·`massLiveTypes`).
- 편집카드 지진/풍 = 프로필 `fields`(number/select)·`presets`·`tipHtml` 로 렌더(`LateralSection`). 기준별로 입력 항목이 달라도 UI 코드 수정 불필요.
- 기준 추가 = `src/codes/<id>.ts` + `PROFILES` 한 줄 + `CodeId` 유니온.

### 해석 신뢰성 보강 (2026-10-12, Gen NX 라이브 확인 완료 — CN·TW 사무 10층)
- **슬래브 자중**(TW·CN 공통, 의도적 동작 변경): `spec.slabThk`(mm, 기본 150, 편집카드) → FBLD DL = SDL + 두께×`concreteGamma`(TW 23.5 = 2400kgf/m³, CN 25). 바닥판은 요소가 아니므로 DL 로 재하. 이전엔 누락돼 Gen 질량 ≈5.3kN/㎡.
- **지진 중량 w0 빈칸(기본) = 모델 고정하중** — `src/codes/selfweight.ts` `modelDeadWeights`(buildFrame+specSections 로 기둥·벽 반분/보·바닥 전량 + SDL + 슬래브) → 정적 지진 중량 = 동적해석 질량 출처. w0 입력 시 기존 면적×w0. TW 는 `rc_engine.seismicStoryForces(params.W)` 로 주입.
- **CN 응답스펙트럼 주 해석**: 지진 입력 `method` auto/ESL/RS, auto = 지상 H>40m(GB 50011 5.1.2, `heightAboveGround` 지하 제외). `actDynamic` 에서 RS 강제 → `S.model.rsCases`(RSX/RSY, 조합 vCOMB `ANAL:'RS'`)로 지진 조합 교체(정적 EX/EY 는 规定水平力 참고용으로 모델에 남김, `loadCases` 와 분리 — 정적 결과 회수가 `(ST)` 를 붙이므로) → `STORY_SHEAR_FORCE_COEFFICIENT` 로 층별 剪重比 ≥ λ 검사 → 미달 방향은 **SPLC SCALE η 후 재해석**(5.2.5 조문설명: 내력·변위 모두 조정). 전 층 동일 배율 = 단순화.
- 라이브: Gen 층중량 = 앱 산정(CN 8,747=8,747, TW 7,886/7,882 kN), RS 조합 `ANAL:'RS'` 수용, SCALE 재해석 반영(TW 1F V = 0.9×정적 V 정확), 심사 지표 9항목 값. 질량참여는 SUB_TABLES `PRINTOUT (1)`(%)만 — `(2)` 는 절대질량.
- **CN 정적 EX/EY 우발편심**: `seismic.staticAccEcc` 0.05 → 층 비틀림 MZ = F·0.05·L⊥ 를 CNLD 에 함께 재하(3.4.3 '具有偶然偏心的规定水平力'). + 방향 1개만.
- **심사 지표(审图) 패널**: 프로필 `review` 훅(`src/codes/cnReview.ts`) + `actions/review.ts` → `S.review` → 결과 탭 상단 표 + 채팅 요약. 동적해석 끝에 자동, 인텐트 `review`(심사/审图/指标/review). 항목: 층간변위각(5.5.1, 框架 1/550·벽 有 1/800, Δ/h 는 Gen 'Story Drift'/높이 — Gen 'Modified Drift' 는 코드계수 포함이라 미사용), 剪重比(55002 4.2.3), 扭转位移比(3.4.3 >1.2·3.4.4 ≤1.5, 정적 EX/EY), 유효질량 ≥90%(5.2.2 조문설명), 주기비 ≤0.9(JGJ 3-2010 3.4.5 — 이후 KB 대조 완료, 위 'JGJ 3-2010·GB 55008' 항목). RS 미실행이면 변위는 EX/EY(ST).
  - 층 결과 테이블은 Story Calc(`ope/STOR`) 전제 → CN 은 동적해석 doc/anal **앞**에서 `putStoryCalc` (뒤에 부르면 결과 무효화).
- **2동 층력 중복 재하 수정**(바닐라부터 있던 결함): `applyLateral` 이 층력 합계를 동마다 통째로 재하 → CNLD 합 = 2V(풍 동일). 이제 같은 층 모든 동 절점에 합계를 분배(층력 함수는 동 수를 이미 곱함). 1동 출력 불변.
- **대만 프로필 원문 재구현(2026-10-12, 사용자 결정 A)** — `src/codes/tw.ts` 가 더 이상 `rc_engine` 의 ASCE 7 식(Cs=SDS·I/R, 0.0466hn^0.9, k 지수, TL 장주기, 1.0W 조합, qz=0.613Vz²)을 쓰지 않음(Wizard 는 여전히 rc_engine 사용). KB `E:/MIDAS PROGRAM/COde/TW/knowledge/{seismic-design-code,wind-load-2014,concrete-design-code-112}`:
  - 지진 2.2 V=I/(1.4αy)·(SaD/Fu)m·W(αy=1.0), 2.10.1 V*(÷4.2, 분지 3.5)·2.10.2 VM(SMS·SM1 입력 시) 중 최대, 2.9 Ra·Fu(2-12), 표2-5(a)/2-7(a)(T0 입력=대북분지), 2.6 T=0.070hn^¾(벽 0.050)·해석주기 ≤1.4Ta, 2.11 Ft=0.07TV + Wh 분배(지상 기준, 지하 0), 2.14 우발편심 5%(정적 MZ + SPLC ACCECC), 2.8 I(병원 1.5·학교/상업 1.25), R 4.8(표1-3 RC SMRF).
  - W(2.2): 모델 고정하중 + 칸막이 75kgf/m²(지붕 외 바닥 DL 에 포함 → FBLD·질량 동일) + 활하중비(기본 0, 창고·서고 0.25). 질량원 활하중비 = liveRatio(`finalizeLateral`).
  - 동적 3.1(지상 ≥50m 또는 ≥15층 → RS 주 해석, 비정형은 method RS), 3.2 SPLC SCALE = C(T₁)=V/W 계수÷SaD(T₁), 3.3 RS 총횡력 ≥ 정적 V(T≤1.4Ta)×0.9(정형)/1.0(비정형) — 방향별 T 는 질량참여 지배 모드. 기준 훅 `rsScale0`·`rsAdjust`(CN 은 최소 剪重比).
  - 조합 112 5.3.1 (a)~(g), 방향별(EX·EY 동시 조합 없음 — 바닐라는 같은 조합에 동시 포함), 풍 1.6W·0.8W, L 0.5 감소(5.3.3) 미사용.
  - 풍 2014: q(z)=0.06K(z)[I·V10(C)]² kgf/m², K=2.774(z/zg)^2α(표2.2), G 1.88, 풍상 0.8q(z)+풍하 Cp(L/B)·q(h)(표2.4), 풍 I(2.5: 병원·학교·상업 1.1) — 지진 I 와 분리.
  - 단순화: 지하층 지진력(2.12)·Ax 증폭·±편심 2케이스·VM 지배 시 SaM 스펙트럼(SaD×비율 근사)·풍 가로/비틀림/유연건물 미구현. 검증 `twtest.mjs`(scratchpad) 27/27 — 식은 테스트 안에서 원문대로 독립 재구현.
  - **KB 재변환판 대조(2026-10-14)**: 지진·풍·조합·활하중·단위중량 식은 청크 원문과 일치. 수정 3건 — ① **Ec = 12,000√fc'(112 19.2.2.1b)**: Gen `CNS560(RC)` DB 는 구판식 ≈15,000√fc'(1.241배, 라이브) → `concreteMatl` 이 `bELAST:true, ELAST` 로 덮어씀(C350 22,016 MPa), `materials` E 도 동일식. ② 臺北盆地 프리셋 = 一·二·三區 T0 1.60/1.30/1.05(표 2-6(c), SMS 0.8·SM1 = 0.8·T0 → V_M 활성; 이전 '三區 1.6' 은 一區 값). ③ **검토 지표 훅** `src/codes/twReview.ts` — 층간변위각 ≤0.005(2.16.1, Gen 결과를 V*(I=1·T 무제한)/현재 V 로 환산)·비틀림 1.2(표1-2)·軟層 0.7/0.8·極軟層 0.6/0.7(표1-1)·질량 150%·P-Δ θ<0.1(2.13)·해석법 3.1·유효질량 90%(3.5)·RS 조정 η(3.3). 라이브(사무 10층): 변위각 0.0028/0.0029, θ 0.106 → warn.
  - **수직지진 2.18(2026-10-14, 사용자 확정 해석)**: 프로필 훅 `verticalForces`(`verticalTW`) → 케이스 `EV`(type USER, 하향 양수, 층 절점 균등). SaD,V = ½SDS, F_uv: R=3 → Ra 1+2/1.5(분지 2.0)·√(2Ra−1), 보·바닥 K_z = max(I/1.4·m, I·F_uv/4.2·m)(C2-10·C2-11a), 기둥·벽 0.4·SDS·I/2(`modelColumnWeights`). 조합: 112 (e)(g) 에 Eh 100%+EV ±30%·Eh 30%+EV ±100% 추가(해설 C2-12~15 의 비율, 계수는 112 5.3.1). 지진 입력 `vertical` Y/N. 라이브: 사무 10층 EV 합 8,757 kN, 조합 29.
  - **v3.12.0(2026-10-16)**: ① `prepareNew`(TW) — 기둥 = 내부 부담면적 Pu ≤ 0.9φPn,max(112, ρ1%·fy420·φ0.65). P-Δ θ 는 기둥을 키워도 보 강성에 막혀 포화(사무 10층 C600 0.106 → C950 0.069)라 크기 기준이 아니라 ② **P-Δ 훅** `pDelta` → `/db/PDEL`(`{ITER,TOL,PDEL_CASES:[{LCNAME,FACTOR}]}`, 1.2D+1.0L, 라이브 수용) — 지진 입력 `pdelta` auto(θ 추정 ≥0.1: `thetaTW`, Muto D값 ×KM 1.35)/Y/N, 벽·코어 있으면 auto 미적용. 검토 지표 θ 경고는 P-Δ 적용 시 info. ③ **우발편심 ± 2케이스** `eccBoth`(EX/EXm·EY/EYm, 조합 43~49개) + **비틀림 증폭 A_x** `torsionAmp`(해석 뒤 정적 EX/EY 의 δmax/δavg → A_x=(r/1.2)²≤3.0, 비틀림 몫(`S.model.lat`의 tor)에만 곱해 CNLD 재PUT·재해석, RS 는 ACCECC % ×최대 A_x). 라이브(코어 모서리): MZ 13,547→14,297 kN·m, ACCECC 5→11.4%, 비틀림 1.51/1.87 경고. ④ KR `reconcileEdit` — 카드에서 시스템·내력벽 토글 시 `colAuto` 로 자동 확대 기둥 복원/재확대(`reconcileEditor`, PlanCard). ⑤ **`npm test`**(`tests/tw.test.mjs` 99·`kr.test.mjs` 92, `_harness.mjs` Vite SSR) — 식을 원문대로 독립 재구현.
  - ⚠ 라이브 검증 주의: 같은 Gen NX 에 다른 클라이언트(예: Codex)가 동시에 doc/new·빌드하면 모델이 섞여 해석이 실패("Load information has not been entered")함 — 검증은 Gen NX 단독 사용 시.
  - **미구현**: 2.10·2.11 풍 횡풍·비틀림 · 2.15 전도모멘트 · 2.17 극한층전단강도 · 표1-1 3(입면기하)·표1-2 2~5.
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
- **언어 ≠ 설계기준**: UI 언어와 설계기준(TW/CN/KR 프로필)은 독립 축 — 기준 미선택 시에만 언어를 따라 자동 선택(위 '설계기준 프로필').
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

GUIDE 패널: `GUIDE` 배열(`src/agent/guide.ts`) → `Guide.tsx`. 그룹(2026-10-13): 모델 생성·모델 수정·해석·결과·모델 관리·도움말(사용자 매뉴얼·릴리즈 노트 — 인텐트 `release_notes` → `S.rnOpen`). 하중·보강(add_load·add_bracing)은 메뉴에서 제외 — 'add wind load' 는 옥상 연직 Fz 라 실제 풍하중 아님. **클릭 = 입력창에 타이핑해 보인 뒤 실행**(`runCmd` → Composer `typeAndRun`, 전 항목 동일). `need:'review'` = 그 프로필 훅이 있을 때만 표시. 채팅|우측 분할 폭 = `--split`(드래그, localStorage `nx_split`).

## 전단벽 코어 배치 (2026-10-13)
- `spec.core = {on, thick, ix, iy, nx, ny, layout, pos, skip}` → `RC.coreLayout`(범위 보정·동별 위치)·`RC.coreWalls`(동 번호 붙은 core 벽) — `autoCore` 는 Wizard 호환용으로만 남김. ix/iy 빈값 = 가운데(구 autoCore 와 동일).
- 2동 이상: layout `same`(같은 위치)·`mirror`(짝수 번째 동 X 대칭)·`each`(동별 `pos`), `skip` = 코어 없는 동. **이전엔 2동이어도 A동에만 코어**(autoCore 가 동 번호 없음 — 결함 수정).
- 편집 카드 `CoreSection`: 미니 평면 격자(칸 클릭 = 좌하단 이동)·◀▲▼▶·가운데·크기 1×1~2×2·적용 동·배치. LLM `build_frame/update_spec.core`, `get_status` 가 현재 배치(절대 인덱스) 제공. `buildSpec` 은 코어 벽을 항상 현재 형상으로 재생성.
- 라이브(KR 2동 10층, v3.9 PLATE 시절): 벽 패널 80 = 동마다 40, 좌우 대칭(바깥 끝) 비틀림 Y 1.33 → 1.05.

## 벽 요소·내력벽(벽식) (2026-10-13, Gen NX 라이브)
- **벽 = Gen `WALL` 요소**(STYPE 2 plate, Wall ID = 동·벽 정의·평면별). PLATE 벽은 Gen 층 결과표(층간변위·비틀림·강성·전도모멘트)의 '수직 부재'로 인식되지 않아 기둥 없는 모델에서 전부 0 → WALL 로 전환(전도모멘트도 Frame/Wall 분리).
- 벽 강성 배율 = **`/db/WSSF`(키 = WALL 요소 번호) `{SHEAR, BENDING}`** — BENDING = 면내 휨(×0.7 → T₁ +12.9%), SHEAR = 면내 전단(+2.9%). PSSF 는 WALL 요소에 입력 불가. KR 균열 벽 0.70Ig → BENDING 만.
- **내력벽 `spec.bearing = {on, thick}`** → `RC.bearingWalls`(세대 경계벽 = 모든 X 그리드선 Y 방향 전체 깊이 + 복도벽 = 가운데 선 X 방향, 양 끝에서 한 베이 걸러 좌우 대칭), `RC.specWalls` = 코어 + 내력벽, **`RC.resolveWalls`** = 코어·내력벽이 켜져 있으면 항상 현재 형상으로 재생성(저장된 walls 는 층수·경간 변경 시 낡음 — v3.10.1 수정, 모델 생성·자중·3D 미리보기 공용). bearing.on 이면 벽 속 기둥 생략, 벽 위 보 `inWall` = ESSF WGT_SF 0(벽 자중에 포함, 바닥하중 전달용) — 코어 위 보도 동일(모든 기준).
- **KR 아파트 = 벽식**(prepareNew, 기둥 크기 직접 지정 시 골조 유지): 6×4.2m · 2×5.4m · 층고 2.9m · 슬래브 210 · 벽 200 · 보 B200x500(인방) · 필로티 없음, 시스템 1-b(지상 60m 초과 1-a). 편집 카드 '내력벽 (벽식)' 토글(KR).
- **KR 부재 단위중량 `memberGamma` 23.54**(Gen KS19(RC) DB 2,400 kgf/m³) — 슬래브 하중은 24. 이전 KR 앱 자중이 Gen 보다 부재분 ~1.9% 컸음.
- 라이브(KR 아파트 15층): 기둥 0·WALL 270·WSSF 270, DL 반력 = 앱 자중 47,967 kN, LL = 25.2×10.8×2.0×14 정확, EX = 앱 V, 층 표 지표 전부 값, T₁ 0.768 s, 비틀림 Y 1.21(긴 판상형 ±5% 우발편심 — 실제 신호). CN 코어 사무 10층: WALL 40, 倾覆力矩比 20.4%/21.6%.

## 후속 과제 (2026-10-14 기준, v3.10.1)
- **KR 편집 카드에서 시스템을 내력벽으로 바꿔도 기둥 확대가 되돌려지지 않음** — `prepareNew` 는 카드 생성 시 1회(그때 시스템 기본값 기준). 벽식 아파트 템플릿은 처음부터 bearing 이라 해당 없음.
- 검토 지표 비틀림 경고 → 코어 배치(편집 카드) 안내·링크 아이디어(미구현).
- KR 미반영: 5.3.2 ① 층간변위각비 130% 예외(V-1), P-Δ 증폭 a_d 적용, 비틀림증폭 A_x, 우발편심 ± 2케이스. 벽식 개구부(문·창)는 단순화(복도벽 한 베이 걸러).
- 벽식 템플릿은 KR 만 — CN·TW 아파트는 골조 그대로. 지하층 벽식·필로티 미구현.

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
- **다이어프램(2026-10-13 라이브)**: Story Data `bFLOOR_DIAPHRAGM` 은 층 전체 절점을 한 강체로 묶음(떨어진 2동도 매 층 한 몸 — 동 A 만 가력해도 동 B 동일 변위). **`db/RIGD` 가 `db/STOR` 와 함께 있으면 해석 거부**('Analysis is not allowed', RIGD 1개만 있어도 / STOR 없으면 허용) → rigd 옵션은 Story Data 사용 시 story 다이어프램으로 대체. **2동 이상 = 다이어프램 OFF + 동별 막요소 바닥**(`putFloorMembranes`: PLSTRS STYPE 1, 사용자 재료 DEN·MASS 0, 두께 = 슬래브, 연결층은 동 사이 연결 슬래브) — PLSTRS+STOR 해석 허용, 동 지붕 DX 편차 0.1~0.2%, 동 B/A 0.73(연결층 경유). 정적 우발편심은 2동이면 동별 강체회전 힘 짝(합력 0)으로, Story Data 우발편심 폭 = 1동 폭.
- **`DELETE db/LCOM-GEN` 은 Assign 번호를 무시하고 조합 전체를 지움**(2026-10-12 라이브) → `putCombos` 는 조합 수가 줄 때만 PUT 앞에서 전체 DELETE.
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
도구 버전: **`package.json` version 이 단일 출처** — 헤더는 vite `define`(`__APP_VERSION__`·`__BUILD_DATE__` KST)로 자동 표시, 문자열 하드코딩 금지. 바닐라 시절 태그 v2.x·v1.2.1 과 겹치지 않게 React 판은 3.x부터. 0616·0617·0624 검증은 Gen NX 06/12 빌드 기준.
- **버전업·릴리즈 노트 규칙 (2026-10-15, Rebar-repair 방식 이식)**: 사용자에게 보이는 변경을 푸시할 때마다 버전을 올리고 노트를 **같은 커밋**에 쓴다. 손으로 버전을 고치지 말 것.
  1. `npm run release -- minor|patch [--items N]` (기능 = minor, 결함·문구 = patch, major 는 사용자 지시 시만) → package.json(+lock) 버전, `src/data/releases.json` 맨 앞 `{version,date,time(KST),id,items}`, `src/data/releaseNotes.json` 에 ko·en·zh-TW·zh-CN 빈 노트 N개 생성.
  2. 노트를 4개 언어로 한 줄씩 작성(사용자 눈높이, ko 먼저). 다 채우기 전엔 `release-check`(`npm run build`·`typecheck`에 포함, Vercel 포함)가 실패 — 버전과 노트가 따로 갈 수 없음.
  3. 푸시·main ff·태그 `vX.Y.Z`·운영 확인. 내부 변경(테스트·리팩터·CLAUDE.md)은 버전업 불필요.
  - 하단 버전 클릭 = 릴리즈 노트 창(`ReleaseNotes.tsx`): 새 방식 항목은 현재 UI 언어, v3.10.1 이전은 `CHANGELOG.md`(한국어 보존용, 더 이상 추가하지 않음).
  - 이력: 3.11.0 부터 새 방식.

## 개발 환경 주의
- Node.js v24 / npm 설치됨 (winget, 2026-10 확인). 엔진 스모크 테스트는 node ESM으로 가능.
- 콘솔 cp949 — 한글 print 시 UnicodeEncodeError. UTF-8 파일에 쓰고 Read로 확인.
