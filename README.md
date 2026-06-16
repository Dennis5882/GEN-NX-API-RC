# Gen NX 대화형 RC 모델링 에이전트 · 표준층(標準層) 기반

대만(臺灣) **RC 라멘조** 건물을 **표준층(Typical Floor)** 개념으로 정의하고,
브라우저에서 **MIDAS Gen NX Open API**로 모델 생성 → 횡하중 → 해석 → 배근 → **도면(DXF)** 까지
한 흐름으로 자동화한다. 설치 불필요(브라우저가 MAPI 직접 호출).

- 대상: **MIDAS Gen NX** / 지역: **대만** / 구조: **RC Frame** / 규격: **CNS560(RC) · TWD-USD112 · 耐震規範**
- 개발: **Dennis**
- 현재: **M1–M4 완료** (동적해석 M2-A4만 API 노출 대기 — [MAPI_ENDPOINT_REQUEST.md](MAPI_ENDPOINT_REQUEST.md))

---

## 두 가지 트랙

| | 무엇 | 진입점 |
|---|---|---|
| **① 웹앱(주력)** | 대화형 Agent + 폼 Wizard, 공용 엔진 공유 | `gen_nx_rc_agent.html` · `MIDAS_RC_Modeling_Wizard.html` |
| ② Python 코어 | 최초 도메인 엔진(M1/M1.5), 순수 Python | `midas_story/` |

웹앱과 Python 코어는 같은 도메인 규약(표준층 전개·대만 규격)을 공유한다.
웹앱의 단일 진실원천은 **`shared/rc_engine.js`** (Agent·Wizard 공용).

---

## ① 웹앱 사용법

### 가장 쉬운 방법 — 단일 파일
**`gen_nx_rc_agent_standalone.html`** 하나만 받으면 된다(엔진 내장, `shared/` 폴더 불필요).
브라우저로 열기 → ⚙에서 **MAPI-Key 입력** → **로컬 Gen NX 실행** → 자연어/메뉴로 명령.
> 인터넷 필요: MIDAS API + Plotly(3D, CDN). 오프라인이면 3D 미리보기만 빠지고 빌드·배근·DXF는 동작.

### 안정판 vs 최신판
| | 파일 | 내용 |
|---|---|---|
| **안정판(배포)** | `gen_nx_rc_agent_v1.2.0.html` | **모델링·하중·검증** — 표준층 모델 생성 + 지진/풍 횡하중 + 전단벽 + 동적해석 + 해석결과 + SSEIS/층중량 교차검증 + Story 자동생성. **배근·도면·기존모델 불러오기는 제외**(최신판 전용). **Vercel 배포 대상**, `index.html`이 이걸로 리다이렉트 |
| 최신판(실험) | `gen_nx_rc_agent.html` (현 v2.12.3) | 위 + **M3 배근(TWD-USD112)·M4 도면(DXF)·M2-B 기존모델 자동판정**. 전체 기능. |

### 분할형(개발·배포)
HTML + `shared/rc_engine.js`(같은 위치) + `index.html`. Vercel 등 정적 호스팅에 리포 그대로 올리면 됨
(빌드 없음). **`index.html` → `gen_nx_rc_agent_v1.2.0.html`(안정판)**. 배근·도면까지 보려면 `gen_nx_rc_agent.html`(최신판).

### 할 수 있는 것
- **모델 생성**: 5종 RC 템플릿(住宅/辦公/商場/醫院/學校) + 자유 골조, 표준층 표 편집, 3D 미리보기
- **횡하중**: 지진 等效靜力(TWD 耐震, 工址 프리셋) · 풍(간이 정적풍) → cLCB1~7 자동
- **횡저항**: 중앙 전단벽 코어(PLATE)
- **해석·배근**: 해석 결과 회수(BEAMFORCE) → 보 휨·전단 + 기둥 이축 P-M 배근(TWD-USD112), 배근표 CSV
- **도면(DXF)**: 골조평면도 + 梁配筋圖 + 柱配筋圖 + 梁表/柱表 + **층별 차이 주기**(표준층 기준) + 표제란
  → CAD에서 열어 **.dwg**로 저장·편집 (公會 RC01/RC04/RC06 標準圖 참조)
- **기존 모델 자동판정**: 실행 중 모델 읽기 → 표준층 그룹 자동 추정
- 다국어: **한국어 / English / 繁體中文**

---

## ② Python 코어 (midas_story/)

최초 도메인 엔진(M1/M1.5). 순수 Python, 네트워크 비의존 전개 → Operation 목록 → 전송.

```bash
pip install -r requirements.txt   # requests, pytest
python -m pytest tests/ -q
cd examples && python build_sample_building.py        # 드라이런
#                python build_sample_building.py --send  # 실제 전송(키·Gen NX 필요)
```

```
midas_story/  units · domain · grid · combos · validation · payloads · expander · client · taiwan
```

---

## 로드맵

- **M1 / M1.5** ✅ 모델 생성(표준층→자연층) · 그리드·다중표준층·다이어프램·대만 하중조합
- **M1.7** ✅ 대화형 Agent + 공용 엔진(`shared/rc_engine.js`)
- **M2** ✅ 횡하중·횡저항(지진·풍·전단벽) + 기존모델 표준층 자동판정
  - **M2-A4(동적해석)** ✅ 고유치(`db/EIGV`)→실주기 T₁→지진 Cs 보정 + 응답스펙트럼(`db/SPFC`+`db/SPLC`, 대만).
    API 전수조사로 "차단" 오판 정정·라이브 검증 ([MAPI_FINDINGS.md](MAPI_FINDINGS.md)). v2.10.0(최신판)에 반영.
  - **M2-A5(SSEIS 교차검증, v2.12)** ✅ 자체계산 등가정적 층력 ↔ Gen 네이티브 `db/SSEIS`(USER TYPE) STORY_SHEAR/OTM diff(QA, `verify_seismic_sseis` 도구). **라이브 검증(0616): GUI Story 정의 모델에서 13행(밑면 포함) 0% 오차 PASS.** STORY_SHEAR=엄격상위 누적·OTM=ΣF·(z−L)·밑면 G.L.행 검증. `actSseisVerify`가 `GET db/STOR`로 등록 층명에 자동 매핑. **전제: Gen Story Manager에 등록된 Story(GUI Story탭/Auto Generate) 필요 — `db/STOR` API만으론 미등록**([GEN_NX_SSEIS_INTEGRATION_PLAN.md](GEN_NX_SSEIS_INTEGRATION_PLAN.md)).
  - **M2-A8(Story 정보 자동 생성, v2.12.3)** ✅ 빌드 시 표준층 표고로 **db/STOR(Story Data) 자동 생성**(기본 ON, 표준층 카드 체크박스). 규약: 지반 1F@0 + 층 2F…RF, footprint·5% 편심거리(엔진 `buildStoryData`). **다이어프램은 db/rigd가 담당하고 Story `bFLOOR_DIAPHRAGM`은 false** — 둘 다 켜면 같은 절점 DOF 중복(Dup-DOF) 에러라 분리(라이브 규명). ⚠ Story Data 테이블만 — Story Manager(Module) 등록은 GUI Auto Generate 별도.
  - **M2-A7(SWIND 풍 교차검증, v2.12.6)** ✅ 자체계산 정적풍 층력 ↔ Gen 네이티브 `db/SWIND`(USER TYPE) STORY_SHEAR/OTM diff(`verify_swind` 도구). 자체 풍력(kN)→압력 역산(`WIND_FORCE=PRESS×수직폭×tribH`)→PUT→GET→비교. 엔진 `swindSelfPressures` + SSEIS diff 재사용. 전제: Gen Story Manager 등록 층(SSEIS와 동일). 오프라인 체인 검증 PASS, GUI 라이브 정의검증 예정.
  - **M2-A6(층중량 교차검증, v2.12.2)** ✅ 자체 등가정적 층중량 ↔ Gen 실모델 층중량 비교(정보성, `verify_story_weight` 도구). w0 추정 sanity-check·보정 단서. **`ope/STORPROP`이 0612 베타 미탑재(404)라, 라이브로 확인된 `db/SSEIS` GET PROFILE의 `STORY_WEIGHT`(실모델 층질량)로 출처 교체** — 최소 SSEIS PUT→GET→DELETE(흔적 원복). 엔진 `sseisProfileToStoryProp`+`storyWeightDiff` 오프라인 검증 완료. 전제: 등록 Story 모델.
- **M3** ✅ 해석 결과 회수 + 구간별 배근(보 휨·전단 + 기둥 이축 P-M, TWD-USD112)
  - **기둥 P-M 고도화(v2.11)** ✅ 둘레 다층배근(측면근 반영)·φPn,max(0.80φPo) 축캡·실배근 P-M 곡선 노출.
    `/POST/PM` 라이브 조사로 `db/DCON` 네이티브 `TWN-USD112` 확인 ([MAPI_FINDINGS.md](MAPI_FINDINGS.md) §C++++++++).
- **M4** ✅ 도면·문서 자동화(DXF) — 配筋圖·일람표·층별차이·표제란 (대만 公會 標準圖 참조)
- **M5** 📋 (후보, 미착수) 차기 확장 방향 — 범위 미확정
  - 기초/말뚝 설계
  - 시공도(shop drawing)·물량산출(BOQ) 자동화
  - 설계서(계산서) PDF 리포트 생성
  - `/POST/PM` 라이브 교차검증 정식 연동

문서: [DESIGN.md](DESIGN.md) · [M2_DESIGN.md](M2_DESIGN.md) · [M4_DESIGN.md](M4_DESIGN.md) · [CHANGELOG.md](CHANGELOG.md)

---

## 주의 (보안)
- **MAPI-Key는 각자 브라우저에서 입력** — 소스/리포에 키를 넣지 않는다.
- 실제 모델링은 **로컬 Gen NX 실행 + 본인 키** 필요. CORS 개방으로 브라우저가 직접 호출.
