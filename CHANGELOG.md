# Changelog — MIDAS RC Modeling Wizard

## v2.11.0 — 2026-06-14 (기둥 P-M 곡선 고도화) — 둘레 다층배근 + φPn,max 축캡

`/POST/PM` 라이브 조사(§MAPI_FINDINGS C++++++++)로 확인된 코드기반 P-M 계약을 우리 자체 해석곡선에 반영·고도화.

- **주근 둘레 다층 분포** (`colLayers`) — 기존 2층(상·하면 As/2) 이상화 → **단면 둘레 균등 분포**로
  측면근(side bars) 기여를 정확히 반영. 굽힘축별(강축 x/약축 y) 깊이별 철근층 자동 생성.
- **φPn,max 평탄캡** (`colPMcurve`) — ACI 318/TWD-USD112 띠철근 압축 상한 **φPn,max = 0.80·φ·Po** 추가.
  순축 squash 하중을 캡으로 클립(이전엔 미적용 = 압축측 과대평가). `Po` 순축 공칭도 산출.
- **실배근 곡선 노출** — `rcColumnDesign`이 확정 주근(nBars)으로 P-M 곡선 재계산·U 재평가,
  결과에 `pm{x,y,Po,phiPnMax,MnX,MnY,balX,balY}` 추가(QA·플롯·`/POST/PM` 교차검증용).
  화면에 `φPn,max·P/cap%` 표시, 축캡 초과 시 over.
- **균형점 검출** — 인장철근 항복 개시(εt=εty) 전이점 포착(`balanced`).
- **하위호환** — 기존 `colPMpoints/colMcapAt` 시그니처는 8층 둘레균등 래퍼로 유지.
- **검증**(py-mini-racer): 600×600·fc28·fy420 → Po 10,101kN(수계산 일치)·φPn,max 5,253kN(=0.8·0.65·Po, 곡선 maxP와 일치)·
  10-D22·ρ1.07%·U0.751·대칭축 MnX=MnY=558.9kN·m·곡선 118점.
- **★문서 정정**: `db/DCON`에 **`TWN-USD112`(대만 건물 RC)가 네이티브 존재**(라이브 확인) — 위키 "교량코드뿐" 정정.
  `/POST/PM`은 엔드포인트·I/O·RCHK 스키마 검증됨(실곡선은 db/RCHK 부재+요청정형 미공개로 GUI 설계 선행 필요 → 선택적 교차검증).
- **★동적해석 주기 회수 수정**(`actDynamic`) — 모달 주기 테이블은 **`EIGENVALUEMODE`**의 `SUB_TABLES["EIGENVALUE ANALYSIS"]`(Period(sec))에 있음.
  기존엔 `PARTICIPATIONVECTORMODE`(모드형상만·SUB_TABLES 없음)를 조회 → 그래서 "SUB_TABLES 미반환"으로 오판했음.
  **라이브 검증(2026-06-14)**: EIGENVALUEMODE 조회 → `pickModalPeriods`가 15모드·**T₁=1.1214s** 정상 파싱(실모델 459절점 RC빌딩).
  EIGENVALUEMODE는 참여질량 SUB_TABLE도 함께 반환(향후 활용 여지). 메시지도 "해석 후 재시도"로 정정.

## v2.10.1 — 2026-06-14 (M2-A4 실모델 검증 수정) — 고유치 Lanczos

실모델(2층 RC 프레임) end-to-end 라이브 검증에서 나온 수정.

- **고유치 = Lanczos 고정** (`eigvPayload` TYPE `EIGEN`→`LANCZOS`). 질량을 `db/LTOM(DIR:"XY")`로 넣으면
  **off-diagonal 질량**이 생겨 Subspace Iteration이 `doc/anal`에서 "Analysis is not allowed"로 거부됨.
  MIDAS 제약("off-diagonal 질량 시 Lanczos만 가능")에 따라 Lanczos로 전환 → **해석 실행 성공(실검증)**.
  (이전에 "라이선스 제한"으로 본 것은 오진 — Dennis의 다이얼로그 에러 제보로 규명.)
- **주기 회수 보강** (`pickModalPeriods`) — `PARTICIPATIONVECTORMODE` 응답의 `SUB_TABLES[].EIGENVALUEANALYSIS`
  (HEAD에 Period(sec))를 **재귀 탐색**. 단 일부 서버 버전은 SUB_TABLES 미반환 → 그 경우 주기 없이 모드형상만(메시지 안내).
- **actDynamic 메시지 정정** — "라이선스" 문구 제거, 해석 거부/주기 미반환 상황을 정확히 안내.
- **검증**: doc/anal "command complete"(Lanczos), 모드형상 회수 OK, pickModalPeriods SUB_TABLES 파싱 OK.
  `db/STOR`(Story Data, WIND_*/SEIS_* 보유)은 정적 횡하중 생성의 향후 단서(미해결). 상세: MAPI_FINDINGS.

## v2.10.0 — 2026-06-13 (M2-A4 동적해석) — 고유치·응답스펙트럼 + 연결·결과회수 정교화

API 전수조사(공식 매뉴얼 + 라이브 Gen/Civil 검증, [MAPI_FINDINGS.md](MAPI_FINDINGS.md)) 결과를 제품에 반영.
"동적해석 API 차단"은 오판이었고(이름 오추측·필수필드 누락), 실제 스키마로 정식 구현.

- **동적해석(M2-A4)** — `actDynamic()` + 엔진 `twDesignSpectrum`/`eigvPayload`/`splcPayload`/`pickModalPeriods`.
  - **고유치**(`db/EIGV`, Subspace) — 질량(자중 `db/styp` bSELFWEIGHT + 하중→질량 `db/LTOM`) → 모드해석.
  - **실주기 T₁ 회수**(`post/table` PARTICIPATIONVECTORMODE의 Period 서브테이블 파싱) → 경험식 Ta 대신
    **해석 주기로 지진 Cs·V 재산정**(`seismicStoryForces({T:T₁})`).
  - **응답스펙트럼**(옵션) — 대만 설계스펙트럼(SDS/SD1 → ASCE-7 형상, 규범 Cs식과 정합)을 `db/SPFC`(aFUNC),
    `db/SPLC` RSX·RSY(CQC·전체모드)로 정의. 명령: "동적해석"/"고유치"/"응답스펙트럼".
  - 라이브 검증: EIGV/SPFC/SPLC/styp 201·200, PARTICIPATIONVECTORMODE 타입 수용 확인.
- **연결 사전점검**(Track A) — `testConn`이 `/mapikey/verify` 사용(status·keyVerified·program 반환).
  **제품 가드**: program≠gen이면 경고(이 도구는 Gen NX 전용). 'client does not exist' 사전 차단.
- **결과회수 정교화**(Track D) — `fetchTable`에 `UNIT:{FORCE:'N',DIST:'MM'}` 명시 →
  모델 전역 단위 상태와 무관하게 항상 N·mm로 회수(견고성↑). 케이스명 접미사 (CB)/(ST)는 기존 유지.
- **네이티브 지진/풍(Track C) — 실모델 검증 종결**: 미니 2층 RC 프레임으로 라이브 검증한 결과,
  `db/POSL`은 건물 지진 파라미터를 **저장만** 하고 **강제력을 생성하지 않음**(해석 후 반력 ΣFX=ΣFY=0,
  방향 필드 없음). `db/WIND`은 필드 스키마 미공개. → **정적 횡하중 "생성"은 GUI/플러그인 레이어 기능으로
  REST 미노출 확정.** 동적해석(고유치·응답스펙트럼)은 솔버 계산형이라 동작(Track B). 따라서
  **자체계산 지진(等效靜力)·풍 → `db/CNLD` 투입이 유일·정석 경로임이 실증됨**(MAPI_FINDINGS C++).
  부가: **`db/NMAS`는 Gen NX 하드 크래시(3/3) → `db/styp`+`db/LTOM` 사용**. 반력=`REACTIONG`, 구속=7자리.
- **검증** — rc_engine.js·agent·standalone 파싱 OK(mini-racer), twDesignSpectrum 수치 정합 확인.
  **안정판 v1.1.9(M1.7)는 불변** — 본 작업은 최신 실험판(`gen_nx_rc_agent.html` v2.10.0)에만 반영.

## v2.9.0 — 2026-06-12 (M4-D 완료) — 층별 차이 주기 + 도면 폴리시

새 파일 **`gen_nx_rc_agent_v2.9.0.html`** (+ standalone). M4-D — **표준층 기준 층별 차이 주기**.

- **층별 차이**(`groupDiffNotes`) — 기준 = **표준층(TYPICAL 최다층)**. 그 외 그룹은 표준층 대비
  차이 항목만 추출(梁/柱 斷面·上下筋·箍·主筋). 대만 관행: 표준층 1매 + "餘同標準層" 차이주기.
- **DXF 주기 블록**(`diffNoteDXF`) — 도면 세트 ⑤ "層別 差異 註記 (基準: 標準層)" 추가. 채팅에도 차이 요약.
- **도면 폴리시**(실 CAD 피드백) — 표제란 셀 재배치(日期↔設計 겹침 해소), 단층 라벨 "1~1F→1F"
  (범위는 유지), 기둥 콜아웃↔단면 이격·블록 간격 확대(3000→4500), 보 단면 위치 조정.
- **검증** — `groupDiffNotes` 기준층/차이 정확, ezdxf 읽기 OK(差異註記·基準 포함), standalone 2블록 파싱 OK.
- **M4 본체 완료**: 골조평면도 + 梁/柱配筋圖 + 梁表/柱表 + **층별차이주기** + 표제란, DXF 한 장.

## v2.8.0 — 2026-06-12 (M4 도면세트) — 柱配筋圖·일람표·표제란·평면도

새 파일 **`gen_nx_rc_agent_v2.8.0.html`**. M4-2~4단계 — 도면 **세트** 완성(한 DXF에 ①~④).

- **柱配筋圖**(`columnRebarDXF`) — 기둥 입면(종근·단부가밀/중앙 띠구간) + 단면(둘레 대칭 주근·띠). RC06 참조.
- **일람표**(`tableDXF`) — **梁表/柱表**(부호·斷面·上/下筋·箍筋·主筋·ρ) 격자표 작도.
- **표제란·도번**(`titleBlockDXF`) — 公會 양식(圖名/圖號 S-01/比例/日期/設計 Dennis/TWD-USD112).
- **층 표기 한자수사**(`zhNum`,`floorLabelTW`) — 三樓·地下二層·屋頂層 (대만 표기).
- **골조 평면도**(`framingPlanDXF`) — 모델 2D 투영(그리드·기둥·보·軸번호 1-2-3/A-B-C), 참고용.
- **세트 조립**(`drawingSetDXF`) — ① 평면도 ② 梁配筋圖 ③ 柱配筋圖 ④ 梁表/柱表 + 표제란을 한 시트로.
  Agent `actDrawDXF`가 M3 배근결과(보+기둥) → `rebar_drawings_TWD.dxf` 다운로드. 가이드 📐「도면 세트 DXF」.
- **검증** — **ezdxf 읽기 통과**(AC1009, TEXT95·LINE317·CIRCLE56), 모든 라벨(梁表/柱表/梁配筋圖/柱配筋圖/
  屋頂/標準層/圖號 S-01) 확인, 배근→세트 글루 검증, 결합 파싱 OK.
- (후속) 층별 차이 주기(M4-D)·다중 시트 페이지네이션·DXF→DWG 변환·실 CAD 시각 미세조정.

## v2.7.0 — 2026-06-12 (M4 1단계) — 梁配筋圖 DXF 생성

새 파일 **`gen_nx_rc_agent_v2.7.0.html`**. M4 착수 — **배근도(配筋圖)를 DXF로 작도·내보내기**.

- **엔진 DXF 코어** — 순수 DXF(R12/AC1009) 작성기 `DxfDoc`(LINE/RECT/CIRCLE/TEXT, 레이어 테이블,
  CJK `\U+XXXX` 이스케이프). 출력 = **DXF**(브라우저서 .dwg 직접생성 불가 → CAD에서 .dwg 저장/편집).
- **표준 프로파일** — `DRAW_PROFILE.tw`(公會 標準圖 규칙: 단부 추가근 Ln/3, 가밀 2h, RC04/RC06 참조,
  텍스트 높이·레이어). 국가 확장 seam.
- **梁配筋圖 작도** — `beamRebarDXF`/`rebarSheetDXF`: 보 입면(상/하부 연속+추가근, 스터럽 단부가밀/중앙,
  부재부호·Ln) + 단면도(주근 원·스터럽) + 표준도 참조주기. 표준층 그룹별 스택.
- **Agent 배선** — "도면/배근도/配筋圖/dxf" 의도 + 가이드 📐 버튼. `actDrawDXF`: 배근결과(M3) →
  그룹별 보 배근도 → `beam_rebar_TWD.dxf` 다운로드(배근 없으면 자동 설계 선행).
- **검증** — **ezdxf(실 CAD 라이브러리) 읽기 통과**(AC1009·layers·CJK 이스케이프), 배근결과→groups→DXF
  글루 검증, 엔진+에이전트 결합 파싱 OK.
- (다음) 柱配筋圖 · 일람표(梁表/柱表) DXF · 표제란/도번 · 골조 평면도(보조).

## v2.6.0 — 2026-06-12 (M3 완료) — 이축 P-M + 배근표 CSV

새 파일 **`gen_nx_rc_agent_v2.6.0.html`**. M3 마무리 — 기둥 **이축(雙軸) P-M** + **배근표 내보내기**.

- **기둥 이축 설계** — `rcColumnDesign`을 Bresler 하중컨투어
  `(Mux/Mnx)^α+(Muy/Mny)^α≤1` (α=1.0 보수)로 확장. 축별 용량은 해당 휨깊이(x:b×h, y:h×b)로 산정,
  필요 ρ 이분법 역산 + 이용률 U 반환. Agent가 기둥 Moment-y/-z를 **각각 포락**해 이축 입력.
- **배근표 CSV** — 결과 메시지에 「⬇ 배근표 CSV」 버튼. `exportRebarCSV()`가 표준층 그룹별
  보·기둥 배근(단면·수요·주근·스터럽/띠·ρ·U·over)을 UTF-8 BOM CSV로 다운로드(Excel 호환).
- **검증** — 이축 수치(Mx300 U0.40 → Mx+My300 U0.79) + **라이브**(DL+EX+EY → 기둥 P391·Mx220·My220
  → 10-D22 ρ1.0% U1.000). 엔진+에이전트 결합 파싱 OK.
- **M3 완료**: 보 휨·전단 + 기둥 이축 P-M + 배근표 CSV. (세장 P-Δ·정착/이음·SMRF 디테일은 설계심화 후속.)

## v2.5.0 — 2026-06-12 (M3+) — 기둥 P-M 배근 추가

새 파일 **`gen_nx_rc_agent_v2.5.0.html`**. v2.4.0(보 배근)에 **기둥 축력-모멘트(P-M) 배근** 추가.

- **엔진 기둥 레이어** — `rcColumnDesign`: 변형률적합 + 사각형 응력블록으로 P-M 상호작용곡선
  (`colPMpoints`, φ 0.65→0.9 인장변형률 전이) → 수요(Pu,Mu)에서 필요 철근비 ρ를 이분법 역산
  (1~6%, 초과 시 over). 대칭 2층배근, 띠철근 간격 min(16d_long,48d_tie,최소변). `pickColBars`(짝수·≥4).
- **Agent 통합** — `actDesignRebar`가 보·기둥 동시 처리. BEAMFORCE에서 기둥은 **Axial(Pu)+Moment(Mu)**,
  보는 휨/전단 포락. 표준층 그룹별로 **보(상·하 주근·스터럽) + 기둥(주근·ρ·띠철근)** 요약.
- **검증** — 수치(600×600: P-M 역산 ρ1~3.4%, 용량 단조증가) + **라이브 엔드투엔드**
  (중력+지진 cLCB2/cLCB5 → 보 4-D19/5-D19·기둥 10-D22 ρ1.0%). 엔진+에이전트 결합 파싱 OK.
- (범위) 기둥은 **단축 P-M(지배축)·대칭배근 MVP**. 이축(Bresler)·세장(P-Δ)·정착/이음/SMRF 디테일 후속.

## v2.4.0 — 2026-06-12 (M3) — 보 배근 (配筋, TWD-USD112)

새 파일 **`gen_nx_rc_agent_v2.4.0.html`**. 해석결과를 회수해 **RC 보 휨·전단 배근**을 자체계산.

- **결과 회수 확정** — `post/table` `TABLE_TYPE=BEAMFORCE` 로 부재력 회수(라이브 검증).
  HEAD: Axial/Shear-y/Shear-z/Torsion/**Moment-y/Moment-z**, Part I·1/4·2/4·3/4·J (N·mm).
  내장 RC 설계 API는 미노출(eigv/seis 패턴) → **자체계산 채택**.
- **엔진 배근 레이어** — TWD-USD112(USD/ACI-318계열) 순수함수: `fcMPa`(CNS등급→MPa),
  `flexAs`(단철근 φ0.9)·`flexAsMin`·`flexRhoMax`, `shearVc`·`stirrupSpacing`(φ0.75), `pickBars`,
  `rcBeamDesign`(demand{MuPos,MuNeg,Vu}+geom{b,h}+mat → 상·하부 주근·스터럽·over 플래그). SD420/SD280 기본.
- **Agent 배선** — "보 배근/配筋/rebar" 의도 + 가이드 🔧 버튼. 해석 실행 → BEAMFORCE 조합 포락
  (주축 휨 Mu⁺/Mu⁻·전단 Vu) → **표준층 그룹별** 배근 요약(하부/상부 주근·스터럽@간격, 단면부족 ⚠).
- **라이브 검증** — 2층 프레임+조합(cLCB1/2) 빌드→해석→BEAMFORCE 80행→포락→배근(3-D19·D10@260) 완주.
  엔진 수치검증(400×600·Mu200/250→4·5-D19, over/min 케이스). 엔진+에이전트 결합 파싱 OK.
- (범위) 보 휨·전단 MVP. **기둥 P-M·SMRF 디테일·정착/이음은 후속**. 동적해석(M2-A4)은 API 대기.

## Wizard v2.3.0 — 2026-06-12 — Agent 기능 패리티 (지진·풍)

`MIDAS_RC_Modeling_Wizard_v2.0.0.html` → **`MIDAS_RC_Modeling_Wizard_v2.3.0.html`** (파일·버전 통일).
폼 Wizard를 **Agent v2.3.0과 버전·기능 동기화** — 지진·풍 횡하중 추가(전단벽 코어는 v2.0.0에 이미).

- **지진 等效靜力 + 풍** — 새 「6. 횡하중」 필드셋: 지진 on + 工址 프리셋(ENG.SEISMIC_ZONES)·SDS/SD1·I·R,
  풍 on + V10·地況. 공용엔진 `seismicStoryForces`/`windStoryForces` 호출(Wizard M단위 → `wizSpec`로 mm 변환).
- **적용** — 층력을 절점 균등분배(POST `/db/cnld`, ITEMS 배열), STLD에 EX/EY(E)·WX/WY(W) 추가.
  `taiwanCombos`에 횡 케이스 전달 → **cLCB1~7 자동**.
- **검증** — 파싱 OK / 평형(ΣEX=V·ΣWX=Vx·ΣWY=Vy 정확) / **라이브 전체 op 시퀀스 16개 수용**
  (CNLD 36절점·다중 STLD·7조합 cLCB1~7 모델 생성 확인).
- **버전 정렬** — Agent와 Wizard 모두 v2.3.0. (M2-B 자동판정은 '신규 생성'형 폼과 안 맞아 Agent 전용 유지.)

## v2.3.0 — 2026-06-12 (M2-B) — 기존 모델 표준층 자동판정

새 파일 **`gen_nx_rc_agent_v2.3.0.html`**. 기존 Gen NX 모델을 **읽어** 표준층 구조를 자동판정.

- **엔진 `detectTypicalFloors(nodes, elems)`** — GET node/elem 기반 순수 판정. Z군집→층고,
  부재분류(수직 BEAM=기둥·수평=보·PLATE/WALL=슬래브·벽), 시그니처(층고·기둥/보 단면·슬래브)
  연속 동일 = 한 표준층 그룹. GET 응답형(8칸 패딩 NODE·문자열 id·{X,Y,Z}) 그대로 수용.
- **라이브 검증** — 네이티브 story 엔드포인트 없음(db/stry 등 404) 확인 → 지오메트리 판정 채택.
  단면이 바뀌는 9층 모델(기단부 큰기둥/표준층 작은기둥) 라이브 빌드→GET→판정: 그룹 정확 복원
  (1-2F colSECT1 / 3-9F colSECT3). 수치 테스트도 일치.
- **Agent 배선** — "기존 모델 분석/讀取/detect" 의도 + 가이드 패널 📖 버튼. GET → `detectTypicalFloors`
  → 절점·요소·층수·**감지된 표준층 그룹(역할 추정 포함)** 리포트 + 읽은 형상 3D 표시.
- 역할 추정: 최빈 층고=표준층, 최상단 단독=지붕, 1F·고층고=기단부(휴리스틱).

## v2.2.0 — 2026-06-12 (M2-A3) — Agent 전단벽 중앙코어

새 파일 **`gen_nx_rc_agent_v2.2.0.html`**. 횡하중(지진·풍)에 이어 **횡저항 요소(전단벽)** 추가.

- **자동 중앙코어 토글** — 편집 카드에 🧱 체크박스 + 벽 두께(mm). ON 시 `autoCore`가 평면
  중앙 1베이에 4면 전단벽을 전층 자동 배치(`p.walls`) → `buildFrame`이 PLATE 패널 생성.
- **빌드 적용** — 두께별 `db/thik`(VALUE) 생성 → PLATE(`SECT`=thik id, STYPE:1) `db/elem` 추가.
  `clearModel`에 `thik` 추가(재빌드 시 잔존 방지). 빌드 결과에 🧱 패널 수 표시.
- **3D 미리보기** — 전단벽을 반투명 `mesh3d` 면으로 렌더(보라). 편집 카드 즉시 반영.
- **라이브 검증** — Agent와 동일한 N·MM 경로(`db/unit` N/MM · `db/thik` T_IN=250mm · mm 노드 ·
  PLATE SECT→thik) 전부 수용·GET 확인. 엔진+에이전트 결합 파싱 OK, autoCore 48패널 수치 검증.
- **폼 Wizard 패리티** — `MIDAS_RC_Modeling_Wizard_v2.0.0.html` 에도 옵션 「중앙 전단벽 코어」 추가
  (Wizard 자체 지오메트리 `expand`/`buildOps`에 배선: 중앙 1베이 4면 PLATE, THIK id 2=벽, M단위).
  캔버스 3D에 벽 패널(보라) 렌더. 통합 검증: 9층 모델 → 벽 PLATE 36개·THIK 2종.

## 엔진 — 2026-06-12 (M2-A3 1단계) — 전단벽/코어 PLATE 레이어

`shared/rc_engine.js` `buildFrame` 에 **전단벽·코어 생성** 추가(프런트엔드 UI 배선은 후속).

- **결정 #3 = PLATE 확정** — 라이브 probe로 Gen NX `TYPE:"WALL"` 은 wall-ID(1~9999)를
  `/db/elem` 어떤 필드·엔드포인트로도 설정 불가 확인 → 전단벽을 **PLATE(STYPE:1)** 로 모델링
  (RC 전단벽 해석 표준, 면내 전단·휨 포착). 두께는 THIK 테이블(VALUE), `SECT`=thik id 참조.
- **`spec.walls` 스키마** — `{kind:'wall',dir,ix,iy,bays,from,to,thick}` /
  `{kind:'core',ix0,iy0,ix1,iy1,from,to,thick}`. 기둥 그리드 정렬 → **기존 절점 재사용**(추가 절점 0),
  베이·층 단위로 quad 메시. `buildFrame` 반환에 `walls[{nodes[4],thick,story,building}]`·`wallThks[]` 추가.
- **라이브 검증** — core 1×1 + wall 1bay·3층 → 벽패널 15개(코어 12+벽 3), PLATE 15개 POST·GET 정확 확인.
  자세한 스키마는 `M2_DESIGN.md` 「라이브 검증 결과 — 전단벽」.

## Wizard v2.0.0 — 2026-06-12 — 폼 Wizard 공용엔진 합류

새 파일 **`MIDAS_RC_Modeling_Wizard_v2.0.0.html`** (기존 `MIDAS_RC_Modeling_Wizard.html` v1.0.2 유지).
폼형 Wizard를 **`shared/rc_engine.js`로 합류**해 Agent와 도메인 단일 진실원천 공유.

- **도메인 데이터 일원화** — 로컬 중복(`PRESETS`·`ROLES`·`taiwanCombos`)을 제거하고 엔진 위임.
  - 바닥하중 프리셋: `ENG.FLOOR_USE` → `presetItems` 어댑터(`{sdl,live,liveVal}` → `[[D,…],[L/LR,…]]`).
  - 용도 **4종 → 7종**(住宅/辦公/商場/**學校/醫院/設備**/屋頂)으로 확장 — 기존 Wizard가 표현 못 하던
    학교·병원·설비 용도 지원. 역할은 `ENG.FG_ROLES`.
  - 하중조합: `ENG.taiwanCombos(loadCases)` 위임 → 동작 동일(cLCB1~3), 향후 E/W 추가 시 cLCB4~7 자동.
- **지오메트리 유지** — Wizard 고유 PLATE 슬래브·fbla(바닥하중면)·캔버스 3D 뷰어는 그대로(zero 변경).
- **i18n** — School/Hospital/Equipment 용도 라벨 3개 언어 추가.
- **검증** — 엔진+Wizard 인라인 스크립트 독립 파싱 OK(별도 `<script>` 스코프, 충돌 없음).
  `expand`+`buildOps` 통합(podium+school+typical+roof 9층) → 14 ops·fbld 4정의(엔진값 일치)·
  cLCB1/2/3 정상 생성(py-mini-racer). 지오메트리 v1.0.2 동일이라 라이브 재검증 생략.

## v2.1.0 — 2026-06-12 (M2-A2) — 풍하중 (간이 정적풍)

새 파일 **`gen_nx_rc_agent_v2.1.0.html`**. 지진에 이어 **풍 횡하중** 추가 → 횡하중 1차 완성.

- **공용 엔진 풍 레이어** — `windStoryForces`: 간이 정적풍(qz=0.613·Vz², Vz=V10·(z/10)^α),
  층력 F=G·Cf·I·qz·면폭·분담높이. WX는 Y폭 면, WY는 X폭 면. 地況 A/B/C(α). 수치 검증(ΣF=V).
- **편집 카드 풍 입력** — V10·地況·G·Cf(用途係數 I는 내진과 공유). cLCB4/6 자동.
- **횡하중 통합 적용** — `applyLateral`: 지진(EX/EY)+풍(WX/WY)을 **한 번의 CNLD PUT**에
  절점 ITEMS(직렬 ID)로 합침 → 분리 PUT 시 덮어쓰기 방지. 빌드 결과에 V/Vx/Vy 표시.
- **라이브 검증**(실제 Gen NX) — 지진+풍 동시: 결합 CNLD 수용·cLCB1/2/4/5/6/7 자동 생성 확인.
  (EX/EY 반력 평형은 v2.0.0에서 검증; WX/WY 적용 경로 동일. 당시 결과조회는 Gen NX
  결과생성 일시현상으로 미확보 — 코드 경로는 검증분과 동일.)

## v2.0.0 — 2026-06-12 (M2-A1) — 지진 等效靜力 (TWD 耐震)

새 파일 **`gen_nx_rc_agent_v2.0.0.html`**. 중력 전용 → **지진 횡하중 포함** 대만 실무 모델.

- **공용 엔진(`shared/rc_engine.js`) 지진 레이어** — `seismicStoryForces` 등:
  스펙트럼 Cs(=SDS·I/R, 상한 SD1·I/(R·T), 하한) → V → 수직분포(k). 지진중량
  W=층면적×(w0+활하중비). override: `Cs` 또는 `V` 직접. **수치·라이브 검증**(평형 ΣF=V).
- **臺北盆地 지원** — Sederes가 Sa1=N/A·T0만 줄 때 `SD1=SDS·T0` 자동 환산
  (감쇠구간 SD1/T 일치, 검증). 工址 프리셋 16개(耐震規範 113 표2-6b 一般震區 15 + 臺北三區).
- **대화형 편집 카드에 내진 입력** — 지역 프리셋 드롭다운 + 직접입력(SDS/SD1/T0·I·R·w0·
  활하중비·Cs/V override) + **Sederes 조회 링크**. I 기본값 건물유형 연동(병원·학교 1.25).
- **빌드 적용** — `applySeismic`: EX/EY 케이스(STLD TYPE E) + 층력 절점 균등분배(CNLD).
  `taiwanCombos` 가 E 감지 → **cLCB5(1.2D+1.0E+1.0L)·cLCB7(0.9D+1.0E) 자동**.
- **라이브 검증**(실제 Gen NX) — 4층 모델, EX·EY 양방향 반력 평형(ΣReaction=−V) OK, 조합 자동 생성 확인.
- 입력 모델 결정: **A2(자체 等效靜力)** — 내장 SEIS/WIND API는 스키마 비노출이라 미사용(`M2_DESIGN.md`).

> 폼 Wizard v2.0.0(엔진 합류)·풍하중(M2-A2)·전단벽(M2-A3)·기존모델 자동판정(M2-B)은 후속.

## v1.1.9 — 2026-06-12 (M1.7) — 대화 중심 통합 · 올블랙 · RC 5종

새 파일 **`gen_nx_rc_agent_v1.1.9.html`**. v1.1.8에서 진행한 UX/도메인 정리를 한 버전으로 확정.

- **대화 중심 단일 흐름** — 상단 모드 토글바 제거. 채팅이 항상 기본.
  - **파라미터 입력**을 좌측 지령 메뉴 `自訂構架` 아래로 이동, 클릭 시
    **대화 카드(봇 메시지)** 로 파라미터 표가 열림(대화창 유지 → 자연어·향후 LLM 계속).
- **표준층 개념 기본화** — 건물 5종 모두 **기단부 + 표준층 + 지붕**으로 전개.
  - 대화형 **편집 카드에도 표준층 표**(역할/범위/층고/용도/다이어프램) 추가.
    표가 층 구성·높이의 단일 출처(파라미터 입력과 동일 모델). 편집 시 3D 역할 색상 즉시 갱신.
- **RC 5종으로 통일** — 강재 공장(Factory) 제거, **商場(상업)** 신규.
  목록: **住宅 / 辦公 / 商場 / 醫院 / 學校**. 재료 C210–C420(강재 SN490 제거),
  용도 주거/사무/상업/지붕.
- **올블랙 테마** — 배경 `#000`, 패널 근검정, 3D 씬 배경 검정.
- **가독성** — 좌측 메뉴 라벨·섹션 제목 밝기 상향, 안내/팁을 검정 박스+흰 글씨로.
- **공용 엔진 분리(M2 준비)** — 순수 도메인(빌드 지오메트리·표준층·하중·조합·대만규격·
  건물카탈로그)을 **`shared/rc_engine.js`** 단일 진실원천으로 추출. 대화형 에이전트가 이를
  로드해 사용(동작 변화 0). 폼 Wizard 는 M2 작업 시 같은 엔진으로 합류 예정.
- **용도 정밀화** — 學校 2.5 / 醫院 病房 2.0 / 設備層 7.5(설비 분리) 추가. 학교→School, 병원→Hospital.
- **요약카드 표준층 구성 줄** — "1F 기단부(商業) · 2–14F 표준층(住宅) · 15F 지붕" 자동 표기.
- **층그룹 입력 방식 개편** — 행별 **↑(위층)/↓(아래층)/×** 삽입·삭제. 표를 위(지붕)→아래(지하)
  입면 순서로 표시, 위치별 역할 자동 추천(맨위=지붕·맨아래=지하), 시작/끝 번호 자동 정렬.
  → 지하·옥탑 추가가 자연스러움. 미사용 파라미터 카드 시스템 제거(통일).
- **자유 골조도 대화 흐름** — 클릭 → 입력창 채움 → Enter → 편집 카드(표준층 표).
- **한글 폰트 Noto Sans KR** 적용(영문 IBM Plex / 번체 Noto Sans TC와 톤 통일).
- **헤더 정리** — 개발자·버전을 제목 옆 한 줄 byline으로.

## v1.1.8 — 2026-06-12 (M1.7) — 파라미터 모드를 좌측 메뉴로 통합

새 파일 **`gen_nx_rc_agent_v1.1.8.html`**.

- **상단 모드 토글바 제거**(💬 대화식 / ⚙ 파라미터). 채팅이 항상 기본 화면.
- **파라미터 입력**을 좌측 지령 메뉴 **`自訂構架`(커스텀 골조) 아래**로 이동.
  클릭 시 좌측 패널이 파라미터 표로 전환(`setInputMode('param')`).
- 좌측 채팅 지령(템플릿·단면·하중 등) 클릭 시 자동으로 **대화 모드 복귀**.
- 파라미터 표 헤더에 **`← 대화로`** 복귀 버튼 추가.
- 결론: **표준층 모델링도 대화 방식이 기본** — 파라미터는 정밀 입력용 보조 경로.
- JS V8 문법 검증 통과.

## v1.1.7 — 2026-06-11 (M1.7) — 두 개념 병합: RC Agent

새 파일 **`gen_nx_rc_agent_v1.1.7.html`** — 에이전트 셸(대화형·AI) + 우리 정확 엔진 병합.

- **베이스 = 에이전트 v6_i18n 셸**(검증된 UI 그대로 재사용):
  - Gen NX 로고, 우상단 **API 설정 드로어**(연결 테스트), 개발자 **Dennis**·버전 표기
  - **3개국어**(한국어/English/繁體中文), **대화형 채팅** + **LLM 옵션**(Claude/Gemini/GPT, 키 있으면 사용)
  - **Plotly 3D 뷰**(궤도/줌/프리셋/표시토글), **해석 후 결과 테이블**(반력·변위·부재력)
- **도메인 = 우리 정확 엔진 주입**(가이드의 도메인 교체):
  - 재료 → **CNS560(RC)** 콘크리트 / **CNS(S)** 강재 (건물유형 matName 자동 매핑)
  - **층별 강성 다이어프램**(`/db/rigd`, DOF 110001)
  - **TWD-USD112 하중조합**(`/db/lcom-gen`, 빌드·하중추가 시 자동 갱신)
- **라이브 검증**(실제 Gen NX): build → `/doc/anal` → `/post/table` 전 구간 200 성공
  (CNS560 C280 · 다이어프램 · cLCB1 · 반력/변위/부재력 테이블).

### M1.7 step2 — 다중 표준층/특수층 + 바닥하중
- `deriveFloorGroups`: 표준층(건물 용도) + 지붕(최상층) + 선택적 기단부(`기단부/裙樓/podium N`).
- `applyFloorLoads`: 용도별 **FBLD**(주거/사무/상업/공업/지붕) + 층별 **FBLA**(외곽 면적, 양방향).
  중력=음수, N/㎟ = kN/㎡ × 1e-3 (부호·크기 라이브 검증). LL/LR 케이스 자동 생성 → 조합 자동 포함.
- 라이브 검증: 3층 + 다이어프램 + 바닥하중 → 해석 결과 정상.

### M1.7 step3 — 테이블형 입력 모드
- 모드바 토글 **💬 대화형 ↔ 📋 테이블형**. 테이블형은 편집 가능한 스펙 표(planEditor 재사용)를
  열어 자연어 없이 정확한 모델(CNS560·다이어프램·조합)을 생성. 3개국어 라벨.
- 전 단계 JS 문법 V8 검증.

## v1.0.2 — 2026-06-11

- **인터랙티브 3D 뷰어** — SVG 정적뷰 → canvas 실시간 뷰어로 교체:
  - 회전(드래그) · 확대축소(휠/＋－) · 패닝(Shift/우클릭 드래그)
  - 표준 뷰: **입체(ISO) / 전면(正視) / 상단(俯視) / 측면(側視)**
  - 부재 필터 토글: **기둥 · 보 · 슬래브 · 경계조건**(지지)
  - 층 역할별 색상 + 범례, 색상별 배치 렌더(성능), 다국어 컨트롤 라벨
- 개발자 크레딧 **Dennis** 표기(헤더·README).
- Base URL 입력 + **최종 호출 URL 실시간 표시**(`→ …/gen`). gen/civil 기본값 도달 확인.

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
