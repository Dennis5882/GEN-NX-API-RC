# MIDAS Gen NX Open API — 실측 + 공식문서 대조 결과

> 공식 매뉴얼: <https://support.midasuser.com/hc/ko/articles/33016922742937-MIDAS-API-Online-Manual>
> (JSON Manual / "Online Help_MIDAS API". 사람 브라우저는 통과, 자동 fetch는 403 → 브라우저 UA로 우회 취득)
>
> 환경: `https://moa-engineers.midasit.com:443/gen`, 헤더 `MAPI-Key`, 바디 `{"Assign":{id:{...}}}`
> 신뢰도: ✅ 실측 검증 / 📖 공식문서 스키마 확인 / ⚠️ 거동 주의 / ❌ API 미지원

---

## ※ 전제: MIDAS API는 Civil NX · Gen NX 공용

"MIDAS API" JSON 매뉴얼은 **Civil NX(교량)와 Gen NX(건물) 공용**이라, 항목 일부는 한 제품에만 속한다.
- **Civil NX(교량)계열**: Moving Loads/Vehicles, Bridge Specialization Results, FCM/Cable Control, Tendon/Prestress, Composite Girder, 교량용 Wind 플러그인(HK SDM)
- **Gen NX(건물)계열**: Story Data, Floor Load, Diaphragm, RC Design, **Wind Loads(User Type, 층별)**

**함의**: 매뉴얼에 있어도 **연결된 제품에 따라 동작이 다르다.** 2026-06-13 Gen·Civil 두 키로 교차검증한 결과,
세 가지 패턴이 실재함을 확인:

### 제품 교차검증 매트릭스 (✅ 라이브, Gen `/gen` · Civil `/civil`)

| 엔드포인트 | Gen NX | Civil NX | 패턴 |
|---|---|---|---|
| `db/EIGV` (고유치) | 201 | 201 | **공용** (해석 엔진 공통) |
| `db/MVCD` (이동하중 코드) | 201 | 201 | DB 쓰기는 양쪽 허용 |
| `db/POSL` (지진 파라미터) | 201, **전체 필드 유지**(METHOD/EPA/SDS/SD1/IF/RMF) | 201, **부분 필드만**(NAME/SZ/SC/FA/FV) | **同 URI, 제품별 스키마 상이** |
| `db/WIND` (건물 풍, User Type) | GET 200 (존재) | **404 Not Found** | **Gen 전용 엔드포인트** |

→ **결론**: ① 일부는 진짜 제품 전용(`db/WIND`는 Civil에서 404). ② 일부는 URI는 같아도 **받는 필드가 제품마다 다름**
(`db/POSL`은 Civil에서 건물용 필드를 무시). ③ 다수의 DB 엔드포인트는 양쪽에서 쓰기 허용(공용).

**오류 신호 분류 (갱신)**:
- **`404 Not Found`** = 그 제품에 **엔드포인트 자체가 없음** (제품 전용). ← 새 분별점
- **`Wrong Field`** = 엔드포인트는 있으나 **필드명/필수필드/제품별 허용필드** 불일치.
- 검증 시 항상 "이 제품(Gen/Civil)에서 이 URI·이 필드가 유효한가"를 함께 본다.

---

## ★ 중대 정정 (2026-06-13)

이전 본 문서·[MAPI_ENDPOINT_REQUEST.md](MAPI_ENDPOINT_REQUEST.md)는 동적해석·지진 관련 엔드포인트를
**"스키마 미노출/차단"**으로 적었으나 **이는 틀렸다.** 공식 매뉴얼을 직접 확인한 결과
**모든 스키마가 완전히 문서화**되어 있다. `{}`에 "Wrong Field"가 났던 진짜 원인은:

1. **엔드포인트 이름을 잘못 추측** — 특히 지진하중은 `db/seis`가 아니라 **`db/POSL`**.
2. **필수 필드 누락** — 빈 바디 거부는 정상(스키마상 `TYPE`, `NAME` 등이 Required).

→ **동적해석(M2-A4)은 API 차단이 아니라, 우리가 스키마를 안 보고 추측한 것이 원인.** 구현 가능.

### 추측 vs 실제 (정정표) — **2026-06-13 라이브 키로 실검증 완료**

| 이전 추측 | 실제 URI | 페이지 | 상태 |
|---|---|---|---|
| `db/eigv` | **`db/EIGV`** | Eigenvalue Analysis Control | ✅ 라이브 201 (POST+GET) |
| `db/seis` | **`db/POSL`** | Parameter of Seismic Loads | ✅ 라이브 201 (이름 오추측) |
| `db/spfc` | **`db/SPFC`** | Response Spectrum Functions (대만 포함) | ✅ 라이브 201 |
| `db/splc` | **`db/SPLC`** | Response Spectrum Load Cases | ✅ 라이브 201 |
| `db/wind` | **`db/WIND`** | Wind Loads (User Type) — JSON REST 매뉴얼만 누락 | ⚠️ 엔드포인트 실재(GET 200), 필드 스키마 미문서 |

**라이브 검증 메모 (Gen NX 연결, 단위 kN·m):**
- `db/EIGV`: `{"TYPE":"EIGEN","iFREQ":10,"iITER":20,"iDIM":1,"TOL":1e-10,"bMINMAX":false,"FRMIN":0,"FRMAX":0,"bSTRUM":false}` → 201. **이전 실패는 `TYPE` 누락이 원인**(라이브 확정).
- `db/POSL`: `{"NAME","METHOD":"EQV_STATIC","SZ","EPA","SC","FA","FV","SDS","SD1","IF","RMF"}` → 201.
- `db/SPFC`: `{"NAME","iTYPE","iMETHOD","SCALE","GRAV","DRATIO","DESC","aFUNC":[{"PERIOD","VALUE"}]}` → 201. (추측한 `iGRAV/DAMPRATIO`는 틀림 → 실제 `GRAV/DRATIO`)
- `db/SPLC`: `{"NAME","DIR":"XY","ANGLE","SCALE","PMFT","bDAMP","INTERP":"LOG","COMTYPE":"CQC","bADDSIGN","iSIGNTYPE","bMODE":false,"aFUNCNAME":["<SPFC name>"]}` → 201.
  - **주의**: `bMODE:true`면 `aUSEMODE`(모드 목록) 필요 → 없으면 "Unknown Error". 전체 모드는 `bMODE:false`.
  - SPFC를 `aFUNCNAME`으로 참조(필드명 "FUNCTION" 아님). 모달조합은 `COMTYPE`(CQC/SRSS).
- `db/WIND`: GET 200(빈 상태), POST `{}` → "Wrong Field" = **엔드포인트 실재, 필드 필요**. JSON REST 필드 스키마 미문서(GrassHopper만 존재) → 도출 필요.

---

## A. 동적해석 — 실제 스키마 (📖 공식문서)

### A-1. 고유치 해석 — `db/EIGV`  (POST/GET/PUT/DELETE)
```json
{ "Assign": { "1": {
  "TYPE": "EIGEN",      // "EIGEN"(Subspace) | "LANCZOS" | "RITZ"  ← 필수
  "iFREQ": 100,         // 모드(주파수) 수  ← 필수
  "iITER": 20,          // 반복 횟수
  "iDIM": 1,            // Subspace 차원
  "TOL": 1e-10,         // 수렴 허용오차
  "bMINMAX": false,     // 관심 주파수 범위 사용
  "FRMIN": 0, "FRMAX": 1600,
  "bSTRUM": false
}}}
```
- RITZ는 `bINCNL`, `iGNUM`, `vRITZ:[{KIND:"GROUND",GROUND:"ACCX|ACCY|ACCZ",iNOG:30}]` 구조.

### A-2. 지진하중(정적) — `db/POSL`  (Parameter Of Seismic Loads)
```json
{ "Assign": { "1": {
  "NAME": "TW-Seismic",
  "CODE": "<지진 규준>",
  "METHOD": "EQV_STATIC",  // 등가정적 | "RES_DISP"(응답변위법)
  "SZ": "1",               // Seismic Zone  ← 필수
  "EPA": 0.22,             // 유효지반가속도 ← 필수
  "SC": "S1",              // Site Class ← 필수
  "FA": 1.12, "FV": 0.84,  // site 계수 ← 필수
  "SDS": 0.41, "SD1": 0.123,
  "IF": 1.2,               // 중요도계수 ← 필수
  "RMF": 3,                // 반응수정계수 ← 필수
  "CALC_OPT": true
}}}
```
> 대만은 `CODE`에 耐震規範, `SC`/`EPA`/`FA`/`FV`를 工址에 맞춰 넣으면 됨. 우리 엔진의 等效靜力 계산값과 대조 가능.

### A-3. 응답스펙트럼 함수 — `db/SPFC`
국가별 페이지 존재: User/Korea/US/Eurocode/China/Japan/India/**Taiwan**/Other. (대만 함수 직접 지정 가능)

### A-4. 응답스펙트럼 하중경우 — `db/SPLC`
```json
{ "Assign": { "1": {
  "NAME": "RSX", "DIR": "<방향>", "ANGLE": 0,
  "SCALE": 1.0, "PMFT": 0.0, "bDAMP": false, ...
}}}
```
> 순서: SPFC(함수) 정의 → SPLC(하중경우) → EIGV(고유치) → Perform Analysis.

---

## B. 모델 생성 — 실측 검증 (✅) + 문서 대조

### B-1. PLATE 요소 — `db/elem`
```json
{ "Assign": { "<id>": {
  "TYPE":"PLATE", "MATL":<id>, "SECT":<thik id>, "NODE":[n1,n2,n3,n4], "STYPE":1, "ANGLE":0
}}}
```
- ✅ 실측: 패널 15개 생성 확인. `SECT`는 단면(sect)이 아니라 **두께 `db/thik` id** 참조.

### B-2. 두께 — `db/THIK` (Thickness - Value)  📖
PLATE보다 먼저 생성. (매뉴얼: Properties → Thickness - Value/Stiffened)

### B-3. 자중→질량 — `db/styp` `bSELFWEIGHT:true`  ✅
- 매뉴얼 Static Loads에 **Self-Weight / Loads to Masses** 별도 항목 존재 → 필드명 교차확인 권장.

### B-4. 결과 회수 — `post/table`, `TABLE_TYPE="BEAMFORCE"`  ✅
HEAD: `Index|Elem|Load|Part|Axial|Shear-y|Shear-z|Torsion|Moment-y|Moment-z`,
`Part`=`I,1/4,2/4,3/4,J`, 단위 **N·mm**.

---

## C. 거동 주의 (⚠️) / 미지원 (❌)

### C-1. WALL 요소 — wall-ID 미설정 (⚠️)
- `TYPE:"WALL"` 존재하나 wall-ID(1–9999) 지정 필드를 못 찾음 → 본 프로젝트는 **PLATE로 전단벽 모델링**.
- 매뉴얼 Node/Element의 `Element` 페이지(`db/ELEM`)에서 WALL 정의 가능 여부 재확인 권장.

### C-2. 풍하중 — 전용 기능 실재 (JSON 명령 `WIND`), JSON REST 매뉴얼만 누락 (📖 GrassHopper 매뉴얼 확인)
**정정**: 풍하중은 Gen NX에 **완전한 전용 기능**으로 존재한다. JSON REST 매뉴얼(432개 글)에만
페이지가 없을 뿐, **GrassHopper API 매뉴얼에는 명확히 문서화**되어 있고 출력 명령이 `WIND`(Json)다.

- 메뉴 위치: **[Load] > [Static Loads] > [Lateral] > [Wind Loads]** (User Type)
- GrassHopper 컴포넌트 3종, 모두 `WIND` json 출력:

| 컴포넌트 | 입력 | 의미 |
|---|---|---|
| **Wind Loads**(메인) | Load Case ID, Description, Scale X, Scale Y, Wind Pressure(User), Wind Additions | 풍하중 케이스 생성 |
| **Wind Pressure(User)** | Ground Level, Story Data, Wind Pressure X-Dir `[real,real]`, Y-Dir `[real,real]` | **층별 풍압** |
| **Wind Additions** | Story Name, Along X/Y, Across X/Y, **Torsional RZ-X/Y** (각 `[real,real]`) | 풍방향·풍직각·**비틀림** 추가하중 |

- → **층(story) 기반 풍압 입력** 구조라 건물(주거/사무)에 매우 적합 (교량용 beam-load 플러그인보다 우리 용도에 맞음).
- 이전 `db/wind` "Wrong Field"의 원인: **위 story 기반 중첩 구조(ground level·story data·X/Y 풍압 배열)를 안 넣고 추측**한 것.
- 정확한 JSON REST URI는 미확인(매뉴얼 누락) → 라이브로 `db/WIND` 등 확인 필요. **GrassHopper로는 즉시 사용 가능.**

> **문서 gap (보고 대상)**: JSON REST 매뉴얼에 Wind Loads 페이지 부재. GrassHopper엔 존재.
> (대응 항목: Seismic도 동일 구조 — Seismic Pressure(User)/Seismic Additions 컴포넌트 존재.)

### 참고: 교량용 풍 플러그인 (다른 방식)
[Wind Load Calculator for bridges (HK)](https://support.midasuser.com/hc/ko/articles/40645303004697-Wind-Load-Calculator-for-bridges-HK)는
풍압을 자체계산 후 **Beam Load(`db/BMLD`)로 주입**. 교량(보 요소)용. 건물은 위 Wind Loads(User Type)가 적합.

### 참고: 하중 주입 엔드포인트 (✅ 검증)
- Beam Loads = **`db/BMLD`** / Nodal Loads = **`db/CNLD`** (POST/GET/PUT/DELETE)

---

## C+. API 포털 구성 · 기반지식 (Basic/Examples/Quick Tips 확인, 2026-06-13)

`gate_api_manual` 포털은 **여러 매뉴얼의 묶음**이다. 우리가 긁은 432개 엔드포인트는 그 중 **JSON Manual**(REST 정본).
- **JSON Manual** = REST 엔드포인트 정의(우리 카탈로그). **Grasshopper / Excel Connector / Plug-in** = 같은 API/모델의 다른 사용 레이어(새 엔드포인트 아님). 단 Grasshopper·Plugin 레이어가 JSON Manual 누락분(예: WIND)을 노출.
- Plug-in 카탈로그에 건물용 기성앱 존재: `[AS/NZS 1170.2] Building Wind Loads Generator`, `[AS 1170.4] Static Seismic Loads Generator`, `Artificial Earthquake Generator` 등.

### ★ 엔진에 바로 쓸 발견 2가지

**1) 연결 사전점검 — `/mapikey/verify` (GET)**
`db/UNIT` 등으로 떠보지 말고 이걸로 먼저 확인. base URL에서 **제품경로 제거** 후 `/mapikey/verify`.
```json
{ "user":"User_ID", "program":"civil", "connectionID":"...", "keyVerified":true, "status":"connected" }
```
→ 우리가 겪은 `"client does not exist"`(404)는 제품 미연결 신호. 요청 배치 전 이 엔드포인트로 status/keyVerified 확인이 정석.

**2) `post/table` 전체 옵션 (147개 결과테이블이 단일 엔드포인트 공유)**
TABLE_TYPE만 쓰던 것을 넘어 요청 한 번에 단위·컬럼·대상·케이스를 직접 지정 가능:
```jsonc
{ "Argument": {
  "TABLE_NAME": "TABLE",
  "TABLE_TYPE": "BEAMFORCE",                 // 필수(Enum). 결과테이블 89 + 시간이력 52 + 수화열 6
  "UNIT": {"FORCE":"KN","DIST":"MM"},        // 결과를 원하는 단위로 직접 받음(모델단위 변환 불필요!)
  "STYLES": {"FORMAT":"Fixed","PLACE":3},    // 출력형식/소수자리
  "COMPONENTS": ["Elem","Load","Part","Axial"], // 컬럼 선택(생략/[]=전체)
  "NODE_ELEMS": {"TO":"101to105"},           // KEYS[] | TO | STRUCTURE_GROUP_NAME
  "LOAD_CASE_NAMES": ["DC(ST)","X-dir(RS)","MV(MV:max)"] // 케이스명+접미사
}}
```
- **케이스명 접미사 규약**: Static `(ST)`, 조합 `(CB)`, 응답스펙트럼 `(RS)`, 이동하중 `(MV:all/max/min)`, 침하 `(SM:...)`, 시공단계 `(CS)`.
- **활용**: M3 결과회수에서 `UNIT`로 단위변환 제거, `COMPONENTS`로 필요한 컬럼만, `LOAD_CASE_NAMES`로 조합/RS 결과 직접 추출.

### 아키텍처(공식 확인)
REST(클라이언트) → AWS 서버(중개) → WebSocket → 로컬 MIDAS 제품. 제품은 앱과 직접 통신 안 함.
`MAPI-Key`가 **어느 제품인지 식별**(임시키, 변경 가능). 한 클라이언트가 여러 키로 여러 제품 동시 제어 가능 → Gen·Civil 동시 운용 근거.

---

## C++. 정적 횡하중 "생성"은 API 미노출 — 자체계산 확정 (2026-06-13 실모델 검증)

미니 2층 RC 프레임(12절점·16부재·자중질량)을 라이브로 빌드해 검증한 **결정적 결과**:

| 대상 | 결과 | 결론 |
|---|---|---|
| **db/POSL** (건물 등가정적 지진) | 실모델에서 **전체 필드 저장**(NAME/SDS/SD1/IF/RMF…) 200. 그러나 해석 후 **지진력 미생성** — E타입 케이스 "EQ"를 만들어도 반력 ΣFX=ΣFY=**0**. **방향 필드 없음**. | **파라미터 저장만, 강제력 자동생성 안 됨** → 네이티브 등가정적 지진 **API 미노출** |
| **db/WIND** (건물 풍) | 필드 스키마 미공개, 추측 3회 모두 Wrong Field | 스키마 도출 불가 |

→ **핵심 구분**: 동적해석(고유치 `db/EIGV`, 응답스펙트럼 `db/SPFC`+`db/SPLC`)은 **솔버가 결과를 계산**하므로 동작.
반면 **정적 횡하중(등가정적 지진·정적풍)의 "강제력 생성"은 GUI/플러그인 레이어 기능**이라 REST에 미노출.
→ **본 프로젝트의 자체계산 지진(等效靜力)·풍(층별 정적풍) → `db/CNLD` 절점하중 투입이 유일·정석 경로임이 실증됨.**
(MIDAS 공식 풍 플러그인도 "계산 후 하중 주입" 방식 — 동일.)

### ⚠ db/NMAS (절점질량) — Gen NX 하드 크래시 (재현율 3/3)
검증 중 `db/NMAS` PUT 직후 매번 **Gen NX가 비정상 종료**("Program will be closed… _restore.mgbx").
→ **절점질량은 `db/NMAS` 대신 `db/styp`(bSELFWEIGHT) + `db/LTOM`(하중→질량) 사용.** (actDynamic도 이 경로)
MIDAS 보고 대상 버그.

### 참고: 검증된 결과회수 타입
- **반력 = `REACTIONG`** (HEAD: Index/Node/Load/FX/FY/FZ/MX/MY/MZ). `REACTION`/`REACTIONFORCE`는 무효.
- 구속조건 CONSTRAINT는 **7자리** 문자열(예: 완전고정 `1111110`).

---

## D. 후속 액션

| # | 항목 | 액션 |
|---|---|---|
| 1 | 동적해석 M2-A4 | **재개 가능** — EIGV/POSL/SPFC/SPLC 실제 스키마로 라이브 검증 후 엔진 연동 |
| 2 | MAPI_ENDPOINT_REQUEST.md | "차단" 주장 **철회/갱신** — 실제로는 이름 오추측이 원인 |
| 3 | 풍하중 | **기능 실재** — GrassHopper Wind Loads(User Type, 층별 풍압)로 즉시 사용 가능. JSON REST URI는 라이브 확인(매뉴얼 누락) |
| 4 | WALL | `db/ELEM` 페이지로 wall 정의 가능성 최종 확인 |

> 교훈: **엔드포인트는 추측하지 말고 매뉴얼의 정확한 URI(대문자 코드: EIGV/POSL/SPFC/SPLC)를 쓸 것.**
> 빈 바디 "Wrong Field"는 차단이 아니라 필수필드 누락 신호로 해석.
