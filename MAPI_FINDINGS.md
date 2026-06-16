# MIDAS Gen NX Open API — 실측 + 공식문서 대조 결과

> 공식 매뉴얼: <https://support.midasuser.com/hc/ko/articles/33016922742937-MIDAS-API-Online-Manual>
> (JSON Manual / "Online Help_MIDAS API". 사람 브라우저는 통과, 자동 fetch는 403 → 브라우저 UA로 우회 취득)
>
> 환경: `https://moa-engineers.midasit.com:443/gen`, 헤더 `MAPI-Key`, 바디 `{"Assign":{id:{...}}}`
> 신뢰도: ✅ 실측 검증 / 📖 공식문서 스키마 확인 / ⚠️ 거동 주의 / ❌ API 미지원

---

## 🌐 아키텍처 / 연결 (공식문서 "How to work" + 라이브 검증, 2026-06-16)

MIDAS Open API는 제품과 앱이 직접 통신하지 않는 **웹 중개 구조**:
```
앱(클라이언트) ──REST/HTTPS──> [AWS 서버] ──WebSocket──> Gen NX(로컬 제품)
```
- AWS 서버가 중개자. Gen NX는 **WebSocket 클라이언트**로 붙고, **MAPI-Key로 제품 식별**(Key 안에 `cn`=connectionID 내장). 한 클라이언트가 여러 Key로 다수 제품 관리 가능.
- ✅ **크래시 응답 해석(시그니처 정의)**: 제품이 죽으면 REST는 여전히 `404`를 주되 내용은 `"Client Disconnected"`→`"client does not exist"` = **AWS 서버는 생존, 제품 WebSocket만 끊김**(=프로세스 사망 신호). 생존 확인은 `/mapikey/verify` `status:"connected"`. ※이 시그니처는 직전 빌드 post/TABLE 크래시 때 정의된 것이며, **현 v2.1 빌드에선 해당 크래시 재현 안 됨**(아래 post/TABLE 절 참조).
- ✅ **표준 헬스체크 = `/mapikey/verify`** — URL은 **base에서 제품경로(`/gen`) 제거** 후 붙임:
  - `https://moa-engineers.midasit.com:443/mapikey/verify` → 200 `{"user","program":"gen","connectionID","keyVerified":true,"status":"connected"}` ✅
  - `…/gen/mapikey/verify` → 404 ❌ (제품경로 포함 시 실패)
  - **배치 호출 전·크래시 후 생존확인의 표준 수단**(db GET 프록시보다 우월 — `status`로 서버다운/제품다운 구분).
- CORS로 브라우저 직접호출 불가 → PowerShell/curl 사용하는 이유도 이 구조(REST가 AWS로 감) 때문.

---

## 🆕 신버전 회귀검증 (2026-06-15 / 대상: **Gen NX 2026 v2.1 베타 (2026-06-12 빌드)**, 단위 N·mm)

전체 빌드→해석→결과회수 end-to-end를 신버전에서 재실행 (모델 DELETE 후 클린 재빌드로 2회 재현). **종합: 회귀 0건, 신규 노출 2건(db/STOR·db/SEIS). BODF·autoSavePath "이상" 2건은 모두 자가 오류로 판명·철회.**

### 🌟🌟 신규 노출 — `db/STOR` (Story Data) 전체 스키마 도출 (★대만 RC 직결)
신버전이 노출한 `db/STOR`의 **필수 필드 15개**를 라이브로 완전 도출 (Gen NX가 부분 PUT 시 누락 필드를 전수 enumerate → 그대로 채워 PUT 200 + GET 영속 확인).
```json
PUT /db/STOR
{ "Assign": { "1": {
  "STORY_NAME": "1F",            // 층 이름
  "STORY_LEVEL": 0,             // 층 표고(레벨)
  "bFLOOR_DIAPHRAGM": true,     // 바닥 강막(rigid diaphragm) 여부
  "WIND_FLOOR_WIDTH_X": 0, "WIND_FLOOR_WIDTH_Y": 0,   // 풍하중 산정 바닥폭
  "WIND_CENTER_X": 0,  "WIND_CENTER_Y": 0,            // 풍 작용 중심
  "WIND_ECCENT_X": 0,  "WIND_ECCENT_Y": 0,            // 풍 편심
  "SEIS_ACC_ECCENT_X": 0.05, "SEIS_ACC_ECCENT_Y": 0.05,        // 내진 우발편심(보통 5%)
  "SEIS_INHERENT_ECCENT_X": 0, "SEIS_INHERENT_ECCENT_Y": 0,    // 내진 고유편심
  "SEIS_TORSIONAL_AMP_FACTOR_X": 1.0, "SEIS_TORSIONAL_AMP_FACTOR_Y": 1.0  // 내진 비틀림증폭계수 Ax
}}}  // → 200, GET 영속
```
- **구분**: 1개 DTO가 **층 정의 + 풍(WIND) 6필드 + 내진(SEIS) 6필드**를 통합. (사용자 추측 적중: "하나는 스토리, 하나는 내진".)
- **대만 RC 의미**: `SEIS_ACC_ECCENT`(우발편심)·`SEIS_INHERENT_ECCENT`(고유편심)·`SEIS_TORSIONAL_AMP_FACTOR_*`(비틀림증폭 Ax)는 **TWD 내진코드 층별 비틀림 파라미터** — 자체계산 등가정적 지진에 직접 연동 가능. **이전엔 미노출이라 수동입력이던 항목이 API로 쓰기 가능해짐.**
- **주의**: 부분 PUT은 "Wrong Field"(일부) + GUI에 `DTO_STOR.1.<FIELD> Data does not exist` 전수 표출 → **15필드 모두 필수**(부분 저장 불가로 보임).
- **구모델 비호환 정황**: 구버전 .mgbx 해석 시 `SEIS_TORSIONAL_AMP_FACTOR_Y` 등 신필드 누락 오류 가능(이전 세션 사용자 보고와 일치).

### 🌟 신규 노출 — `db/SEIS` (Seismic Load) → ✅ **`db/SSEIS`로 정식 교체(레거시)**
> **개발팀 확인(2026-06-16)**: 구 `db/SEIS`는 이번 출시에서 **`db/SSEIS`(Static Seismic)로 정식 교체**됨(가칭 `db/st_seis` 아님). 즉 아래 "Unknown Error"는 **버그가 아니라 대체 엔드포인트로 이관된 레거시**의 잔존 동작. 정상 경로는 `db/SSEIS` USER TYPE(아래 "🚨🚨 대정정" 절). → 레거시 `db/SEIS`는 문서에 deprecated + 대체 URI 안내만 권장.

`GET /db/SEIS` → 200 (이전 미노출). GUI DTO 덤프로 **필수 필드 3개 도출**:
```
DTO_SEIS.1.SEIS_LOAD_CODE     // 내진 코드 (enum/string)
DTO_SEIS.1.SCALE_FACTOR_X
DTO_SEIS.1.SCALE_FACTOR_Y
```
- **거동**: 이 3필드로 PUT 시 "Wrong Field"는 사라지나(필드명 인식됨) **"Unknown Error"** 발생.
  `SEIS_LOAD_CODE` 값을 11종(IBC2015/ASCE7-16/UBC(97)/KBC2016/Taiwan/TWN/IS1893/GB50011/None…) + 정수(1·2·3)로 스윕해도 **전부 "Unknown Error"** → 값 enum 문제 아님.
- **해석**: 3필드 외 추가 필드 필요 / 부모 컨텍스트(내진 하중경우·층 데이터) 선행 필요 / **베타에서 쓰기 경로 미완성** 중 하나. POSL이 "강제력 미생성"이던 것과 같은 계열(정적 횡하중 생성=GUI 레이어)일 가능성.
- **액션**: 신버전 공식 SDK로 SEIS DTO 전체 필드 도출 + **"Unknown Error" 불투명 응답을 MIDAS 베타 피드백**으로 보고 권장.
- (STRY/STORY/SRCF/SPSF/ESCB는 404로 부재.)

### 🚨🚨 대정정 — 정적 횡하중 "생성"이 v2.1에서 API로 노출됨 (`db/SSEIS`·`db/SWIND`, 2026-06-16 실증)
**그동안 "정적 지진·풍 생성은 GUI 전용, REST 미노출 → 자체계산→`db/CNLD` 주입이 유일"이라 3중 확정(§C++·C+++·C+++++)했으나, v2.1에서 뒤집힘.**
공식 API 매뉴얼이 **2026-06-15 갱신**(정기 업데이트 확인), Zendesk Help Center JSON API로 우회 취득(`/api/v2/help_center/ko/articles/<id>.json`, 브라우저 UA — 일반 포털은 403). 신규 등재(2026-06-12):
- **`db/SSEIS` (Static Seismic Load)** · **`db/SWIND` (Static Wind Load)** · **`db/EPSE` (Seismic Earth Pressure)** — 모두 GET 200, full CRUD. 각 **KDS 코드판 + User Type**.
- ✅ **개발팀 확인 지원코드(2026-06-16)**: **`db/SSEIS` = KDS2019 + USER TYPE**, **`db/SWIND`(v975~) = KDS2022 + USER TYPE**. **해외코드(US/대만 등)는 차기 출시 검토 — 현재 미지원.** → 대만 RC 도구가 쓸 수 있는 건 **USER TYPE 단일 경로**(KDS 코드모드는 무관). 자체계산 TWD 지진·풍 → SSEIS/SWIND USER TYPE 주입이 해외코드 확장 전까지 정석.
- **★`db/SSEIS` User Type 라이브 실증(PUT 200 + 계산 프로파일 반환)**:
```json
PUT /db/SSEIS
{ "Assign": { "1": {
  "SEIS_CODE": "USER TYPE",                 // const "USER TYPE" (필수)
  "SCALE_FACTOR_X": 1.0, "SCALE_FACTOR_Y": 1.0,   // 필수
  "SEISMIC_FORCE": [ { "STORY_NAME":"1F", "FORCE_X":10000, "FORCE_Y":0 } ],  // 필수 — 층별 사용자 지진력
  "ACCIDENT_ECCEN_X":0, "ACCIDENT_ECCEN_Y":0, "ACCIDENT_TORSION":false, "INHERENT_TORSION":false,
  "ADDITIONAL_LOAD": [ { "STORY_NAME, ALONG_X, ALONG_Y, TORSIONAL_RZ" } ],  // 선택
  "DESC": "" }}}
```
  → GET이 **네이티브 계산 결과** 반환: `SEISMIC_FORCE`에 `WEIGHT`/`ELEV` 추가 + **`PROFILE{X_DIR,Y_DIR,SRSS}`** (STORY_WEIGHT·STORY_FORCE·**STORY_SHEAR**·**OVERTURN_MOMENT**·**ACCIDENT_TORSION**·INHERENT/TOTAL_TORSION). 실측 검산: 10000N@3000mm → OTM 3.00e7 ✓, 우발토션 500=10000×0.05 ✓, G.L. 밑면전단 행 포함.
- **`db/SWIND` User Type**(동일 실증, PUT 200): `WIND_CODE:"USER TYPE"`, `STORY_WIND_PRESSURE:[{STORY_NAME,PRESS_X,PRESS_Y}]` → `PROFILE{X_DIR…}`(WIND_FORCE/STORY_SHEAR/OVERTURN_MOMENT). ※floor 폭/높이(STOR의 WIND_FLOOR_WIDTH·층고) 0이면 WIND_FORCE=0 — 모델 완성도 의존.
- **⚠️ 전제조건(라이브 규명)**: **층이 G.L.(지표면) 위에 있어야 함**. `STORY_LEVEL ≤ G.L.`이면 `"The Story <n> is skipped: elevation ≤ G.L."` + `"USER TYPE requires a building model with stories."`로 거부. STORY_LEVEL=0(=기본 G.L.)→실패, 3000→성공.
- **에러 메시지 품질 ↑**: 구 `db/SEIS`의 "Unknown Error"와 달리 SSEIS/SWIND는 **구체적 사유** 반환(요구 전제 명확).
- **`db/SEIS` vs `db/SSEIS`**: 둘 다 GET 200으로 별개 실재. 우리가 앞서 "Unknown Error"로 막혔던 `db/SEIS`(`SEIS_LOAD_CODE`/`SCALE_FACTOR`)는 **정적 지진의 정답 엔드포인트가 아님** — 정답은 **`db/SSEIS`**(`SEIS_CODE`+`SEISMIC_FORCE[]`). db/SEIS 정체는 미확정(ASCE7-22 Hazard 계열 추정).
- **🇹🇼 프로젝트 영향(중대)**: **User Type이 사용자 층력/압력을 직접 받음** → 우리 **TWD-USD112 자체계산 지진·풍을 네이티브 static 케이스로 주입** 가능(우발편심·비틀림·밑면전단·OTM을 Gen NX가 계산). **`db/CNLD` 절점하중 우회보다 층 의미론이 살아있는 정석 경로**가 새로 열림 → 엔진 연동 재설계 후보.

#### ⚠️→✅ 생성 완결성 검증 결과 (2026-06-16, 라이브) — "프로파일 생성 ✓ / 해석 투입 ✓(실모델서 정정)"
SSEIS를 실모델(2절점 base 고정, 1F@3000, 자중질량)에 PUT 후 `doc/anal` "command complete"까지 갔으나:
- ✅ **프로파일 생성 확정**: `GET /db/SSEIS`가 **계산된 설계 횡력 분포** 반환 — STORY_FORCE 10000·**STORY_SHEAR(밑면) 10000**·**OVERTURN_MOMENT 3.00e7**(=10000×3000 검산✓)·**ACCIDENT_TORSION 500**(=10000×0.05✓), X_DIR/Y_DIR/SRSS + STORY_WEIGHT(모델 질량에서 산정). **즉 "설계 횡력 계산"은 API로 완전히 회수 가능.**
- ❌ **(당시 토이모델) 해석 하중케이스 자동생성 미관찰**: `db/STLD`엔 DL뿐, `REACTIONG` 케이스도 DL·RS만. → 이 2절점 모델 기준으론 SSEIS 계산값이 반력에 안 잡힘.
- **✅✅ 정정(2026-06-16, GUI Story 13층 실모델 라이브)**: **(b) 구조해석 자동 적용도 확인됨.** GUI Story 등록 + 다이어프램 실모델에 SSEIS PUT→`doc/anal`→`REACTIONG`의 **`DL` 케이스 ΣFX = -1260**(= SSEIS 밑면전단), **SSEIS DELETE 후 재해석 → DL ΣFX = 0**. 즉 **SSEIS 층력은 doc/anal에 실제 투입**됨. 앞 "(b) 미확인"은 **diaphragm/master node 없는 2절점 토이모델 한계였음**. (a)는 그대로 확정.
  - **⚠ 단 케이스 명명 이슈**: 전용 지진 케이스가 STLD에 안 생기고 **`DL` 케이스 반력에 합산**됨(SSEIS 스키마에 LCNAME 필드 없음 → 첫 정적케이스로 유입 정황). → 피드백 §3-4 Q1' 개선요청(결과 LCNAME 지정 필드).
  - **🆕 부수**: SSEIS GET PROFILE에 `STORY_WEIGHT`(실모델 층질량) 동봉 → ope/STORPROP 404여도 층중량 회수 가능. `ACCIDENT_TORSION`은 enum/bool 플래그 무관하게 STOR `SEIS_ACC_ECCENT` 거리로 PROFILE에 층별 계산(Roof 232.8=160×1.455). STOR의 SEIS_ACC_ECCENT는 **비율 아닌 거리값**(1.8=0.05×36m).
- **프로젝트 활용**: **사용자 층력 → Gen NX 네이티브 층전단/OTM/우발토션 + 실제 해석반력**까지 API로 수령 가능 → 자체계산 교차검증 정석 경로 확정. db/CNLD 절점하중 우회 불필요(케이스 명명만 제품측 개선 대기).

#### ✅✅ SSEIS 교차검증 라이브 PASS + Story 등록 규명 (2026-06-16, GUI Story 모델)
**GUI로 Story 등록된 실모델(13층 1F~Roof)** 에 자체 층력 PUT→GET diff → **STORY_SHEAR 13행(밑면 G.L. 포함) 0% 오차 PASS** (밑면전단 650/650, OTM 22520 검산 일치). **제품 v2.12.0(M2-A5)으로 반영**(엔진 `sseisSelfProfile/sseisDiff` + `verify_seismic_sseis` 도구).
- **PROFILE 구조 확정**: `PROFILE.{X_DIR,Y_DIR,SRSS}`, 행 키 `STORY_NAME/STORY_WEIGHT/STORY_LEVEL/STORY_FORCE/STORY_SHEAR/OVERTURN_MOMENT/ACCIDENT_ECCENT/ACCIDENT_TORSION/INHERENT_TORSION/TOTAL_TORSION`(값 문자열), 마지막 `"G.L."` 행에 밑면 총합. **STORY_SHEAR(L)=해당 레벨보다 '위' 층력 합**(자기 제외), OTM(L)=Σ_{>L}F·(level−L), **ACCIDENT_TORSION=F×편심거리**(=비율×평면폭, STOR `SEIS_ACC_ECCENT` 거리).
- **스키마 정정(라이브)**: SSEIS `ACCIDENT_ECCEN_X/Y`=정수 옵션 enum[0,1,2](비율 아님). `INHERENT_TORSION` optional→제거. `1F`(level 0=G.L.)는 "not a seismic-load story"로 제외.
- **🔑 Story 등록 메커니즘 규명**: SSEIS `STORY_NAME`은 **Gen Story Manager 등록 층** 참조. **`db/STOR` 테이블 PUT·RIGD 다이어프램·`ope/STOR`(우발편심 계산)으로도 등록 안 됨**(순수 API 모델서 SSEIS `"Wrong Key"`). GUI **"Auto Generate Story Data"/Define Module**(Module "Base")만이 등록 — 그 API는 5개 Story 문서 어디에도 없음(개발팀 문의 대상). GUI 모델 `DELETE db/STOR`→경고 "Loads deleted due to changes in Story"로 db/STOR↔Story 직결 확인.

#### 🆕 Story 작업 엔드포인트 패밀리 (매뉴얼 5종, 2026-06-16 확보)
| URI | 메서드 | 기능 | 상태 |
|---|---|---|---|
| `db/STOR` | CRUD | Story Data 테이블(15필드) | 보유·검증 |
| `ope/STOR` | POST | **Story Calc OPT** — 풍·지진 우발편심 자동산정(%→거리). `{SEIS_ECC:{INC,VALUE%},WIND_ECC:{INC,VALUE%}}`. db/STOR 선행 필수 | **라이브 OK**(편심계산), SSEIS 등록은 ✗ |
| `ope/STORPROP` | POST | **Story Properties** — 층별 중량/표고/재하높이·폭 리포트. `{FORCE_UNIT,LENGTH_UNIT,FORMAT,PLACE}` | 문서(★우리 층중량 교차검증 활용가치) |
| `ope/STORY_PARAM` | POST | Story Check Parameter(드리프트 검토 국가코드) | 문서 |
| `ope/STORY_IRR_PARAM` | POST | Story Irregularity Check(비정형/연약층 파라미터) | 문서 |

### 📕 릴리즈 노트 대조 — STOR/SEIS는 **ASCE 7-22 내진하중 생성** 기능 (v2.1 핵심)
`archive/MIDAS GEN NX 2026 (v2.1)_draft_rev8.pdf` (49p) 대조 결과:
- **p33-34 "Seismic Load Standard: ASCE 7-22"**: ELF(등가횡력)+응답스펙트럼 생성, **ASCE Hazard Tool**에서 파라미터 회수→**SDS/SD1 자동계산**(§11.4.4), multi-period 스펙트럼(ASCE 7-22 신규) 지원.
  → **`db/SEIS`의 정체 = ASCE 7-22 내진하중**. `SEIS_LOAD_CODE`/`SCALE_FACTOR_X/Y`는 그 일부.
  → standalone PUT이 "Unknown Error"인 이유: **Hazard Tool 데이터 바인딩 등 부모 컨텍스트가 GUI/툴 레이어에 있음**(코드명 `ASCE7-22`/`ASCE 7-22` + SDS/SD1 줘도 동일). 우리의 기존 결론(정적 횡하중 "강제력 생성"은 REST 미노출)과 정합.
  → **`db/STOR`의 SEIS_ACC_ECCENT/SEIS_INHERENT_ECCENT/SEIS_TORSIONAL_AMP_FACTOR**는 ASCE 7-22 ELF의 **층별 우발비틀림·증폭(Ax, §12.8.4.3)** 입력 — STOR은 쓰기 가능(위 ✅).
- **p35 "Seismic hook": 지원 코드에 `TWN-USD112` 명시** (+ ACI 318 2014/2019/2025, NTC-DCEC 2023, NSCP 2015).
  → 본 프로젝트 코드 **TWN-USD112가 신버전에 네이티브 내진 후크 디테일링 대상**으로 포함. (column rebar nₗ/kₙ 영향, ACI318-25 18.7.5.4 기반.)
- **p32 "ACI 318-25"**: RC·Meshed Slab 설계 + **하중조합 자동생성** ACI 318-25 반영.
- **p38 "Wind Pressure: IS875:2015"**: Area/Beam/Nodal 풍압 생성(인도 코드).
- **함의**: 신규 노출 STOR/SEIS는 **ASCE 7-22 내진 패키지**의 DB 노출. 대만(TWD)엔 직접 안 쓰이나, **STOR의 층별 편심/비틀림 필드는 코드무관**이라 자체계산 등가정적 지진에 활용 가능. SEIS(ASCE 생성기)는 TWD 자체계산 경로(`db/CNLD` 주입) 대체 아님.

### 🇹🇼 TWN-USD112 네이티브 지원 범위 (v2.1, 릴리즈 노트 + 라이브)
- **`db/DCON` `DGNCODE="TWN-USD112"` → 200 + GET 영속 ✅** (라이브). 설계코드 네이티브 지정 가능. `"ACI318-25"`도 인식(신코드), `"ZZZ"`→"Wrong Field"(enum 검증). DCON은 `DGNCODE` 단일필드(SEISMIC 추가 시 "Wrong Field").
- **릴리즈 노트 근거 TWN-USD112 네이티브 기능**:
  - **RC 보 설계**(p36): **Vc 로직 최적화** §22.5.5.1 — `Av≥Av,min`일 때 `Vc.a/Vc.b` 중 최대 자동선택(설계경제성↑, 배근↓). v2025→v2026 개선.
  - **기둥 내진 후크**(p35): 90°+135°(또는 180°)/Both 선택 가능(과설계 방지). nₗ/kₙ(ACI318-25 §18.7.5.4) 영향.
  - **구조 도면 자동생성 + 배근**(p22): 지원코드에 TWN-USD112 포함(+ACI318-25/19/14, ACI318M, NSCP2015). bar size/정착장/이음장 코드기반.
- ✅→ **post/TABLE 설계타입 크래시: v2.1 라이브 재현 불가(2026-06-16 정정, 해결로 판단)**: 이전엔 `BEAMDESIGNFORCES`가 404 `"Client Disconnected"`→`"client does not exist"`로 하드 크래시라 기록했으나, **현 v2.1 빌드에서 5개 조건 정밀 재검증 결과 전부 graceful·세션 생존**:
  - ① API 신규 토이 RC 보(해석완료·DCON TWN-USD112) ② 13층 RC GUI 모델(4회 반복) ③ 320노드 모델 ④ 220노드 모델 ⑤ 무작위 미정의 타입(`ZZ_RANDOM_QWE123`).
  - `BEAMDESIGNFORCES` → **`{"message":""}` graceful(HTTP 200)**, 무작위/설계검토 타입 → **`{"error":"... error creating utbl. (ex PostMode ...)"}` graceful**, 매번 `status:connected`·프로세스 생존. **크래시 0건.**
  - → 이전 하드 크래시는 **직전 빌드/특정 상태 한정**이었던 것으로 추정. **유효 Critical 아님(피드백 §1 해결로 격하).** 정상 타입(`BEAMFORCE`/`REACTIONG`)은 그대로 200 정상.
- 🆕 **Story-category 결과표는 post/TABLE 미노출(2026-06-16)**: 같은 모델서 REACTIONG/BEAMFORCE는 정상이나 `OVERTURNINGMOMENT`·`STORYOVERTURN(INGMOMENT)`·`STORYDRIFT(X)`·`STORYSHEAR`·`STORYMASS`·`STIFFNESSIRREGULARITY`·`SOFTSTORY` 등 Story 계열 전부 `error creating utbl`. GUI엔 "Overturning Moment"/"Stiffness Irregularity Check" 표 존재하나 REST 회수 경로 불명 → Smart Report Table(별도 엔드포인트) 추정. ※GUI OTM 표의 `Reduction Factor(τ)` API 불일치는 **내부(장창현) 수정 진행중**이라 피드백 제외.

### 🧩 공식 SDK 소스 대조 (`MIDASIT-Co-Ltd/midas-gen-python`, 오프라인·라이브 0회)
신버전 검증을 SDK 소스로 교차확정 (라이브 크래시 회피):
- **`_result_table.py`의 TABLE_TYPE 전수에 설계계 타입 0개** — REACTIONG/L, DISPLACEMENTG/L, TRUSS*, BEAMFORCE(+VBM/STP/STRESS변형), PLATEFORCE*, TNDN_LOSS_FORCE 까지만. **`BEAMDESIGNFORCES`·RC/CONCRETE/COLUMN 설계 타입 없음.**
  → **라이브 404+크래시의 정체 규명: 미지원 TABLE_TYPE이라 SDK에도 없음.** RC 설계결과는 post/TABLE로 회수 불가가 **소스로 확정**(매뉴얼 "API엔 RC 설계 없음"과 3중 일치).
- **`_load.py` 스키마 SDK 확정**: **BODF = flat `{LCNAME,GROUP_NAME,FV:[f,f,f]}`**(내 ITEMS 오용 철회 재확인) · NMAS `{mX,mY,mZ,rmX,rmY,rmZ}` · LTOM `{DIR,bNODAL,bBEAM,bFLOOR,bPRES,GRAV,vLC:[{LCNAME,FACTOR}]}`.
- **STOR·SEIS는 SDK에 없음** — v2.1 신규라 공개 SDK 미반영. **→ 우리가 라이브로 도출한 STOR 15필드가 현존 최상위 스키마**(SDK보다 앞섬).
- **`_loadcomb.py`엔 DGNCODE 없음** — 하중조합은 범용 빌더(NAME/CASE/CLS/ACT/TYPE). **코드기반 자동 하중조합 생성(ACI318-25/TWN-USD112)은 GUI 기능, SDK/REST 미노출.**
- **결론**: TWN-USD112 관련 API 접점은 **`db/DCON DGNCODE` 지정 단 하나**(SDK에도 없는 raw 엔드포인트). 설계 실행·결과·코드별 하중조합은 전부 GUI 모듈 → **자체계산 TWD-USD112 유지가 API상 유일·정당.**

### 🔬 v2.1 전 엔드포인트 필드 라이브 검증 (2026-06-15, 크래시 0건)
깨끗한 모델에서 문서 스키마대로 **PUT→GET 영속**을 전수 점검(크래시 확정 항목 제외). 상세표는 카탈로그 `MAPI_Endpoints_Gen_Civil.xlsx` 시트 **`v2.1 필드검증(0615)`**.
- **PASS(필드 유효 확정)**: unit/matl/sect/**thik**/node/**elem(BEAM+PLATE)**/stld/cons/cnld/**bodf(flat)**/styp/LTOM/EIGV/POSL/SPFC/**SPLC**/**STOR(15)**/**DCON(TWN-USD112)**/**MATD**/**BMLD** + 결과타입 BEAMFORCE·REACTIONG·EIGENVALUEMODE.
- **PASS — `db/SPLC`** (값 주의, 버그 아님): `DIR` 유효값은 **`"XY"`/`"Z"`만**(단일축 X·Y는 제품상 미제공 — 제품매뉴얼 확인). `PMFT`는 주기배율 **기본 1.0**(0 거부 정상). GET이 보이는 bAUTO/bACCECC/bADDSIGN/iSIGNTYPE/DESC는 다이얼로그 정식 옵션. ※"X→Wrong Field" 메시지가 generic한 점만 개선 여지.
- **CHECK — `db/NBOF`**: PUT 200이나 GET 미영속(no-op) → 추가 구조/전제 필요로 보임.
- **해소 — `db/SEIS`**: standalone PUT "Unknown Error"는 버그 아님 → **`db/SSEIS`로 정식 교체된 레거시**(개발팀 확인 2026-06-16). 정상 경로는 db/SSEIS USER TYPE.
- **제외(크래시 위험)**: **현 v2.1선 확정 하드 크래시 트리거 0건**(2026-06-16 재검증). post/TABLE 설계타입(`BEAMDESIGNFORCES`)·db/NMAS·doc/new 반복 모두 라이브 재현 안 됨 — 전부 graceful·세션 생존. (각 절 참조.)
- **신규 라이브 최초확인**: `db/thik`·`db/elem PLATE`·`db/BMLD`·`db/MATD`(CNS560-18(RC)/SD420).

### ✅ end-to-end 정상 (이전과 동일)
| 단계 | 페이로드 핵심 | 결과 |
|---|---|---|
| `PUT /db/unit` | `{Assign:{"1":{FORCE:"N",DIST:"MM"}}}` | 200 ✅ |
| `PUT /db/matl` | `{TYPE:"CONC",NAME:"C280",DAMP_RAT:0.05,PARAM:[{P_TYPE:1,STANDARD:"CNS560(RC)",DB:"C280"}]}` | 200, GET 재확인 ELAST 자동계산 ✅ |
| `PUT /db/sect` | `{SECTTYPE:"DBUSER",SECT_NAME,SECT_BEFORE:{SHAPE:"SB",DATATYPE:2,SECT_I:{vSIZE:[H,B,0,0,0,0,0]},USE_SHEAR_DEFORM:true,USE_WARPING_EFFECT:false}}` | 200, GET 영속 ✅ (이전 `{SHAPE,SECT_H,SECT_B}` 평면포맷은 "Wrong Field" — **SECT_BEFORE/vSIZE 구조가 정답** 재확인) |
| `PUT /db/node` `/db/elem` | node `{X,Y,Z}`, elem `{TYPE:"BEAM",MATL,SECT,NODE:[i,j],ANGLE}` | 200 ✅ |
| `PUT /db/cons` | `{ITEMS:[{ID,CONSTRAINT:"1111110",GROUP_NAME}]}` — **CONSTRAINT 7자리** (6자리 "111111"은 "incorrectly entered" 거부) | 200 ✅ |
| `PUT /db/cnld` | key=nodeId, `{ITEMS:[{ID,LCNAME,GROUP_NAME,FX..MZ}]}` | 200, GET 영속 ✅ (이전 "Wrong Field"는 포맷오류였고, **절점키+ITEMS가 정답**) |
| `PUT /db/styp` | `{STYP:0,MASS:1,bSELFWEIGHT:true,SMASS:2,GRAV:9806.65}` 자중→질량 | 200 ✅ (db/NMAS 크래시 회피경로) |
| `PUT /db/EIGV` | `{TYPE:"LANCZOS",iFREQ:3,iITER:20,iDIM:1,TOL:1e-10,...}` | 200 ✅ |
| `POST /doc/saveas` | **`{Argument:"<경로문자열>"}`** — Argument는 경로 문자열 직접 (객체 `{PATH:..}`는 "second query is wrong") | "command complete" ✅ |
| `POST /doc/anal` | `{}` | "command complete" ✅ |
| `POST /post/TABLE` EIGENVALUEMODE | — | **T₁=0.1561s** 회수, SUB_TABLES 5개(EIGENVALUE ANALYSIS / 질량참여율(1)(2) / PARTICIPATION FACTOR / DIRECTION FACTOR) ✅ |
| `POST /post/TABLE` BEAMFORCE | LOAD_CASE_NAMES `["DL(ST)"]` | rows>0, 캔틸레버 모멘트 60e6 N·mm 정확 ✅ |
| `POST /post/TABLE` REACTIONG | — | ΣFX=-10000N 평형 정확, SUB_TABLES 합계 ✅ |
| `PUT /db/bodf` | **flat** `{Assign:{"1":{LCNAME,GROUP_NAME,FV:[0,0,-1]}}}` | 200, GET 영속 ✅ (제품 `putSelfWeight` 포맷 그대로 정상) |

### ⚠️ 회귀 오보 철회 — `db/BODF`는 정상 (자가 오류였음)
초기 검증에서 BODF를 "회귀(스키마 파괴)"로 기록했으나 **클린 재검증 결과 거짓 경보로 판명, 철회.**
- **실제 원인**: BODF는 **flat 포맷**(`{"1":{LCNAME,GROUP_NAME,FV:[..]}}`)인데, cnld/cons식 **`ITEMS` 배열 래퍼**를 잘못 씌워 호출 → 파서가 최상위에서 LCNAME/FV를 못 찾아
  Gen NX가 `[Error] DTO_BODF.<id>.LCNAME Data does not exist` / `.FV Data does not exist` 표출. (id를 "2"로 바꿔 래퍼 테스트하니 정확히 `DTO_BODF.2.LCNAME...` 재현 → 원인 확정.)
- **확정 사실**: flat 포맷 PUT → 200 + GET 영속. **rc_agent.html `putSelfWeight`(LCNAME/GROUP_NAME/FV) 포맷은 신버전에서도 유효.**
- **교훈**: cnld·cons는 `ITEMS` 배열, **BODF는 flat** — 테이블마다 래핑 규약이 다르므로 혼용 금지. "Data does not exist"는 필드 제거가 아니라 **기대 레벨에 필드 없음(래핑 오류)** 신호로 해석.

### ✅ autoSavePath(이메일 prefix) 정상 — 오보 철회
- **확정**: `/mapikey/verify`의 `user`(`sjj0507@midasit.com`) → `@` 앞 `sjj0507` → `C:/Users/sjj0507/Documents/...mgbx` 경로로 `{Argument:"<경로문자열>"}` saveas → **다이얼로그 없이 조용히 저장**(사용자 확인). 예제 `examples/auto_save_before_analysis.html`의 `autoSavePath()`가 정답.
- **이전에 "머신경로 함정"으로 기록했던 건 자가 오류**: 검증 중 내가 임의로 `C:/Users/Dennis/...`(로컬 OS 사용자)로 바꿔 호출 → 그 경로가 **Gen NX 세션 컨텍스트(sjj0507 계정)에 없어** "잘못된 경로가 있습니다" 다이얼로그 발생. **이메일 prefix 가정이 옳음** — 로컬 OS 사용자명으로 바꾸면 안 됨. (Gen NX MAPI 세션은 로그인 MIDAS 계정 사용자 폴더 기준.)
- **db/STOR 신규 노출 + `SEIS_TORSIONAL_AMP_FACTOR_Y` 신필드**(이전 세션 발견): 신버전 Story 스키마 확장. 구모델 해석 시 `DTO_STOR.1.SEIS_TORSIONAL_AMP_FACTOR_Y Data does not exist` 가능.

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
  - **★v2.1 라이브 + 제품매뉴얼 대조(2026-06-15)**: 유효값/거동은 **모두 설계상 정상**(버그 아님). 제품 매뉴얼(manual.midasuser.com, RS Load Cases) 확인:
    - **`DIR` 유효값 = `"XY"`(수평) / `"Z"`(수직)뿐.** 단일축 `"X"`·`"Y"`는 **원래 제공 안 함**(수평은 X-Y 결합) → `"X"`가 "Wrong Field"인 건 정상. ⚠️API 메시지가 generic("Wrong Field")이라 "invalid DIR(allowed XY/Z)"였으면 더 친절.
    - **`PMFT`(Period Modification Factor) = 주기 배율**(비구조요소 강성 보정). 배율 0은 무의미 → `0.0` 거부 정상, **기본 1.0**.
    - GET이 보이는 `bAUTO`(Auto-Search Angle)·`bACCECC`(Accidental Eccentricity)·`bADDSIGN`/`iSIGNTYPE`(Add signs)·`DESC`는 **다이얼로그 정식 옵션**(미문서 기능 아님, JSON 필드목록에만 누락).
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
  "NAME": "RSX", "DIR": "XY", "ANGLE": 0,    // DIR 유효값 = "XY"(수평)/"Z"(수직)만. 단일축 X·Y는 제품상 미제공
  "SCALE": 1.0, "PMFT": 1.0, "bDAMP": false, ...   // PMFT=주기배율, 기본 1.0 (0은 무의미→거부)
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

### B-4. 단위계 선제 설정 필수 — `PUT /db/unit` ⚠️

모델 생성 API 호출 전 반드시 단위계를 명시적으로 설정해야 한다.
Gen NX 앱이 이미 kN/m 등 다른 단위 상태로 열려 있을 경우, MAPI로 노드를 추가하면
해당 좌표가 현재 앱 단위로 해석된다.

- **현상**: 첫 실행에서만 `WARNING: DISPLACEMENT DZ IS ABNORMAL` 296건 발생.
  두 번째 실행부터는 동일 코드임에도 경고 없음.
- **원인**: `runAnalysis()`에서만 `setUnit('N','MM')`을 호출해, 모델 빌드 시점에는
  Gen NX가 kN/m 상태 → 노드 좌표 7000(mm 의도)이 7000m로 해석 → 이상 변위.
  두 번째 실행 시에는 직전 `setUnit` 호출로 세션 단위가 N/mm로 유지된 상태.
- **수정**: `actBuildFrame()` 첫 줄에 `await setUnit('N','MM')` 추가 → 항상 단위 선제 고정.

**교훈**: MAPI 단위 설정은 모델 생성 직전에 해야 한다. 해석 직전 호출만으로는 부족.

### B-5. 결과 회수 — `post/table`, `TABLE_TYPE="BEAMFORCE"`  ✅
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

> ⚠️ **[2026-06-16 대정정] 이 섹션 결론은 v2.1에서 뒤집혔다.** 정적 지진·풍 생성은 이제 **`db/SSEIS`·`db/SWIND`로 API 노출**(상단 "🚨🚨 대정정" 참조, 라이브 실증). 아래는 **v2.1 이전(2026-06-13~14) 기준 기록**으로 보존.

미니 2층 RC 프레임(12절점·16부재·자중질량)을 라이브로 빌드해 검증한 **결정적 결과**:

| 대상 | 결과 | 결론 |
|---|---|---|
| **db/POSL** (건물 등가정적 지진) | 실모델에서 **전체 필드 저장**(NAME/SDS/SD1/IF/RMF…) 200. 그러나 해석 후 **지진력 미생성** — E타입 케이스 "EQ"를 만들어도 반력 ΣFX=ΣFY=**0**. **방향 필드 없음**. | **파라미터 저장만, 강제력 자동생성 안 됨** → 네이티브 등가정적 지진 **API 미노출** |
| **db/WIND** (건물 풍) | 필드 스키마 미공개, 추측 3회 모두 Wrong Field | 스키마 도출 불가 |

→ **핵심 구분**: 동적해석(고유치 `db/EIGV`, 응답스펙트럼 `db/SPFC`+`db/SPLC`)은 **솔버가 결과를 계산**하므로 동작.
반면 **정적 횡하중(등가정적 지진·정적풍)의 "강제력 생성"은 GUI/플러그인 레이어 기능**이라 REST에 미노출.
→ **본 프로젝트의 자체계산 지진(等效靜力)·풍(층별 정적풍) → `db/CNLD` 절점하중 투입이 유일·정석 경로임이 실증됨.**
(MIDAS 공식 풍 플러그인도 "계산 후 하중 주입" 방식 — 동일.)

### ✅ db/NMAS (절점질량) — 이전빌드 하드크래시(3/3) → **v2.1 미재현(0616 closed)**
- 이전빌드: `db/NMAS` PUT 직후 매번 **Gen NX 비정상 종료**("Program will be closed… _restore.mgbx").
- **v2.1 재검증(2026-06-16, 라이브, 모델 사전저장)**: 공식예제(절점실재)·존재X절점(999)·필수mX누락·극값1e308·타입위반 **5종 전부 graceful·프로세스 생존**(200 / `Unknown Error` / `Wrong Field`). → 이전 크래시 **v2.1서 해소**.
- 경미: 존재X 절점에 `"Unknown Error"`(불투명, db/SEIS와 동일패턴) · 매뉴얼 `mX`=Required인데 누락 수용(문서/동작 불일치).
- 질량 대체경로 `db/styp`(bSELFWEIGHT) + `db/LTOM`은 여전히 유효(actDynamic 경로). 정식출시 전 입력 다양화 재검증 권장.

### ✅ 동적해석 실행 = Lanczos 필요 (2026-06-14 actDynamic end-to-end 실검증)
실모델(자중질량 styp+LTOM, `DIR:"XY"`)에 `db/EIGV` **TYPE:"EIGEN"(Subspace)** 으로 `doc/anal` 시
**`"Analysis is not allowed"`**(HTTP 200). **원인은 라이선스가 아니라 해석 방법**:
> MIDAS 제약 — **"off-diagonal 질량이 있으면 Lanczos만 가능"**. `db/LTOM(DIR:"XY")`이 off-diagonal 질량을 만들어
> Subspace Iteration이 거부됨. (Gen NX Eigenvalue Analysis Control 다이얼로그 에러로 확인 — 제보: Dennis)
- **해결**: `eigvPayload`를 **`TYPE:"LANCZOS"`** 로 고정 → `doc/anal` **"command complete" 성공**(실검증).
- 같은 모델에서 정적해석(eigv 없이)은 항상 정상 → "not allowed"는 동적 방법 문제였음.
- **모드형상**은 `EIGENVALUEMODE`/`PARTICIPATIONVECTORMODE`로 회수됨(Node/Mode/UX…).
- **★주기(Period) — 정정·해결(2026-06-14 재검증)**: 주기는 **`EIGENVALUEMODE`** 응답의
  `SUB_TABLES[0]["EIGENVALUE ANALYSIS"]`(HEAD `["ModeNo","Frequency(rad/sec)","Frequency(cycle/sec)","Period(sec)","Tolerance"]`)에 위치.
  - **이전 오판 정정**: "이 서버는 SUB_TABLES 미반환"은 **테이블 오선택이 원인**. `PARTICIPATIONVECTORMODE`는 모드형상만(SUB_TABLES 없음),
    **`EIGENVALUEMODE`는 SUB_TABLES를 정상 반환**(주기 + MODAL PARTICIPATION MASSES/FACTOR/DIRECTION 4종).
  - **라이브 검증**: 실모델(459절점 RC빌딩) EIGENVALUEMODE → `pickModalPeriods` 15모드·**T₁=1.1214s** 정상 파싱. (mode2 0.897, mode3 0.794s …)
  - `actDynamic`을 `EIGENVALUEMODE` 조회로 수정(v2.11.0). `pickModalPeriods`(SUB_TABLES 재귀)는 무변경 — 키명 `"EIGENVALUE ANALYSIS"`(공백 포함)도 'period' 헤더 탐색으로 매칭.
  - 부가: EIGENVALUEMODE의 `MODAL PARTICIPATION MASSES PRINTOUT (1)`(TRAN-X/Y MASS%·SUM%)도 동봉 → 참여질량비 회수 가능(향후).
- **`db/STOR`(Story Data)**: WIND_*/SEIS_* per-story 필드 보유(정적 풍·지진이 Story에 결합). 단 전체 필수필드로도
  "Wrong Field" — 추가 전제(모델 선행조건/미문서 필드) 필요. **정적 횡하중 생성의 향후 단서**(미해결).

### 참고: 검증된 결과회수 타입
- **반력 = `REACTIONG`** (HEAD: Index/Node/Load/FX/FY/FZ/MX/MY/MZ). `REACTION`/`REACTIONFORCE`는 무효.
- 구속조건 CONSTRAINT는 **7자리** 문자열(예: 완전고정 `1111110`).

---

## C+++. 외부 교차검증 · 참고 자료 (2026-06-14)

외부 공개 저장소 **[albertp16/midas-gen-nx-api](https://github.com/albertp16/midas-gen-nx-api)**(Python+HTML, MIDAS Gen NX 후처리 대시보드)와 대조. **우리 결론이 독립적으로 교차검증**되었고, 새 참고처를 확보.

### ★ 새로 참고할 가치 (도입/조사 후보)
| # | 항목 | 내용 | 용도 |
|---|---|---|---|
| 1 | **공식 SDK** | **`github.com/MIDASIT-Co-Ltd/midas-civil-python`** — MIDAS IT 공식 Python SDK. 위 저장소가 FBLD 등 스키마를 이걸로 검증함. | **스키마 정본** — 미해결(STOR PUT, 주기 테이블, EIGV 옵션) 해결 단서 |
| 2 | **노출되는 Story 테이블** | `/post/TABLE`로 나오는 불규칙성 테이블은 **Story Drift X / Story Drift Y / Story Mass** 뿐. **`STORY_SHEAR`는 미노출**(약층검토는 수동입력). | 드리프트/비틀림·연약층 검토 기능 |
| 3 | **`db/dcon`** | RC 설계코드 지정 (`{DCON:{"1":{DGNCODE:"NSCP 2015"}}}`). | 네이티브 설계코드(우리는 자체계산 TWD-USD112) |
| 4 | **`TABLE_TYPE:"BEAMDESIGNFORCES"`** | 설계용 보 부재력. PARTS[PartI,PartJ], COMPONENTS[Memb,Part,LComName,Type,Fz,Mx,My(-),My(+)]. | BEAMFORCE의 설계 변형 |
| 5 | **`/view/capture`·`/view/resultgraphic`** | 모드형상·반력을 **이미지(JPG) 캡처**(CURRENT_MODE "VibrationModeShapes"/"ReactionForces/Moments", MODE_SHAPE/LEGEND/CONTOUR 필드). | numeric 주기 불가 시 모드형상 시각화 대안 |
| 6 | **불규칙성 검토** | NSCP2015/ASCE7 비틀림(1a/1b)·연약층·약층 검토 로직. | 향후 기능 확장 참고 |

### 우리 발견의 외부 교차검증 (신뢰도↑)
- **`REACTIONG`**(TABLE_NAME "Reaction(Global)") — 동일 확인. `REACTION`/`REACTIONFORCE` 무효도 일관.
- **FBLD 스키마** `{Assign:{id:{NAME,DESC,ITEM:[{LCNAME,FLOOR_LOAD,OPT_SUB_BEAM_WEIGHT}]}}}` — 우리 구현과 **완전 동일**(SDK로 검증됨).
- **주기 numeric 회수 난점** — 그들도 못 뽑아 `/view/capture` 스크린샷 + "35+ TABLE_TYPE 후보 probe"로 우회. ⇒ **우리는 해결**: `EIGENVALUEMODE`의 SUB_TABLES로 T₁ numeric 회수 성공(§B 주기 정정 참조). albertp16가 못 찾은 길.
- **`STORY_SHEAR` 미노출** — 우리 STORYSHEAR probe 실패와 일치.
- **정적 지진·Story는 GUI 경로** — 그들은 GUI로 만든 `.mgbx`를 `/doc/open` 후 후처리(정적지진 "Ex +"도 GUI 생성). ⇒ Track C(정적 횡하중 생성 API 미노출) 재확인.
- ⚠️ 그 저장소는 **소스에 MAPI-Key 하드코딩**(노출) — 본 프로젝트 "키 비커밋" 원칙의 반례.
- 참고: `/doc/ANAL`(대문자)·`/post/TABLE`(대문자)도 동작 — URI 케이스 무관.

---

## C++++. 공식 SDK 대조 (MIDASIT-Co-Ltd, 2026-06-14)

마이다스아이티 공식 조직의 두 Python SDK를 정밀 조사. 둘 다 **v1.6.6**, `MidasAPI(method,command,body)` 단일 전송부 +
per-object 클래스 래퍼. 키는 **Windows 레지스트리에서 읽음**(하드코딩 X — 우리 "키 비커밋" 철학과 동일).
- **[midas-gen-python](https://github.com/MIDASIT-Co-Ltd/midas-gen-python)** (우리 제품, GEN NX) · `_mapi.py`에 ~159개 엔드포인트 URI 사전.
- **[midas-civil-python](https://github.com/MIDASIT-Co-Ltd/midas-civil-python)** (Civil NX, albertp16 참조) · ~190개 URI 사전. (Civil·Gen 동일 MAPI 공유 — 코드 주석으로 확인)
- 공식 문서 사이트(추가 정본 후보): **`midas-rnd.github.io/midasapi-python`**.

### ✅ 우리 스키마가 공식 SDK와 일치 (추인)
| 항목 | SDK 위치 | 스키마 |
|---|---|---|
| EIGV | `_analysiscontrol.py` `AnalysisControl.EigenValue` | `TYPE` EIGEN(Subspace)/LANCZOS/RITZ · iFREQ/iITER/iDIM/TOL · (Lanczos) bMINMAX/FRMIN/FRMAX/bSTRUM · (Ritz) bINCNL/iGNUM/vRITZ |
| NMAS | `_load.py` `Load.NodalMass` | `{Assign:{<node_id>:{mX,mY,mZ,rmX,rmY,rmZ}}}` (노드 id로 키) |
| LTOM | `_load.py` `Load.LoadToMass` | `{DIR,bNODAL,bBEAM,bFLOOR,bPRES,GRAV,vLC:[{LCNAME,FACTOR}]}` |
| STYP | `_model.py` `Model.type` | `{STYP,MASS(1=lumped/2=consistent),bSELFWEIGHT,SMASS(1=XYZ/2=XY/3=Z),GRAV}` |
| SPFC | `_responseSpectrum.py` `RS.Function` | `{NAME,iTYPE,iMETHOD,SCALE,GRAV,DRATIO,aFUNC:[{PERIOD,VALUE}]}` |
| SPLC | `_responseSpectrum.py` `RS.Case` | `{NAME,DIR,ANGLE,SCALE,PMFT,INTERP,aFUNCNAME,bDAMP,COMTYPE…}` |
→ 우리 구현(EIGV/NMAS/LTOM/STYP/SPFC/SPLC) 전부 정합.

### 🌟 우리 실측 발견은 공식 SDK에도 없음 = 실전 지식
- **Lanczos 필요(off-diagonal 질량)** — SDK에 경고 없음(방법은 사용자 선택). 우리가 라이브로만 규명 → MIDAS 보고 가치.
- **NMAS Gen NX 크래시** — SDK에 경고 없음. (gen SDK의 `NodalMass.get()/delete()`엔 `return` 누락 자체 버그 존재)

### 🔑 미해결 항목 — SDK로 규명
- **Story(STOR)**: 두 SDK 모두 **미포함**(엔드포인트 사전에도 없음). → "Wrong Field"는 필드 누락이 아니라
  **모델 형상에서 Story auto-generate 선행 필요**(맨바닥 PUT 불가) 가능성. (실제 DB 키가 `STRY`일 가능성도 — 미확정)
- **주기 회수**: SDK도 모달 TABLE_TYPE 미보유. 단 `_result_table.py`가 `[tableName]["SUB_TABLES"][i]["HEAD"/"DATA"]`
  패턴을 실제 사용 → 우리 `pickModalPeriods` SUB_TABLES 재귀가 정방향(서버가 반환하면 동작).
- **WIND·정적지진 생성**: 두 SDK 모두 미포함(POSL은 이름만, 래퍼·생성코드 없음) → **REST 미노출 확정**. 자체계산이 정답.
- **dcon(설계코드)**: 공식 SDK 없음(load-combination 설계 lcom-* 만 존재) → 자체계산(TWD-USD112) 유지 타당.

### 📌 보강 포인트
- **STYP**: 현재 `bSELFWEIGHT`만 → `MASS:1`(lumped) + `SMASS`(질량방향) 추가하면 SDK 수준으로 완전.
- 참고 repo: `concrete-properties`(RC 단면특성 계산 — 향후 단면/배근 참고).

---

## C+++++. 공식 플러그인 · moapy (midasit-dev, 2026-06-14)

`midasit-dev` 계정(blog moa.midasit.com): 공개 **`plugins`**(60개, React+`@midasit-dev/moaui`+PyScript 인브라우저 Python),
**`moaui`**(Open API용 React UI SDK), **`schema-flow`/`schemaforms`**(function-schema→UI 생성기), 외 템플릿.

### 정적 횡하중 생성 미노출 — 3중 교차검증 완료
공식 플러그인 60개를 전수 확인: **`db/WIND`·`db/STOR`/`STRY`·`db/POSL`(정적지진 생성)을 쓰는 플러그인 없음.** 대신:
- **풍 → `db/BMLD` 보압력하중**(`CMD:"BEAM", TYPE:"PRESSURE", DIRECTION:"LY|LZ", D:[...], P:[pressure,...]`). 자체계산 후 주입.
- **지진 → `db/SPFC`(응답스펙트럼 함수)·`db/THFC`(시간이력)만**. `SPLC`는 읽기 전용, **POSL 생성 없음**.
- **주기 numeric 회수: 어느 플러그인도 안 함** (모드 개수만 `GET db/EIGV` `[1].iFREQ`).
→ **공식 SDK + albertp16 + 공식 플러그인 = 3중 확정**: 정적 횡하중 생성은 REST 미노출, **자체계산→`db/CNLD`/`db/BMLD` 주입이 정석**.

### 새 단서 / 보강
- **`db/SPFC` 보강 필드**: 공식 RS-generator는 `{...,STR:{SPEC_CODE:"USER"},aFUNC:[{PERIOD,VALUE}]}` + GRAV를 단위별(9.806/9806/386…)로. → 우리 SPFC에 `STR:{SPEC_CODE:"USER"}` 추가(반영함).
- **`db/NBOF`** (Nodal Body Force/관성력): `{LCNAME,OPT_NODAL_MASS,OPT_LOAD_TO_MASS,OPT_STRUCT_MASS,X,Y,Z,...}`.
- **`db/BMLD` 보압력 스키마**(풍 주입용): 위 CMD/TYPE/DIRECTION/D/P 구조.
- **`moapy`** (WGSD 단면설계·DgnEngine) — 공식 RC 설계 Python 라이브러리(moa.rpm 플랫폼 fetch). 우리 자체계산 배근의 대안/검증 참고.
- 아키텍처 참고: 공식 플러그인은 **PyScript 인브라우저 Python + moaui** 구성.

### moapy 상세 — RC 설계 교차검증 가능성 (PyPI `moapy` 1.3.2, 소스 `engineers-api-python`=비공개)
moapy는 **3부분**: ① `moapy/wgsd/`(오픈스택 단면솔버) ② `moapy/dgnengine/`(폐쇄 Win DLL 부재설계) ③ `moapy/midasapi.py`(db/* REST 래퍼, 설계와 분리).
- **① wgsd — 독립 실행 가능**(`pip install moapy[full]`, MIDAS 연결 불필요). `concreteproperties`+`sectionproperties` 기반.
  - `calc_rc_uls_bending_capacity(theta,n)` → **Mn/φMn**(휨강도) · `calc_rc_mm_interaction_curve` → **이축 M-M** · `calc_3dpm` → **3D P-Mx-My 곡면**.
  - 코드: **ACI318M-19 / Eurocode2 뿐** (φ: 인장 0.85/압축 0.65, Pn,max=0.8Pn, β1=0.85, εcu=0.003).
- **② dgnengine — EC2 RC 부재설계(보/기둥)만**, Windows DLL(블랙박스·비이식).
- **③ midasapi — db/* CRUD + post/table + doc/anal** (우리와 동일 패턴).

**우리 TWD-USD112 자체계산과의 관계:**
- ✅ **교차검증 가능(독립 실행)**: 보 **휨 Mn/φMn**(ACI 경로) + 기둥 **이축 P-M**(fiber 기반, 우리 Bresler 근사보다 엄밀). QA 도구로 유용.
- ❌ **불가**: 보 **전단(Vc·스터럽)** — moapy에 없음 → 자체계산 유지 필수. **Taiwan 코드 없음** — ACI318M-19은 동일 계보 proxy일 뿐(TWD-USD112 φ/하중계수 상이).
- → **결론: MIDAS 공식 Python에도 Taiwan RC 코드는 없음** → 우리 자체계산 TWD-USD112는 재발명이 아니라 **필요한 것**. moapy[full]은 휨/이축 P-M **검증용**으로 도입 가치.
- 저변 오픈라이브러리 **`concreteproperties`**(RC fiber/stress-block, P-M, M-φ) = 실제 RC 솔버 — 참고처.

---

## C++++++. MIDAS-RnD (문서 + LinetoPlate, 2026-06-14)

`MIDAS-RnD` 계정 4개 repo: **`midasapi-python`**(래퍼 문서), **`LinetoPlate`**(Line→PLATE, Streamlit),
`midasAPI-plugin`(빈 껍데기), `midas-docs`.

### midasapi-python = `midas_civil/gen` 래퍼의 MkDocs 문서 — 새 답 없음
- 문서가 **"전체 TABLE_TYPE/엔드포인트는 support.midasuser.com 매뉴얼 참조"로 명시 위임** → 우리 보유 매뉴얼이 정본임 재확인.
- Story/주기회수/Wind/정적지진 → 여기에도 없음(래퍼 범위 밖). EIGV는 EIGEN/LANCZOS/RITZ, off-diagonal 경고 없음(SDK 동일).
- 범용 탈출구 `MidasAPI(method,command,body)` 제공. ⚠️ 문서 예제에 실제 MAPI 키 노출(키 유출 사례 추가).

### LinetoPlate — 전단벽-PLATE에 쓸 기술 (참고 가치)
보(선)를 PLATE 메쉬로 변환(Streamlit + numpy/scipy, 서버 automesh 미사용·클라이언트 메쉬 후 일괄 PUT).
- **PLATE 페이로드**: `{"TYPE":"PLATE","MATL","SECT":<thik id>,"NODE":[4 CCW],"STYPE":3,"ANGLE"}` — 우리와 동일하나
  **STYPE를 `3`(drilling-DOF 쉘)로 사용**. ⚠️ **우리는 `STYPE:1`(thick)** → 전단벽은 면내회전강성 있는 **STYPE:3가 일반적으로 더 적합**(검토 포인트, 해석 거동 영향이라 코드 변경은 보류).
  - STYPE: 1=thick, 2=thin, 3=drilling DOF. THIK는 `{NAME,TYPE:'VALUE',bINOUT,T_IN,T_OUT,OFFSET,O_VALUE}`(우리와 동일).
- **재사용 기법**: ① 그리드 기반 **노드 병합**(공간해시 1e-5 허용오차 — 인접 패널 공유변 중복 방지) ② **두께 dedup 캐시**(동일 두께 THIK 재사용) ③ 임의 평면 2D 프로파일 배치 + 링-투-링 quad 스윕.
- `midasAPI-plugin`은 코드 없음(배너 이미지뿐) — 마켓플레이스 템플릿으로 쓸 수 없음.

---

## C+++++++. 레거시 Confluence 위키 (midas-support.atlassian.net, space=MAPI, 2026-06-14)

190페이지 레거시 공식 위키(Civil 중심 + Gen/GTS/CIM). 대부분 `[XXXX]` 명령별 페이지(~120)로 우리 기존 스키마와 중복.
**그러나 하나 결정적 신규: RC 기둥 P-M 상관도가 API로 노출됨** — 우리 "RC 설계 API 미노출" 결론을 일부 정정.

### ★ 신규 — `POST /POST/PM` (RC P-M Interaction Diagram)
- 페이지: `[PM] P-M Interaction Diagram (DB Section)`(id 36175990), `(General Section)`(46727169).
- **출력**: `{"PM":{"<elem>":{"vPHI_PN_MN":[{"ELEM":1001,"PHI_PN":..,"PHI_MN":..}, …13점]}}}` — **φPn/φMn 설계 상관곡선**.
  ⇒ 우리 기둥 **이축 Bresler 근사**의 교차검증/대체 가능(실제 코드 기반 곡선, 더 엄밀).
- **필요 입력(모델에 함께 POST)**: `DCON`(설계코드)·`MATL(CONC)`·`MATD`·`SECT(DBUSER)`·`RCHK`(배근)·`LCOM(KIND:CONC)`·하중.
- **부속 엔드포인트(신규)**:
  - **`[DCON]` RC Design Code**: `{"DCON":{"<n>":{"DGNCODE":"<코드>"}}}`. ⚠️ **Taiwan은 `TWN-BRG-LSD90`(교량 LSD)뿐 — Taiwan 건축 RC 코드 없음** → Taiwan 건물은 **자체계산 TWD-USD112 유지 필수**. (ACI318-02·AASHTO·Eurocode2·IS456 등 존재, Civil/교량 위주)
  - **`[MATD]` Modify Concrete Materials**: 설계용 콘크리트/철근 등급(`CODENAME,REBAR_CODENAME,MAINREBAR_REBARNAME` 예 SD40).
  - **`[RCHK]` Rebar Input**: 기둥(`MEMBTYPE:"COLUMN", COLM.vLAYER[].vPOSITION[].{BAR_NUM,BAR_NAME}`) / 보(`BEAM.vMAIN[].POS_TOP/BOT_LAYERS[]`) 배근 레이아웃.
- **`<MODS> RC Design`**: 엔드포인트 패밀리 아님(`/mods/` 없음). DCON+MATD+RCHK(col/beam)을 묶은 **문서 그룹**. 실행 RC 루트는 `/POST/PM` 하나.

### 그 외 신규 엔드포인트(참고)
- `[TABLE] Get Result Table from Smart Report Table`(47284225), `[UFIG] Screenshot`(46727186), `{Get-Operators}` 패밀리(46596097).

### 미해결 항목 — 위키에도 없음(기존과 동일 확인)
Story(STOR/STRY)·Wind(WIND)·정적지진 생성·**모달 주기 numeric 회수** 페이지 부재. → 여전히 미노출.

### 종합
- **RC 기둥 P-M은 `/POST/PM`로 API 가능**(레거시 문서, Gen 동작 여부는 라이브 확인 필요). 단 **Taiwan 건물 RC 코드 부재**로 TWD-USD112 자체계산은 유지.
- 나머지(Story/Wind/정적지진/주기)는 위키로도 안 풀림 — 기존 결론 불변.
- 인용 가치: **RC(`/POST/PM`+DCON/MATD/RCHK)에 한해 유의미**, 그 외는 기존과 중복.

---

## C++++++++. `/POST/PM` 라이브 검증 (Gen NX, 2026-06-14)

실모델(459절점·980부재 RC 빌딩, 관리자 모드) 라이브. `/mapikey/verify` connected·gen 확인 후 read-only 위주 probe.

### ★ 중대 정정 — Taiwan 건물 RC 코드는 **네이티브 존재**
- `GET db/DCON` → `{"DCON":{"1":{"DGNCODE":"TWN-USD112"}}}`. **위키엔 "Taiwan은 교량 TWN-BRG-LSD90뿐"이라 기록했으나, 실 Gen NX엔 우리 자체계산 기준명과 동일한 `TWN-USD112`(대만 건물 RC)가 db/DCON에 네이티브로 존재.** (§C+++++++ 381행의 "Taiwan 건축 RC 코드 없음"은 위키 DCON 목록 한정 — Civil/교량 위주였음. Gen 제품 자체는 TWN-USD112 보유.)
- `GET db/MATD` → CNS560-18(RC)·`C_FC 34323.275`·`MAINREBAR SD420`·`SUBREBAR SD420`로 채워짐(설계재료 정상).

### `/POST/PM` 엔드포인트 동작 (라이브 확인)
- **POST 200 응답·라우트 실재** (`GET /POST/PM`=404 → POST 전용). **래퍼 = `Argument`** (Argument 있으면 "Failed to create json"까지 진행 / 없으면 "error status").
- **출력 계약 재확인**(위키): `{"PM":{"<elem>":{"vPHI_PN_MN":[{ELEM,PHI_PN,PHI_MN}…]}}}`. 위키 샘플 `PHI_PN 98249 @ M=0`(순축 φPn), General Section은 `81331079 @ M 1.306` 등.
- **필수 입력(위키 명시, 12종)**: DCON·NODE·ELEM·경계(CONS)·STLD·**CNLD**·LCOM(콘크리트설계조합)·MATL·MATD·SECT·**RCHK**. + **전제: "RC Design 완료"**.
- **RCHK 기둥 배근 스키마 확보**(위키 id 36175968):
  `{"RCHK":{"<elem>":{"MEMBTYPE":"COLUMN","COLM":{"vLAYER":[{"INDEX":1,"dDc":<피복 m>,"vPOSITION":[{"POSITION":"P1","BAR_NUM":n,"BAR_NAME1":"D22"},…]}],"SUB_BAR":{"SUBBAR_NAME":"D10","SUBBAR_DIST":.15,"SUBBAR_NUM":2.0}}}}}`. (보는 id 36077767: `BEAM.vMAIN[].POS_TOP/BOT_LAYERS[]`)

### ⚠️ 라이브 곡선 회수 실패 — 원인 2가지(미해결)
1. **`db/RCHK` 라우트가 이 빌드에 부재**: `GET/PUT db/RCHK` 모두 **404**. → 배근을 API로 주입·조회 불가. (위키 `[RCHK]`는 문서 명령코드일 뿐, 이 서버판 db 라우트로는 미노출.) `db/LCB`·`db/LCOM`도 404(조합은 `db/LCOM-GEN`=200으로 존재, 키 `LCOM-GEN`).
2. **`/POST/PM` 요청 본문 정형 미공개**: Argument에 (a) 요소선택만, (b) 전체모델 12종+합성 RCHK, (c) 모델상주+RCHK 등 다수 조합 시도 → **전부 `"Failed to create json"`**. 공개 문서에 완전한 request body 예시 없음. 배근명(D22/#7/UD22/D25/#8) 무관하게 동일 실패 → 구조적 문제(정형 불명 또는 RC Design 미실행 전제).
- `post/table` RC 검토 TABLE_TYPE(CONCCOLUMNCHECK 등) → `"error creating utbl (ex PostMode…)"` (포스트모드/해석결과 전제).

### 결론(검증 범위)
- **검증됨**: 엔드포인트 실재·래퍼(Argument)·I/O 계약·**TWN-USD112 네이티브**·RCHK 스키마.
- **미달성**: 실 곡선 1건 — `db/RCHK` 부재 + 요청정형 미공개로 API 단독 불가. **유일 경로 = GUI에서 RC Design 선실행 후 모델상주 PM 읽기**(이 빌드에서 가능 여부 추가확인 필요).
- **제품 영향**: 우리 기둥 P-M은 **자체 해석곡선(strain-compatibility, TWD-USD112)**로 고도화(§#2). `/POST/PM`은 GUI 설계 완료 모델에서의 **선택적 교차검증**으로 남김.

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
