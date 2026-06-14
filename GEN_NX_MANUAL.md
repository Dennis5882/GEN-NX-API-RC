# MIDAS Gen NX — 제품 매뉴얼 구조 (학습 노트)

> 출처: [MIDAS GEN NX Online Manual](https://support.midasuser.com/hc/ko/articles/49909210848537-MIDAS-GEN-NX-Online-Manual)
> 규모: **18개 리본 탭 · 220개 패널 · 977개 페이지** (2026-06-14 구조 파악).
> 목적: API가 아니라 **제품 자체의 메뉴/기능/개념 골격**을 익혀, "무엇을 왜 모델링하나"를 우리 도구·API와 매핑한다.
> API 거동은 [MAPI_FINDINGS.md](MAPI_FINDINGS.md), 본 문서는 **제품 구조 정본**.

---

## 1. 리본 구조 한눈에 (탭 → 주요 패널)

| 리본 탭 | 주요 패널 | 우리 도구/API 관련 |
|---|---|---|
| **GUI Information** | Frameworks Config, Type of Display, Task Pane, Analysis Guide, Tree Menu, Command Line | — (UI 개념) |
| **File** | New/Open/Close/Save/Save As/Save Current Stage/Import/Export/Data Conversion/Merge/Text Output/Print | `doc/new·open·save·anal` |
| **Project** | Management(Project Info·Preference·Project Status), Settings(**Unit System**) | `db/UNIT` |
| **View** | View(ViewPoint·Pan·Zoom·Rotate·Named View/Plane), Display, Activations, Select, Grids/Snap, Window, Coordinate System | `/view/*`, `/view/capture` |
| **Structure** | **Type**, **Building**, Group, **Wizard**, Tracing | `db/STYP`·**Story(GUI)**·골조 생성 |
| **Node/Element** | General, Node/Element Detail, **Flat/Plate Structure**, **Mesh**, Query | `db/NODE`·`db/ELEM`(BEAM/PLATE) |
| **Properties** | **Material**, **Section**, Inelastic, **Damping**, Property Tables | `db/MATL`·`db/SECT`·`db/THIK` |
| **Boundary** | **Supports**, Springs, **Links**(Rigid/Elastic), Release/Offset, Advanced | `db/CONS`·`db/RIGD` |
| **Load** | Static(Create LC·**Static**·**Masses**·**Lateral**·Pressure), Temperature, Prestress, Moving, **Dynamic**, Construction Stage, Heat of Hydration, Settlement, Misc | `db/STLD·BODF·CNLD·BMLD·FBLD·LTOM·NMAS`·`SPFC/SPLC` |
| **Analysis** | **Analysis Control**, **Perform** | `db/EIGV`·`doc/anal` |
| **Results** | Analysis results, **Combination**, Result Display, Detail Result, **Dynamic**, CS/Nonlinear, Moving, **Text/Tables** | `post/table`(REACTIONG·BEAMFORCE…) |
| **Time History** | TH Analysis Data, Result/Table | `db/THFC·THIS·THSL` |
| **Heat of Hydration** | Analysis Data, Result Tables | (교량/매스콘크리트) |
| **Pushover** | Control, Load Case, Properties, Perform, Results | 비선형 정적 |
| **Design** | **General/Steel/RC/Meshed/SRC/Cold-Formed** Design Type (각 Design Code·Input·Table·Perform·Result) | **RC Design(GUI)** — 우리는 자체계산 |
| **Seismic Performance (KISTEC/MOE/AIK)** | Pre/1st/2nd Evaluation, Linear/m-factor, Pushover, Time-History | 내진성능평가(한국 코드) |
| **Query** | Query, Detail Table, Mass/Load Table, Group Activation of CS, Bill | 수량/조회 |
| **Apps** | MGT, Application, Editor, Link, **API** | **Open API** = 우리 진입점 |

---

## 2. 우리 RC 도구와 직결되는 패널 (깊이 보기)

### Structure 탭 — 모델 골격
- **Type**: 구조 종류(3D/X-Z 등) + 질량 제어 → `db/STYP`(`bSELFWEIGHT`·`MASS`·`SMASS`).
- **Building**:
  - **Story Data** — 층 정의(층명·레벨·바닥 다이어프램, **Wind/Seismic 탭의 풍·지진 편심**). ⚠️ **GUI 기능** — API로 맨바닥 생성 어려움(우리 `db/STOR` "Wrong Field"). 정적 풍·지진이 여기에 결합.
  - Control Data, Auto Wall ID Generation, Base Structures, Tower/Tank.
- **Wizard**: 건물 자동생성 마법사 — 우리 "표준층→자연층" 전개의 GUI 대응.
- **Tracing**: CAD 도면 트레이싱.

### Load 탭 — 하중 (우리 M2)
- **Static Loads**: Create Load Cases(`db/STLD`), Self-Weight(`db/BODF`), Nodal(`db/CNLD`), Beam(`db/BMLD`), Floor(`db/FBLD/FBLA`).
- **Masses**: Nodal Masses(`db/NMAS` ⚠️크래시), **Loads to Masses**(`db/LTOM`) — 동적해석 질량원.
- **Lateral**: **Wind / Static Seismic** — ⚠️ **GUI 전용 생성**(코드기반 자동생성). API 미노출 → 우리는 **자체계산 후 `db/CNLD` 주입**.
- **Dynamic Loads**: Response Spectrum(`db/SPFC`함수+`db/SPLC`케이스), Time History(`db/THFC/THIS/THSL`).

### Analysis 탭 (우리 M2-A4)
- **Analysis Control → Eigenvalue**(`db/EIGV`): Subspace/**Lanczos**/Ritz. ⚠️ off-diagonal 질량(LTOM) 시 **Lanczos 필수**(라이브 발견).
- **Perform**(`doc/anal`).

### Results 탭 (우리 M3)
- Reaction/Displacement/Beam Force → `post/table`(REACTIONG·BEAMFORCE…). Story Drift/Mass = 불규칙성 관련 노출 테이블. 모달 주기는 SUB_TABLES(서버 버전따라 미반환).

### Design 탭 (우리 M3 배근의 GUI 대응)
- **RC Design Type**: Design Code → Input Data → Table → Perform → Result. **GUI 모듈**(설계코드 내장). 
  - ⚠️ **Taiwan 코드는 공식 API/Python에 없음** → 우리 자체계산 **TWD-USD112** 유지(필수). 휨·P-M은 moapy(ACI)로 교차검증 가능.

### Apps 탭
- **API** = MIDAS Open API 진입점(우리 도구의 토대). MGT(텍스트 모델), Application/Editor/Link.

---

## 3. 제품 ↔ API ↔ 우리 도구 매핑 (핵심 통찰)

| 제품 메뉴(GUI) | API 노출 | 우리 도구 |
|---|---|---|
| Properties(Material/Section/Thickness) | ✅ `db/MATL·SECT·THIK` | M1 모델 생성 |
| Node/Element(BEAM/PLATE) | ✅ `db/NODE·ELEM` | M1 (벽=PLATE) |
| Boundary(Support/Rigid) | ✅ `db/CONS·RIGD` | M1 (다이어프램) |
| Load▸Static/Floor/Mass | ✅ `db/STLD·BODF·CNLD·BMLD·FBLD·LTOM` | M2 하중 |
| **Structure▸Building▸Story** | ⚠️ **GUI 위주**(API STOR 난점) | (자연층 Z레벨로 대체) |
| **Load▸Lateral(Wind/정적지진)** | ❌ **API 생성 미노출** | **자체계산→CNLD 주입** |
| Load▸Dynamic(RS) + Analysis▸Eigenvalue | ✅ `db/SPFC·SPLC·EIGV` | M2-A4 동적해석 |
| Results | ✅ `post/table` | M3 결과회수 |
| **Design▸RC** | (GUI 모듈, Taiwan 없음) | **자체계산 TWD-USD112** |

**한 줄 요약**: 제품 메뉴 중 **모델·하중·동적해석·결과는 API로 1:1 매핑**되지만,
**Story 정의·정적 횡하중 생성·RC 설계(특히 Taiwan)는 GUI/내장 모듈 영역** → 우리 도구는 그 부분을 **자체계산·자연층·하중주입**으로 메운다. (이게 우리 아키텍처가 옳은 이유)

---

## 4. 후속 학습 후보 (필요 시 페이지 정독)
- Structure▸Building▸**Story Data** 페이지 — 정적 풍/지진의 정확한 입력 구조(우리 API 난점 해결 단서).
- Design▸RC Design Type▸**Design Code/Input** — 내장 RC 설계 흐름(자체계산 검증 비교).
- Load▸Lateral 상세 — 풍/지진 자동생성 파라미터(자체계산 정합성 점검).
- Analysis Guide(GUI Information) — 권장 해석 워크플로.
