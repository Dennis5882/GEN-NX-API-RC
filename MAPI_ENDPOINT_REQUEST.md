# MIDAS Gen NX MAPI — [정정] 동적해석/횡하중 엔드포인트 조사 결과
# MIDAS Gen NX MAPI — [更正] 動力分析/橫力 端點 調查結果

> 작성: Dennis · 최초 2026-06-12 · **정정 2026-06-13**
> 撰寫：Dennis · 初版 2026-06-12 · **更正 2026-06-13**
> 상세 근거: [MAPI_FINDINGS.md](MAPI_FINDINGS.md)

---

## ⚠️ 정정 공지 (이 문서의 이전 주장은 철회됨)

이 문서의 **초판은 `db/eigv`, `db/spfc`, `db/splc`, `db/seis`, `db/wind` 가 "스키마 미노출/차단"
이라고 주장**했으나, **이는 사실이 아님**이 공식 API 매뉴얼 확인으로 밝혀졌다. 따라서 **스키마 개방
요청은 철회**한다. 실제 원인은 아래 두 가지였다:

1. **엔드포인트 이름 오추측** — 특히 지진하중은 `db/seis`가 아니라 **`db/POSL`**(Parameter of Seismic Loads).
2. **필수 필드 누락** — 예: `db/EIGV` 테스트 시 `{"iFREQ":6}`만 보냈으나 **`TYPE`("EIGEN" 등)이 필수**.
   빈 객체/필수필드 누락에 대한 `"Wrong Field"`는 **차단이 아니라 정상적인 유효성 검증 응답**이었다.

### 실제 확인된 엔드포인트 (공식 매뉴얼)

| 초판의 주장 | 실제 URI | 비고 |
|---|---|---|
| `db/eigv` 차단 | **`db/EIGV`** | TYPE(EIGEN/LANCZOS/RITZ)·iFREQ·iITER·iDIM·TOL… 전체 스키마 문서화 |
| `db/seis` 차단 | **`db/POSL`** | 이름 오추측. METHOD=EQV_STATIC/RES_DISP, SZ·EPA·SC·FA·FV·IF·RMF |
| `db/spfc` 차단 | **`db/SPFC`** | 국가별 응답스펙트럼 함수(대만 포함) |
| `db/splc` 차단 | **`db/SPLC`** | NAME·DIR·ANGLE·SCALE·PMFT·bDAMP… |
| `db/wind` 차단 | Wind Loads(User Type) | 아래 "남은 진짜 항목" 참조 |

---

## ✅ 남은 진짜 요청 — 문서 불일치(gap) 1건

차단/스키마 문제가 아니라 **문서 정합성** 문제다.

**풍하중(Wind Loads, User Type)**: Gen NX 정식 기능(`[Load] > [Static Loads] > [Lateral] > [Wind Loads]`)이며
**GrassHopper API 매뉴얼에는 문서화**(출력 JSON 명령 `WIND`; 컴포넌트 Wind Loads / Wind Pressure(User) /
Wind Additions — 층별 풍압·Along·Across·Torsional)되어 있으나, **JSON REST(JSON Manual)에는 해당 페이지가 없음.**

- **요청**: JSON REST 매뉴얼에 Wind Loads(및 대응 Seismic Pressure/Additions) 페이지의 **JSON URI·필드 스키마를 추가**해 주세요.
  (동일하게 GrassHopper엔 있고 JSON REST엔 없는 항목이 더 있는지도 점검 요청.)
- 참고: MIDAS API는 Civil NX·Gen NX 공용이므로, 각 엔드포인트의 **제품별 유효성**(Gen NX/Civil NX) 명시도 도움이 됩니다.

---

## ⚠️ 更正公告（本文件初版主張已撤回）

本文件**初版主張 `db/eigv`、`db/spfc`、`db/splc`、`db/seis`、`db/wind`「schema 未開放／受阻」**，
經查官方 API 手冊**並非事實**，故**撤回 schema 開放請求**。實際原因有二：

1. **端點名稱誤推測** — 地震載重並非 `db/seis`，而是 **`db/POSL`**（Parameter of Seismic Loads）。
2. **缺少必填欄位** — 例：測試 `db/EIGV` 時僅送 `{"iFREQ":6}`，但 **`TYPE`（"EIGEN" 等）為必填**。
   對空物件／缺必填欄位回傳 `"Wrong Field"`，**乃正常的驗證回應，而非封鎖**。

| 初版主張 | 實際 URI | 備註 |
|---|---|---|
| `db/eigv` 受阻 | **`db/EIGV`** | TYPE/iFREQ/iITER/iDIM/TOL… 完整 schema |
| `db/seis` 受阻 | **`db/POSL`** | 名稱誤推測。METHOD=EQV_STATIC/RES_DISP |
| `db/spfc` 受阻 | **`db/SPFC`** | 各國反應譜函數（含臺灣） |
| `db/splc` 受阻 | **`db/SPLC`** | NAME/DIR/SCALE/PMFT… |
| `db/wind` 受阻 | Wind Loads(User Type) | 見下方「真正待處理項」 |

### ✅ 真正待處理項 — 文件不一致 1 件
**風力（Wind Loads, User Type）** 為 Gen NX 正式功能，**GrassHopper API 手冊有文件**（輸出 JSON 指令 `WIND`），
但 **JSON REST（JSON Manual）無對應頁面**。請於 JSON REST 手冊**補上 Wind Loads（及 Seismic Pressure/Additions）
之 JSON URI 與欄位 schema**，並標註各端點之**產品適用性**（Gen NX／Civil NX）。

---

## Appendix — 검증 요약 / 驗證摘要 (language-neutral)

**Resolved (exact REST URI + schema found in official manual):**
`db/EIGV` (eigenvalue), `db/POSL` (seismic, was mis-guessed as `db/seis`),
`db/SPFC` (response-spectrum function, incl. Taiwan), `db/SPLC` (response-spectrum load case).

**Documentation gap (function exists, JSON-REST manual page missing):**
Wind Loads (User Type) — documented in GrassHopper API manual (JSON command `WIND`), absent from JSON-REST manual.

**Root cause of original "Wrong Field":** wrong endpoint name (`seis`→`POSL`) and missing required fields
(e.g. `TYPE` for `db/EIGV`), NOT a blocked/empty field schema.

**Confirmed working (unchanged):**
`doc/new`, `doc/anal`, `db/unit`, `db/matl`, `db/sect`, `db/thik`, `db/node`, `db/elem`, `db/cons`,
`db/stld`, `db/bodf`, `db/fbld`, `db/fbla`, `db/cnld`(`CNLD`), `db/bmld`(`BMLD`), `db/rigd`,
`db/lcom-gen`, `db/styp`, `post/table`.
