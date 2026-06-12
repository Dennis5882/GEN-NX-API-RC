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
| **① 웹앱(주력)** | 대화형 Agent + 폼 Wizard, 공용 엔진 공유 | `gen_nx_rc_agent_v2.9.0.html` · `MIDAS_RC_Modeling_Wizard_v2.3.0.html` |
| ② Python 코어 | 최초 도메인 엔진(M1/M1.5), 순수 Python | `midas_story/` |

웹앱과 Python 코어는 같은 도메인 규약(표준층 전개·대만 규격)을 공유한다.
웹앱의 단일 진실원천은 **`shared/rc_engine.js`** (Agent·Wizard 공용).

---

## ① 웹앱 사용법

### 가장 쉬운 방법 — 단일 파일
**`gen_nx_rc_agent_v2.9.0_standalone.html`** 하나만 받으면 된다(엔진 내장, `shared/` 폴더 불필요).
브라우저로 열기 → ⚙에서 **MAPI-Key 입력** → **로컬 Gen NX 실행** → 자연어/메뉴로 명령.
> 인터넷 필요: MIDAS API + Plotly(3D, CDN). 오프라인이면 3D 미리보기만 빠지고 빌드·배근·DXF는 동작.

### 분할형(개발·배포)
`gen_nx_rc_agent_v2.9.0.html` + `shared/rc_engine.js`(같은 위치) + `index.html`(루트 리다이렉트).
Vercel 등 정적 호스팅에 리포 그대로 올리면 됨(빌드 없음). `index.html`이 에이전트로 리다이렉트.

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
  - M2-A4(동적해석=고유치·응답스펙트럼) — **API 미노출로 대기** ([MAPI_ENDPOINT_REQUEST.md](MAPI_ENDPOINT_REQUEST.md))
- **M3** ✅ 해석 결과 회수 + 구간별 배근(보 휨·전단 + 기둥 이축 P-M, TWD-USD112)
- **M4** ✅ 도면·문서 자동화(DXF) — 配筋圖·일람표·층별차이·표제란 (대만 公會 標準圖 참조)

문서: [DESIGN.md](DESIGN.md) · [M2_DESIGN.md](M2_DESIGN.md) · [M4_DESIGN.md](M4_DESIGN.md) · [CHANGELOG.md](CHANGELOG.md)

---

## 주의 (보안)
- **MAPI-Key는 각자 브라우저에서 입력** — 소스/리포에 키를 넣지 않는다.
- 실제 모델링은 **로컬 Gen NX 실행 + 본인 키** 필요. CORS 개방으로 브라우저가 직접 호출.
