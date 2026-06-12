# MIDAS Gen NX MAPI — 동적해석/횡하중 엔드포인트 스키마 노출 요청
# MIDAS Gen NX MAPI — 動力分析/橫力 端點 Schema 開放 請求

> 작성: Dennis · 2026-06-12 · 대상: MIDAS Gen NX MAPI 개발팀
> 검증 환경: `https://moa-engineers.midasit.com:443/gen` (REST → AWS → WebSocket → 로컬 Gen NX), `MAPI-Key` 인증
> 撰寫：Dennis · 2026-06-12 · 對象：MIDAS Gen NX MAPI 開發團隊

---

## 한국어

### 1. 배경 / 목적
대만(臺灣) RC 표준층 건물을 **브라우저에서 MIDAS Gen NX로 자동 생성·해석**하는 도구를 개발 중입니다
(설치 불필요, 브라우저가 MAPI 직접 호출). 모델 생성·중력하중·等效靜力(자체계산)·전단벽까지는
공개 엔드포인트로 **완전 자동화에 성공**했습니다. 그러나 **동적해석(고유치·응답스펙트럼)** 단계에서
필요한 엔드포인트의 **JSON 필드 스키마가 노출되지 않아** 자동화가 막혀 있습니다.

### 2. 무엇이 막혀 있는가 (라이브 검증 결과)
아래 엔드포인트는 **존재**하지만(GET 200), POST/PUT 시 **어떤 필드를 넣어도 — 심지어 빈 객체 `{}` 까지 —
`{"error":{"message":"Wrong Field"}}`** 를 반환합니다. 즉 MAPI에 **필드 정의가 등록되어 있지 않아** 설정 불가입니다.

| 엔드포인트 | 용도 | 현재 상태 |
|---|---|---|
| `db/eigv` | 고유치(모달) 해석 제어 | ❌ 빈 객체 포함 모든 필드 "Wrong Field" |
| `db/spfc` | 응답스펙트럼 함수 | ❌ 동일 |
| `db/splc` | 응답스펙트럼 하중케이스 | ❌ 동일 |
| `db/seis` | (코드기반) 지진하중 자동생성 | ❌ 동일 (이전 검증) |
| `db/wind` | (코드기반) 풍하중 자동생성 | ❌ 동일 (이전 검증) |

**진단 신호**: 스키마가 **노출된** 엔드포인트(예: `db/styp`)는 빈 객체 `{"Assign":{"1":{}}}` 에 대해
`"error status"`(정상, 기본값 처리)를 반환하는 반면, 위 엔드포인트들은 빈 객체에도 `"Wrong Field"` 를
반환합니다 — 이는 필드 검증기에 **해당 명령의 필드 세트가 비어 있음**을 시사합니다.

참고로 **정상 작동 확인된** 관련 엔드포인트:
- `db/styp` (Structure Type) — **자중→질량 변환 작동**. `bSELFWEIGHT:true` PUT·GET 확인.
  노출 필드: `STYP, MASS, SMASS, GRAV, TEMP, bALIGNBEAM, bALIGNSLAB, bMASSOFFSET, bROTRIGID, bSELFWEIGHT`.
- `db/nmas`(절점질량), `db/ltom`(하중→질량) — 엔드포인트 존재(스키마 미확인, 추가 검증 필요).
- `post/table` (REACTIONG 등 결과 회수) — 정상. → **모달 결과(주기) 읽기 경로는 열려 있을 가능성 높음.**

### 3. 우리가 하려는 프로세스 (동적해석 자동화 흐름)
```
[1] 질량 정의        : db/styp 자중→질량 (✅)  + db/ltom 바닥하중→질량
[2] 고유치 해석 제어 : db/eigv  (모드 수, 해법=Lanczos/Subspace, 수렴조건)   ← ❌ 막힘
[3] 해석 실행        : doc/anal
[4] 모달 결과 회수   : post/table (주기 T, 질량참여율)                       ← 읽기 가능 추정
[5] 응답스펙트럼 함수: db/spfc  (대만 耐震規範 설계스펙트럼 SaD(T))           ← ❌ 막힘
[6] 응답스펙트럼 케이스: db/splc (방향, 감쇠비, 조합법 CQC/SRSS)             ← ❌ 막힘
[7] 하중조합·부재력  : db/lcom-gen (✅)
```
현재 **[2][5][6]** 이 막혀 있어 동적해석 자동화가 불가능합니다.

### 4. 왜 이 프로세스가 필요한가
1. **규범 요구사항** — 대만 「建築物耐震設計規範及解說」은 **비정형(평면·입면 불규칙)·고층·중요도 높은 건물
   (병원·학교 등)** 에 대해 **動力分析(응답스펙트럼 또는 시간이력)** 을 요구합니다. 等效靜力만으로는 부족합니다.
2. **정확한 고유주기 T** — 等效靜力의 밑면전단계수 Cs 는 주기 T에 민감합니다. 현재는 경험식
   `Ta=0.0466·hn^0.9` 로 **추정**하지만, 실제 모달해석 주기로 보정해야 설계가 정확합니다.
   고유치 해석(db/eigv)이 막혀 이 보정 루프를 자동화할 수 없습니다.
3. **자동화 가치** — 위 [1]~[7]이 API로 열리면, 엔지니어가 **브라우저에서 클릭 한 번으로**
   대만 규범 기반 동적해석 모델을 생성·실행·회수할 수 있습니다(설치·수작업 GUI 불필요).
   현재는 [2][5][6]을 **Gen NX GUI에서 수동 설정**해야 하므로 자동화 흐름이 끊깁니다.

### 5. 구체적 요청
1. **`db/eigv`, `db/spfc`, `db/splc`** (및 가능하면 `db/seis`, `db/wind`) 의 **JSON 필드 스키마를 노출**해 주세요
   — `db/styp` 처럼 GET으로 기본 구조를 읽을 수 있고 PUT/POST로 필드를 설정할 수 있도록.
2. 각 명령의 **필드 목록·타입·기본값 문서**를 제공해 주세요(예: `db/eigv` 의 모드 수/해법/수렴조건 필드명).
3. 우선순위: **`db/eigv` (고유치) → `db/spfc`+`db/splc` (응답스펙트럼)**. 고유치만 열려도 주기 T 보정이 가능합니다.

### 6. 재현 방법 (개발팀 확인용)
```
POST /gen/db/eigv   body: {"Assign":{"1":{}}}      → 201 {"error":{"message":"Wrong Field"}}
POST /gen/db/eigv   body: {"Assign":{"1":{"iFREQ":6}}} → 201 {"error":{"message":"Wrong Field"}}
PUT  /gen/db/styp   body: {"Assign":{"1":{"bSELFWEIGHT":true, ...}}} → 200 (정상, 비교군)
```
헤더: `MAPI-Key: <키>`, `Content-Type: application/json`.

---

## 繁體中文（臺灣）

### 1. 背景 / 目的
本工具讓使用者**於瀏覽器中直接自動建立並分析 MIDAS Gen NX 的臺灣 RC 標準層建築**
（免安裝，瀏覽器直接呼叫 MAPI）。建模、重力載重、等效靜力（自行計算）、剪力牆等階段，
皆已透過公開端點**完成全自動化**。但在**動力分析（特徵值／反應譜）**階段，所需端點的
**JSON 欄位 schema 未開放**，導致自動化中斷。

### 2. 目前受阻之處（實機驗證結果）
下列端點**存在**（GET 回傳 200），但 POST/PUT 時**無論填入任何欄位 — 連空物件 `{}` 也是 —
皆回傳 `{"error":{"message":"Wrong Field"}}`**。即 MAPI **未註冊該指令的欄位定義**，無法設定。

| 端點 | 用途 | 目前狀態 |
|---|---|---|
| `db/eigv` | 特徵值（模態）分析控制 | ❌ 含空物件之所有欄位皆 "Wrong Field" |
| `db/spfc` | 反應譜函數 | ❌ 同上 |
| `db/splc` | 反應譜載重案例 | ❌ 同上 |
| `db/seis` | （規範式）地震載重自動產生 | ❌ 同上（先前驗證） |
| `db/wind` | （規範式）風力自動產生 | ❌ 同上（先前驗證） |

**診斷訊號**：schema **已開放**之端點（如 `db/styp`）對空物件 `{"Assign":{"1":{}}}`
回傳 `"error status"`（正常，套用預設）；而上列端點對空物件仍回 `"Wrong Field"`，
顯示其欄位驗證集為空。

**已確認正常**之相關端點：
- `db/styp`（Structure Type）— **自重→質量轉換可用**（`bSELFWEIGHT:true` PUT/GET 確認）。
  已開放欄位：`STYP, MASS, SMASS, GRAV, TEMP, bALIGNBEAM, bALIGNSLAB, bMASSOFFSET, bROTRIGID, bSELFWEIGHT`。
- `db/nmas`（節點質量）、`db/ltom`（載重→質量）— 端點存在（schema 未確認）。
- `post/table`（REACTIONG 等結果擷取）— 正常。→ **模態結果（週期）讀取路徑可能已開放。**

### 3. 我們要執行的流程（動力分析自動化）
```
[1] 質量定義       : db/styp 自重→質量 (✅) + db/ltom 樓板載重→質量
[2] 特徵值分析控制 : db/eigv  (模態數、解法 Lanczos/Subspace、收斂條件)    ← ❌ 受阻
[3] 執行分析       : doc/anal
[4] 擷取模態結果   : post/table (週期 T、質量參與率)                       ← 推測可讀
[5] 反應譜函數     : db/spfc  (臺灣耐震規範 設計反應譜 SaD(T))             ← ❌ 受阻
[6] 反應譜案例     : db/splc  (方向、阻尼比、組合法 CQC/SRSS)              ← ❌ 受阻
[7] 載重組合·構件力: db/lcom-gen (✅)
```
目前 **[2][5][6]** 受阻，動力分析無法自動化。

### 4. 為何需要此流程
1. **規範要求** — 臺灣「建築物耐震設計規範及解說」對**不規則（平面／立面）、高樓、重要度高之建築
   （醫院、學校等）**要求進行**動力分析（反應譜或時程）**，僅等效靜力並不足夠。
2. **精確基本週期 T** — 等效靜力之基底剪力係數 Cs 對週期 T 敏感。目前以經驗式
   `Ta=0.0466·hn^0.9` **估計**，應以實際模態週期修正方為精確。特徵值分析（db/eigv）受阻，
   無法自動化此修正流程。
3. **自動化價值** — 若 [1]~[7] 透過 API 開放，工程師可**於瀏覽器一鍵**完成符合臺灣規範之
   動力分析模型的建立、執行與擷取（免安裝、免手動 GUI）。目前須於 Gen NX GUI 手動設定
   [2][5][6]，自動化流程因而中斷。

### 5. 具體請求
1. 請**開放 `db/eigv`、`db/spfc`、`db/splc`**（若可能含 `db/seis`、`db/wind`）的 **JSON 欄位 schema**
   — 如同 `db/styp`，可用 GET 讀取預設結構、用 PUT/POST 設定欄位。
2. 請提供各指令之**欄位清單、型別、預設值文件**（例：`db/eigv` 之模態數／解法／收斂條件欄位名）。
3. 優先順序：**`db/eigv`（特徵值）→ `db/spfc`+`db/splc`（反應譜）**。僅開放特徵值即可進行週期 T 修正。

### 6. 重現方式（供開發團隊確認）
```
POST /gen/db/eigv   body: {"Assign":{"1":{}}}            → 201 {"error":{"message":"Wrong Field"}}
POST /gen/db/eigv   body: {"Assign":{"1":{"iFREQ":6}}}   → 201 {"error":{"message":"Wrong Field"}}
PUT  /gen/db/styp   body: {"Assign":{"1":{"bSELFWEIGHT":true, ...}}} → 200 (正常，對照組)
```
標頭：`MAPI-Key: <金鑰>`、`Content-Type: application/json`。

---

## Appendix — 검증 요약 / 驗證摘要 (language-neutral)

**Confirmed working (schema exposed):**
`doc/new`, `doc/anal`, `db/unit`, `db/matl` (CNS560(RC)), `db/sect`, `db/thik`, `db/node`, `db/elem`
(BEAM, PLATE), `db/cons`, `db/stld` (TYPE D/L/LR/E/W), `db/bodf`, `db/fbld`, `db/fbla`, `db/cnld`,
`db/rigd`, `db/lcom-gen`, `db/styp`, `post/table`.

**Blocked (endpoint exists, field schema NOT exposed — "Wrong Field" on every field incl. `{}`):**
`db/eigv`, `db/spfc`, `db/splc`, `db/seis`, `db/wind`.

**Diagnostic:** exposed control endpoints accept an empty `{"Assign":{"1":{}}}` (returns benign
`"error status"` for `db/styp`); blocked endpoints reject even `{}` with `"Wrong Field"`.
