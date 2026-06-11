# midas_story — 스토리(표준층) 기반 MIDAS Gen NX 모델링

PDF 규격서(標準層)의 **표준층(Typical Floor)** 개념을 코드로 정의하고,
표준층을 자연층 N개로 전개하여 **MIDAS Gen NX Open API** 모델을 생성한다.

- 대상: **MIDAS Gen NX** / 지역: **대만** / 구조: **RC, Frame**
- 설계 문서: [DESIGN.md](DESIGN.md)
- 현재 단계: **M1 (도메인 모델 + 검증 + 전개기)** — 순수 Python 코어

## 구조

```
midas_story/
├── units.py       # 단위계 옵션 (M·TONF / M·KN)
├── domain.py      # Material/Section/Thickness/LoadCase/FloorLoadType/LoadCombo/Element/TypicalFloor/Building
├── grid.py        # 통경선 그리드 + build_frame() 그리드 기반 프레임 자동생성   [M1.5]
├── combos.py      # taiwan_strength_combos() 대만 하중조합 (TWD-USD112)         [M1.5]
├── validation.py  # 불변식 검증 (연속성, 단면 일치, id 참조, 조합명 ≤20자)
├── payloads.py    # /db/* Assign 바디 빌더 (공식 JSON Manual 스키마)
├── expander.py    # 표준층 → 자연층 전개 (+다이어프램 RIGD, 조합) → Operation 목록
├── client.py      # MidasClient(REST 전송) / RecordingClient(드라이런)
└── taiwan.py      # 대만 규격 상수·팩토리 (라이브 검증: CNS560(RC)/CNS(S), TWD-USD112)

examples/build_sample_building.py   # 그리드+다중표준층 대만 RC 빌딩(기단부+기준층+지붕)
tests/                              # pytest (검증 + 전개기 + M1.5)
```

## 설치 / 테스트

```bash
pip install -r requirements.txt   # requests, pytest
python -m pytest tests/ -q
```

## 사용 예

```python
from midas_story import (
    Building, TypicalFloor, Section, Thickness, LoadCase,
    Grid, build_frame, taiwan_strength_combos, taiwan,
    Expander, MidasClient, M_TONF, TYPICAL,
)

# 1) 통경선 그리드 → 기둥·보·슬래브 자동 생성
grid = Grid(x_spans=[6, 6, 6], y_spans=[5, 5])          # X:1~4, Y:A~C
elements = build_frame(grid, material_id=1, column_section_id=1,
                       beam_section_id=2, slab_thickness_id=1)

lcs = [LoadCase("D", "D", self_weight=True), LoadCase("L", "L")]
building = Building(
    materials=[taiwan.concrete(id=1, fc=280)],          # CNS560(RC) C280
    sections=[Section(1, "C700", 0.7, 0.7), Section(2, "G", 0.7, 0.4)],
    thicknesses=[Thickness(1, "S150", 0.15)],
    load_cases=lcs,
    load_combos=taiwan_strength_combos(lcs),            # TWD-USD112
    typical_floors=[TypicalFloor(
        id="TYP", role=TYPICAL, mapped_stories=list(range(4, 29)),
        story_height=3.2, elements=elements, diaphragm=True,  # 강성 다이어프램
    )],
)

ops = Expander(building, units=M_TONF).build()   # 검증 + 전개 (네트워크 없음)

# 전송 (MIDAS Gen NX 실행 + MAPI-Key 필요)
# MidasClient(mapi_key="...").run(ops)
```

## 드라이런 / 전송

```bash
cd examples
python build_sample_building.py          # 드라이런: 생성될 연산 미리보기
python build_sample_building.py --kn     # 단위 M·KN
set MIDAS_MAPI_KEY=...                    # (Windows) 키 설정
python build_sample_building.py --send    # 실제 MIDAS Gen NX 전송
```

## 부재 전개 규약

| 입력(평면) | 전개 | MIDAS 요소 |
|---|---|---|
| `COLUMN` 1점 | 아래레벨↔바닥레벨 수직 | `BEAM` |
| `BEAM` 2점 | 바닥레벨 평면 | `BEAM` |
| `WALL` 2점 | 아래레벨↔바닥레벨 4절점 | `WALL` |
| `SLAB` 3~4점 | 바닥레벨 평면 | `PLATE` |

> 좌표 dedup 허용오차 1e-6 m (= 0.001 mm, PDF §3.1). 동일 좌표 노드는 자동 공유.

## 로드맵

- **M1** ✅ 모델 생성 (표준층 → 자연층 전개)
- **M1.5** ✅ 작성 강화 — 그리드, 다중 표준층/특수층, 다이어프램, 대만 하중조합
- **M2** 표준층 자동 판정 (기존 모델/IFC import → 제외필터·기하·하중 일치)
- **M3** 해석 결과 회수 + 구간별 배근 (TWD-USD112)
- **M4** 도면 도명 자동화

자세한 내용은 [DESIGN.md](DESIGN.md) 참고.
