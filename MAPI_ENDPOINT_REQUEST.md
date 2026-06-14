# MIDAS Gen NX MAPI — 보고/요청 (버그 · 문서 · 기능)
# MIDAS Gen NX MAPI — 回報／請求 (Bug · 文件 · 功能)

> 작성: Dennis · 갱신 2026-06-13 · 대상: MIDAS Gen NX MAPI 개발팀
> 검증 환경: `https://moa-engineers.midasit.com:443/{gen|civil}` · `MAPI-Key` 인증 · 라이브(Gen·Civil) 교차검증
> 상세 근거·재현: [MAPI_FINDINGS.md](MAPI_FINDINGS.md)
> 撰寫：Dennis · 更新 2026-06-13 · 對象：MIDAS Gen NX MAPI 開發團隊

---

## 한국어

### ① 🐞 버그 — `db/NMAS`(절점질량) PUT 시 Gen NX 하드 크래시
- **증상**: `PUT db/NMAS` 직후 Gen NX가 **비정상 종료** ("Program will be closed due to an unexpected problem.
  The recovered file is saved in `…\DgnPlugIn\_restore.mgbx`").
- **재현율**: **3/3 (100%)**. 동일 모델에서 NMAS 직전 단계(node/elem/cons 등)는 모두 정상(200).
- **재현 절차**:
  1. `PUT db/UNIT`, `db/MATL`, `db/SECT`, `db/NODE`, `db/ELEM`, `db/CONS` (정상)
  2. `PUT db/NMAS` `{"Assign":{"5":{"mX":20,"mY":20,"mZ":20}, …}}` → **응답 없음(연결 끊김) + Gen NX 종료**
- **임시 회피**: 질량은 `db/STYP`(`bSELFWEIGHT:true`) + `db/LTOM`(하중→질량)으로 대체 가능(정상 동작).
- **요청**: `db/NMAS` 입력 처리부 점검 — 예외/메모리 접근 오류로 추정.

### ② 📄 문서 불일치 — JSON Manual에 일부 기능 페이지 누락
- **Wind Loads(User Type)** 및 **Seismic Pressure(User)/Additions**는 **GrassHopper API 매뉴얼에는 문서화**되어
  있으나(출력 JSON 명령 `WIND`), **JSON Manual(REST)에는 해당 페이지가 없습니다.**
- 실제로 `GET db/WIND`는 200(존재)이나 필드 스키마가 공개되지 않아 `POST`가 모두 "Wrong Field"입니다.
- **요청**: JSON Manual에 **Wind Loads / Seismic Pressure(User)/Additions의 URI·필드 스키마 추가**.
  (GrassHopper엔 있고 JSON-REST엔 없는 항목 전반 점검 요청.)

### ③ 💡 기능 요청 — 정적 횡하중 "생성"의 REST 노출
- `db/POSL`(Parameter of Seismic Loads)은 건물 지진 파라미터(SDS/SD1/IF/RMF…)를 **저장**하나,
  해석 후 **등가정적 지진력을 생성하지 않습니다**(반력 ΣFX=ΣFY=0, 방향 필드 없음).
- 즉 **등가정적 지진·정적풍의 강제력 "생성"이 REST로 노출되지 않습니다**(GUI/플러그인 전용으로 보임).
- **요청**: 코드기반 정적 지진/풍 **자동생성**을 REST 명령으로 제공(방향·편심·층분포 포함).
  — 현재는 클라이언트가 직접 계산해 `db/CNLD`(절점하중)로 주입해야 합니다.

### ④ 참고 요청 — 제품(Gen/Civil)별 유효성 표기
- 공용 "MIDAS API"에서 엔드포인트별 **제품 적용성**(Gen NX / Civil NX)이 문서에 있으면 도움이 됩니다.
  (예: `db/WIND`은 Civil에서 404, `db/POSL`은 Civil에서 일부 필드만 적용됨 — 라이브 확인.)

---

## 繁體中文（臺灣）

### ① 🐞 Bug — `db/NMAS`（節點質量）PUT 時 Gen NX 當機
- **症狀**：`PUT db/NMAS` 後 Gen NX **異常結束**（"Program will be closed… `_restore.mgbx`"）。
- **重現率**：**3/3（100%）**。同模型中 NMAS 之前步驟（node/elem/cons 等）皆正常（200）。
- **重現**：`UNIT→MATL→SECT→NODE→ELEM→CONS`（正常）後 `PUT db/NMAS {mX,mY,mZ}` → **連線中斷＋當機**。
- **暫時替代**：質量改用 `db/STYP`（`bSELFWEIGHT:true`）+ `db/LTOM`（載重→質量）（正常）。
- **請求**：檢查 `db/NMAS` 輸入處理（疑似例外／記憶體存取錯誤）。

### ② 📄 文件不一致 — JSON Manual 缺少部分功能頁
- **Wind Loads(User Type)** 與 **Seismic Pressure(User)/Additions** 於 **GrassHopper 手冊有文件**（JSON 指令 `WIND`），
  但 **JSON Manual(REST) 無對應頁面**。`GET db/WIND` 回 200（存在）但欄位 schema 未公開，`POST` 皆 "Wrong Field"。
- **請求**：於 JSON Manual **補上 Wind Loads / Seismic Pressure(User)/Additions 之 URI 與欄位 schema**。

### ③ 💡 功能請求 — 靜態橫力「產生」之 REST 開放
- `db/POSL` 僅**儲存**建築地震參數，解析後**不產生等效靜力地震力**（反力 ΣFX=ΣFY=0，無方向欄位）。
- 即**等效靜力地震／靜態風力之力「產生」未由 REST 開放**（似為 GUI／外掛專屬）。
- **請求**：以 REST 指令提供規範式靜態地震／風力**自動產生**（含方向・偏心・樓層分布）。
  目前須由用戶端自行計算後以 `db/CNLD`（節點載重）注入。

### ④ 參考請求 — 各產品（Gen/Civil）適用性標註
- 共用 "MIDAS API" 中，若文件標明各端點之**產品適用性**將有幫助
  （例：`db/WIND` 於 Civil 回 404；`db/POSL` 於 Civil 僅部分欄位生效 — 實機確認）。

---

## Appendix — 검증 사실 / 驗證事實 (language-neutral)

**Verified working (live, Gen NX):** `doc/NEW`, `doc/ANAL`, `db/UNIT`, `db/MATL`(CNS560(RC)), `db/SECT`,
`db/THIK`, `db/NODE`, `db/ELEM`(BEAM/PLATE), `db/CONS`(7-digit constraint), `db/STLD`, `db/BODF`, `db/CNLD`,
`db/BMLD`, `db/RIGD`, `db/STYP`(`bSELFWEIGHT`), `db/LTOM`, `db/EIGV`, `db/SPFC`, `db/SPLC`, `db/LCOM-GEN`,
`post/table`(`BEAMFORCE`, `REACTIONG`, `PARTICIPATIONVECTORMODE` …), `/mapikey/verify`.

**Issues:** `db/NMAS` crashes Gen NX (3/3); `db/WIND` field schema undocumented in JSON Manual;
`db/POSL` stores seismic params but does not generate static seismic forces.

**Note:** dynamic results (eigenvalue, response spectrum) are solver-computed and work via REST;
static lateral-load *generation* (equivalent-static seismic, static wind) appears GUI/plugin-only.
