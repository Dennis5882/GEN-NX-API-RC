# 스토리(표준층) 기반 MIDAS Gen NX 모델링 — 설계 문서 v0.2

> 대상 제품: **MIDAS Gen NX** (NX Open API) / 주요 지역: **대만(Taiwan)** / 구조: **RC, Frame**
> 근거 규격: `structural_design_spec_v1.pdf` (標準層 모듈 규격서)
> API 근거: [NX Open API JSON Manual](https://support.midasuser.com/hc/en-us/sections/30087500371097-JSON-Manual) (스키마 검증 완료, 2026-06)
> 상태: **설계안 (코드 미작성)** — §5 API 스키마 확정 / 검토 후 M1 구현 착수

---

## 1. 목표

PDF의 **표준층(Typical Floor)** 개념을 MIDAS Gen NX 모델링 워크플로우로 구현한다.
사용자는 "층(Story)" 단위로 사고하여 모델을 정의하고, 시스템이 이를 MIDAS Gen NX
물리 모델(노드/부재/단면/하중/스토리)로 전개한다. 이후 표준층 자동 판정, 구간별
배근, 도면 도명 자동화까지 한 파이프라인으로 연결한다.

**핵심 원칙 (PDF §4):** _"기하 동일, 내력 상이"_ — 표준층은 기하·위상·단면을
공유하지만(국부 강성행렬 [k] 동일), 자중 누적과 풍/지진 수평력의 높이별 분포 때문에
자연층마다 실제 내력(N·M·V)이 다르다. 따라서 **모델링은 1:N 매핑으로 압축**하되,
**해석·배근은 자연층별 내력**을 사용한다.

---

## 2. 핵심 개념 매핑 (PDF ↔ MIDAS Gen NX)

| PDF 개념 | MIDAS Gen NX 개념 | 비고 |
|---|---|---|
| 自然層 (물리 자연층) | **Story (STRY)** | Gen의 Story Data. 층 높이/레벨 정의 |
| 軸網 (축망) | **Grid / Axis** | X·Y 통경선 |
| 標準層 (표준층, 추상) | (Gen 네이티브 없음) → **앱 레이어 가상 객체** | 1:N 매핑 관리 단위 |
| Structural_Elements | NODE + ELEM (Beam/Column/Wall/Slab) | 부재 + 단면 |
| Geometry_Profile | Grid + Node 좌표 | 외곽/축망 |
| Load_Cases | STLD + Floor Load(Pressure) / BMLD | 고정·활하중 |
| Story_Height | Story Data의 Height | 계산 길이에 직접 영향 |

> ⚠️ **표준층은 MIDAS Gen NX에 네이티브 객체가 없다.** 따라서 본 시스템은 표준층을
> **애플리케이션 레이어의 가상(메타) 객체**로 관리하고, MIDAS 모델로 전개할 때
> `Mapped_Stories`만큼 Z방향으로 노드/부재를 복제 생성한다.

---

## 3. 아키텍처 (레이어)

```
┌─────────────────────────────────────────────────────────────┐
│  ① Input / Authoring Layer                                   │
│     - 표준층 정의(평면, 부재, 단면, 하중, 층고)              │
│     - Mapped_Stories 지정, 제외층 마킹                       │
│     - (선택) 기존 MIDAS 모델 / IFC import                    │
├─────────────────────────────────────────────────────────────┤
│  ② Domain Model (앱 코어, MIDAS 비종속)                      │
│     TypicalFloor / Story / Element / Section / LoadCase      │
│     - 표준층 자동 판정 엔진                                  │
│     - 구간별 배근 엔진 (내력 포락선)                         │
├─────────────────────────────────────────────────────────────┤
│  ③ MIDAS Gen NX Adapter (전개 + 결과 회수)                      │
│     - Domain → MIDAS Gen NX API payload (전개기/Expander)       │
│     - 해석 트리거 / 내력 결과 회수                           │
├─────────────────────────────────────────────────────────────┤
│  ④ Output Layer                                              │
│     - 배근 결과 / 도면 도명 자동생성 / 차이 주기            │
└─────────────────────────────────────────────────────────────┘
```

- ②는 MIDAS에 의존하지 않는 순수 도메인 코어 → 단위 테스트 용이, Civil NX 확장 여지.
- ③만 MIDAS Gen NX API에 종속 → 추후 제품 교체/버전 변화 흡수 지점.

---

## 4. 도메인 데이터 모델

PDF §2의 필드를 그대로 1차 매핑한다.

```jsonc
// TypicalFloor — 표준층 (추상 관리 단위)
{
  "typical_floor_id": "TF-A",          // String/UUID
  "mapped_stories": [4,5,6, ... ,28],  // 연속 또는 동일 위상 (필수: 연속성 검증)
  "story_height": 3200,                // mm, 계산 길이에 직접 사용
  "geometry_profile": {
    "grid_ref": "GRID-STD",            // 축망 참조
    "boundary": [[x,y], ...],          // 외곽 (Tolerance < 0.001mm)
    "tolerance_mm": 0.001
  },
  "structural_elements": [ /* Element[] */ ],
  "load_cases": {
    "dead": { "slab_pressure_kN_m2": 1.5, ... },
    "live": { "default_kN_m2": 2.0, "zones": [ {"region":"office","kN_m2":2.0} ] }
  }
}

// Element — 부재 (표준층 평면상 2D 상대좌표 + 단면)
{
  "type": "COLUMN | BEAM | WALL | SLAB",
  "tag": "C1",
  "section_id": "SC-600x600",
  "nodes_2d": [[x1,y1],[x2,y2]],       // 평면 상대좌표 (Z는 전개 시 부여)
  "material_id": "RC-4000"             // 대만: f'c, fy 별도 정의
}

// Story — 물리 자연층 (전개 결과 + 해석 입력 단위)
{
  "story_no": 4,
  "level_mm": 12800,
  "typical_floor_id": "TF-A",
  "is_standard": true,                 // 자동판정 결과
  "exclusion_reason": null             // 제외 시: BASEMENT/PODIUM/TRANSFER/REFUGE_ROOF
}
```

**불변식(검증 규칙):**
- `mapped_stories`는 연속이거나 동일 위상이어야 함 (PDF §2).
- 같은 표준층 내 대응 부재는 단면 **완전 일치** (PDF §3.1).
- 축망 정점 좌표 상대 편차 = 0 (PDF §3.1).

---

## 5. 표준층 → MIDAS Gen NX 전개 파이프라인 (모델 생성)

> ⚠️ **API 계층 구분 (중요):** 두 종류의 API가 있다.
> - **GATE API** (`https://gate.midasuser.com/api/rest/v1`, 인증 `X-API-KEY`+`X-USER-ID`):
>   클라우드 프로젝트/도면 관리·조회. 모델 생성 엔드포인트 없음.
> - **NX Open API** (`/db/<KEY>` 계열, 인증 `MAPI-Key`): 노드·요소·하중을 **생성/수정**.
>   → **본 시스템(스토리 모델링)의 대상은 이것.** ✅ 공식 매뉴얼로 스키마 확정 완료.
>
> 아래 파이프라인·매핑은 **NX Open API(Gen NX)** 기준이며, 모든 키·필드는
> [MIDAS API JSON Manual](https://support.midasuser.com/hc/en-us/sections/30087500371097-JSON-Manual)에서
> 실제 스키마를 확인해 기재했다(2026-06 기준).

**API 규약 (NX Open API — 공식 매뉴얼 확정):**
- 통신 구조: 클라이언트 → **REST(AWS 서버)** → **WebSocket** → 로컬 MIDAS Gen NX.
  서버가 `MAPI-Key`로 제품(실행 중인 Gen NX)을 식별 → **Gen NX가 켜져 있어야 함.**
- Base URL: `https://moa-engineers.midasit.com:443/gen` (Gen NX, 지역별 대체 서버 존재)
- 헤더: `Content-Type: application/json`, `MAPI-Key: <키>` (Gen NX 앱에서 발급)
- 메서드: **POST**=생성 / **PUT**=수정(신규파일 필수데이터는 GET/PUT만) / **GET** / **DELETE**
- **공통 바디 래퍼**: `{ "Assign": { "<ID>": { …필드… } } }` — ID는 부재/항목 번호

```
[문서 시작]  POST /doc/new                       ← 새 프로젝트(빈 바디 {})
      └─ PUT  /db/unit  {DIST,FORCE}             ← 단위계 고정 (대만: M·TONF 등)
정의(표준층 N개)
  └─> [전개기] mapped_stories 만큼 Z방향 복제
        ├─ Material : POST /db/matl   단면당 1회 등록 후 참조
        ├─ Section  : POST /db/sect   RC 사각/원형 (SECT_I.vSIZE=[h,w])
        ├─ Thickness: POST /db/thik   슬래브/벽 두께(T_IN/T_OUT)
        ├─ Node     : POST /db/node   (X,Y,Z=level), 동일평면이면 Z만 증가
        ├─ Element  : POST /db/elem   Column/Beam=BEAM, Slab=PLATE, Wall=WALL
        ├─ Group    : POST /db/(구조/하중 그룹)  표준층·부재유형별 라벨
        ├─ LoadCase : POST /db/stld   Dead("D")/Live("L") 등
        ├─ SelfWt   : POST /db/bodf   FV=[0,0,-1]
        └─ FloorLoad: POST /db/fbld(타입정의) → /db/fbla(면 지정)  ★PDF 표준층 하중
  └─> [경계조건] 최하단 지지(기초)  POST /db/cons (CONSTRAINT="1111000")
  └─> [해석]   Perform Analysis  → 결과 회수(§7)
  └─> [저장]   POST /doc/save
```

### MIDAS Gen NX API 리소스 매핑 (✅ 공식 매뉴얼로 스키마 검증 완료)

| 도메인 동작 | 엔드포인트 | 핵심 필드 (검증된 JSON) |
|---|---|---|
| 새 문서 | `POST /doc/new` | `{}` |
| 단위 | `PUT /db/unit` | `{DIST, FORCE}` (DIST: M/CM/MM/IN/FT · FORCE: KN/N/KGF/TONF/LBF/KIPS) |
| 재료(RC) | `POST /db/matl` | `{TYPE:"CONC", NAME, PARAM:[{P_TYPE:1, STANDARD, DB}]}` |
| 단면 | `POST /db/sect` | `{SECTTYPE:"DBUSER", SECT_NAME, SECT_BEFORE:{SHAPE:"SB", DATATYPE:2, SECT_I:{vSIZE:[h,w]}}}` |
| 두께(판/벽) | `POST /db/thik` | `{NAME, TYPE:"VALUE", bINOUT, T_IN, T_OUT, OFFSET, O_VALUE}` |
| 노드 | `POST /db/node` | `{X, Y, Z}` |
| 요소 | `POST /db/elem` | `{TYPE, MATL, SECT, NODE:[…], ANGLE, STYPE …}` — 타입표 ↓ |
| 정적하중케이스 | `POST /db/stld` | `{NAME, TYPE, DESC}` — TYPE: `D`(고정)·`L`(활)·`LR`(지붕활)·`S`(설)·`W`(풍)·`E`(지진)·`EH/EV`(토압)·`B/WP`(부력/지하수)… |
| 자중 | `POST /db/bodf` | `{LCNAME, FV:[0,0,-1]}` |
| 보 하중 | `POST /db/bmld` | `{ITEMS:[{ID, LCNAME, CMD:"BEAM", TYPE:"UNILOAD", DIRECTION:"GZ", D:[…], P:[…]}]}` |
| **바닥하중 타입** | `POST /db/fbld` | `{NAME, DESC, ITEM:[{LCNAME, FLOOR_LOAD, OPT_SUB_BEAM_WEIGHT}]}` ★ |
| **바닥하중 지정** | `POST /db/fbla` | `{FLOOR_LOAD_TYPE_NAME, FLOOR_DIST_TYPE(1~4), DIR:"GZ", NODES:[…], GROUP_NAME}` ★ |
| 지지(경계) | `POST /db/cons` | `{ITEMS:[{ID:1, CONSTRAINT:"1111000"}]}` (Dx Dy Dz Rx Ry Rz) |
| 하중조합 | `POST /db/lcom-gen` | `{NAME, ACTIVE:"ACTIVE", iTYPE:0, vCOMB:[{ANAL:"ST", LCNAME, FACTOR}]}` |

**요소 타입(`ELEM.TYPE`) 및 RC/Frame 매핑:**

| 구조부재 | `TYPE` | `STYPE` / 비고 |
|---|---|---|
| 기둥·보 (Frame) | `"BEAM"` | NODE=[i,j], ANGLE=Beta각 |
| 슬래브 | `"PLATE"` | NODE=3/4점, STYPE 1=Thick·2=Thin·3/4=+Drilling DOF |
| 벽체 (Wall) | `"WALL"` | NODE=4점, STYPE 1=Membrane·2=Plate, `WALL`(ID), `W_TYPE` 0=Plate·1=CRB-Pin·2=CRB-Fixed |
| (기타) | TRUSS/TENSTR/COMPTR/PLSTRS/PLSTRN/AXISYM/SOLID | 본 빌딩 모델 비대상 |

**★ PDF 표준층 하중 = Floor Load Type 직접 매핑:** PDF §3.2의 "주거 2.0 / 사무 2.0 /
설비실 7.0 kN/㎡"는 각각 **`/db/fbld` Floor Load Type 한 건**으로 정의되고, 자연층 면적에
**`/db/fbla`** 로 지정된다. 따라서 자동판정(§6)의 하중 일치 비교 = **부여된 Floor Load
Type 동일 여부 비교**로 구현된다.

> ⚠️ **남은 1건 — Story(층) 데이터 엔드포인트:** 공개 JSON Manual에는 **층 데이터
> 전용 `/db/<KEY>`가 없다**(매뉴얼은 Civil NX 위주). 따라서 **자연층/표준층은 앱
> 레이어에서 관리**(노드 Z레벨로 층 표현)하고, 부재 라벨링은 **Structure Group**으로
> 처리한다 — §2 설계와 일치. 층별 결과(층전단·층변위)가 필요하면 Gen NX의 층 정의
> 지원 여부를 제품에서 별도 확인(M3 전 결정).

**전개기 최적화:** 단면·재료·두께는 표준층 단위 1회 등록 후 자연층 부재가 ID 참조 →
PDF "중복 제거" 정신과 일치. 노드/요소는 한 번의 `Assign`에 다수 ID를 담아 **일괄(batch)
POST** 로 호출 수 최소화.

---

## 6. 표준층 자동 판정 모듈 (PDF §3)

기존 MIDAS 모델 또는 IFC를 import할 때 자연층을 순회하며 표준층 후보로 귀납.

```
FOR EACH 인접 자연층 쌍 (S_i, S_{i+1}):
  # ①제외 필터 (하드) — 최우선
  IF S in {지하/기초, 裙房Podium, 전이층, 피난/지붕}: 제외, 사유 기록  # §3.3
  # ②기하·위상 일치 (§3.1)
  IF 축망 정점 상대편차 != 0: 분리
  IF 대응 부재 단면(형상+치수) != 완전일치: 분리
  # ③하중 분포 일치 (§3.2) — 부여된 Floor Load Type(/db/fbla→fbld) 동일 여부로 판정
  IF 부여_FloorLoadType_i != 부여_FloorLoadType_{i+1}  (예: 주거 2.0 vs 설비실 7.0): 분리, 비표준층
귀납 결과 → TypicalFloor 그룹 + 비표준 독립층 목록
```

**제외층 판정 입력(대만 맥락):**
- 지하/기초: 측방 토압·부력 → 경계조건 상이.
- 裙房(Podium): 대공간 스팬, 기둥 그리드 변경, 전단벽 축소.
- 전이층(Transfer): 골조-전단벽 전환부 → 비선형 해석 대상.
- 피난/지붕층: 여장벽, 방수/단열 자중 증가, 옥외 풍하중 계수 상이.

> 자동 판정은 **제안(suggestion)** 으로 제시하고 엔지니어가 확정(human-in-the-loop).

---

## 7. 구간별 최적 배근 로직 (PDF §4)

해석 후 자연층별 내력을 회수하여 표준층 구간을 따라 포락선 기반 배근.

```
FOR EACH TypicalFloor:
  forces = []
  FOR EACH story IN mapped_stories:
     forces += (N_max, M_max, V_max)  ← MIDAS 해석 결과 회수
  envelope = 포락선(forces)
  # 종방향 분절 최적화: 하부 구간 고배근율, 상부 구간 구조배근율
  segments = 분절_최적화(envelope)   # 예: 4~10층 고배근, 21~28층 구조배근
  # 연단부 보정 (§4.2): 표준층 구간 최상/최하 자연층 → 수축/온도 보강근
  apply_edge_correction(segments.top, segments.bottom)
```

- 단일 배근을 전 층에 일괄 적용 **금지** (PDF 명시).
- 출력: 구간 정의 + 구간별 배근율/철근량 + 연단 보강.

---

## 8. 도면 자동화 (PDF §5)

- **도명 자동 생성:** `"第" + first + "層至第" + last + "層" + 부재유형 + "配筋平面圖"`
  → 예: `第四層至第二十八層梁構造配筋平面圖`
  - 대만 관례상 한자 수사 변환(4→四, 28→二十八) 유틸 포함.
- **층별 차이 주기:** 표준층 내 특정 자연층 국부 변경(개구부/국부 증타)은 도면 분할
  없이 점선/주기로 표기. 예: `（僅限15層設 150mm 洞口）`
- 출력 포맷: 우선 메타데이터(JSON) → DWG/BIM 연계는 후속 단계.

---

## 9. 대만 RC / Frame 특화 고려사항

| 항목 | 내용 | 반영 위치 |
|---|---|---|
| RC 설계 코드 | **`TWD-USD112`** (배근/설계) | M3 배근 |
| 콘크리트 재료 | STANDARD **`CNS560(RC)`** / `CNS560-18(RC)` · 등급 `C210/245/280/315/350/420` | `taiwan.concrete()` ✅ |
| 강재 재료 | STANDARD **`CNS(S)`** / `CNS06(S)` · 등급 `SS400/SN400/SM400/SM490/SN490` | `taiwan.steel()` ✅ |
| 단위계 | M·TONF(tf·m) / M·KN 선택 옵션 | `UnitSystem` ✅ |
| 지진하중 | 정적등가/응답스펙트럼 — 수평력 높이 분포 (PDF §4 핵심) | 해석 입력 (M3) |
| 언어 | 도면/주기 번체 중문 | Output 레이어 (M4) |

> ✅ 재료 STANDARD/등급 문자열은 **라이브 MIDAS Gen NX 로 검증 완료**(2026-06-11) →
> `midas_story/taiwan.py`. 하중조합/지진 계수 상세는 M3 에서 `TWD-USD112` 기준으로 확정.

---

## 10. 단계별 로드맵 (전체 범위 → 점진 구현)

| 단계 | 산출물 | 상태 |
|---|---|---|
| **M1** | 도메인 모델 + 검증(불변식) + 전개기(표준층→MIDAS Gen NX 모델 생성) | ✅ **완료** |
| **M1.5** | 작성 강화 — 그리드, 다중 표준층/특수층, 다이어프램, 대만 하중조합 | ✅ **완료** (테스트 23 통과) |
| **M2** | 횡하중·횡저항(지진·풍·전단벽) + 기존모델 표준층 자동판정 | ✅ **완료** (Agent/Wizard v2.3.0, M2-A4 동적해석만 API 대기) |
| **M3** | 해석 결과 회수 + 구간별 배근 엔진 | ✅ **완료** (보 휨·전단 + 기둥 이축 P-M + 배근표 CSV, v2.6.0; SMRF 디테일은 후속) |
| **M4** | 도면(배근도 配筋圖)·문서 자동화 (DXF) | 🔄 **진행** (도면세트 v2.8.0: 평면도+梁/柱配筋圖+梁表/柱表+표제란; 층별차이·실CAD 미조정 후속) |

**M1 구현 메모 (2026-06-11):**
- 순수 Python 코어 `midas_story/` (domain·validation·payloads·expander·client), 웹 비종속.
- 입력: **신규 작성(authoring)** 우선. 단위계: **M·TONF / M·KN 선택 옵션**.
- 전개 규약: COLUMN→수직 BEAM, BEAM→수평 BEAM, WALL→4절점 WALL, SLAB→PLATE.
  노드 좌표 dedup 1e-6 m. 최하단(`base_level`) 노드에 지지 자동 부여.
- `Expander.build()` 는 검증→전개→Operation 목록(순수). `MidasClient.run()` 이 전송,
  `RecordingClient` 로 드라이런/테스트.
- 대만 재료: `taiwan.concrete(fc=280)` → `CNS560(RC)/C280`, `taiwan.steel("SN490")` → `CNS(S)`.
- **라이브 검증(2026-06-11)**: 실제 Gen NX 전송 12/12 성공 — 노드 104·요소 250·바닥하중 25·지지 4,
  재료 `CNS560(RC) C280` 확인. (저장은 모달 대화상자 유발로 기본 OFF.)

**M1.5 구현 메모 (2026-06-11):**
- **그리드** `grid.py` — 통경선(X:1,2,3 / Y:A,B,C) 정의 → `build_frame()` 으로 기둥·보·슬래브 자동 생성.
- **다중 표준층/특수층** — `TypicalFloor.role`(TYPICAL/PODIUM/TRANSFER/ROOF/BASEMENT). 기단부+기준층+지붕 1동 구성.
- **층 다이어프램** — `/db/rigd` Rigid Link, `DOF=110001`(Dx·Dy·Rz). `TypicalFloor.diaphragm` 토글.
- **대만 하중조합** — `combos.py` `taiwan_strength_combos()` → `/db/lcom-gen` (TWD-USD112, ACI계열 USD).
- **라이브 검증**: 그리드 3×2 + 기단부/기준층/지붕(13층) 전송 14/14 성공 — 노드 168·요소 455·다이어프램 13·하중조합 3.
- ⚠️ 라이브 검증으로 발견·수정: **하중조합 이름 ≤20자 제한**(수식은 DESC로). 검증 단계에 길이 체크 추가.

---

## 11. 착수 전 확정 필요 항목 (Open Questions)

- ✅ **API 접속/인증/구조** — 해결: NX Open API, Base URL `…/gen`, 헤더 `MAPI-Key`,
  REST→AWS→WebSocket→로컬 Gen NX. **Gen NX 실행 + 키 발급** 필요.
- ✅ **모델링 리소스 스키마** — 해결: node/elem/matl/sect/thik/stld/bodf/bmld/fbld/fbla/cons/lcom-gen
  실제 JSON 검증 완료(§5).
- ✅ **바닥하중 ↔ PDF 표준층 하중** — 해결: `/db/fbld`+`/db/fbla`로 직접 매핑.

1. **Story(층) 데이터** ⚠️: 공개 JSON Manual에 층 전용 키 없음 → 앱 레이어 관리로 확정.
   단, 층별 결과(층전단·변위) 필요 시 Gen NX 제품의 층 정의/결과 추출 방식 확인(M3 전).
- ✅ **입력 소스** — 해결: **신규 작성(authoring) 우선**, import(M2) 후속.
- ✅ **단위계** — 해결: **선택 옵션**(M·TONF / M·KN), `Expander(units=...)`.
- ✅ **대만 규범/재료** — 해결(라이브 검증): RC 설계 `TWD-USD112`, 콘크리트 `CNS560(RC)`,
  강재 `CNS(S)` → `taiwan.py`.
- ✅ **프로젝트 형태** — 해결: **순수 Python 코어 먼저**, 웹 백엔드 후속.

2. **(M2)** 자동판정용 기존 모델/IFC import 스펙.
3. **(M3)** `TWD-USD112` 하중조합식·지진 수평력 분포 계수 확정.
```
