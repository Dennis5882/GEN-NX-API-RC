"""도메인 모델 — 표준층(Typical Floor) 기반 빌딩 정의.

MIDAS 비종속 순수 데이터 모델. PDF §2 데이터 구조를 따른다.

좌표 규약
  - Element.points 는 **평면(X-Y) 상대좌표** 목록. Z(레벨)는 전개 시 부여된다.
  - 단위는 Building 전개 시 선택한 UnitSystem 을 따른다(길이는 dist 단위).

부재 전개 규약(Expander 와 공유)
  - COLUMN : 평면 1점. 해당 층 바닥레벨과 아래 레벨을 잇는 수직 BEAM 요소.
  - BEAM   : 평면 2점. 해당 층 바닥레벨 평면에 놓인 수평 BEAM 요소.
  - WALL   : 평면 2점. 아래 레벨↔바닥레벨을 잇는 4절점 WALL 요소.
  - SLAB   : 평면 3~4점. 해당 층 바닥레벨 평면의 PLATE 요소.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# 부재 종류
COLUMN = "COLUMN"
BEAM = "BEAM"
WALL = "WALL"
SLAB = "SLAB"

Point2D = "tuple[float, float]"


@dataclass
class Material:
    """재료 (RC 등). `/db/matl` 로 1회 등록 후 부재가 id 참조."""

    id: int
    name: str
    type: str = "CONC"
    standard: str = "CNS560(RC)"  # 대만 콘크리트 규격 (라이브 검증). taiwan.concrete() 권장
    db: str = ""                   # 비우면 name 사용 (예: "C280")

    def db_name(self) -> str:
        return self.db or self.name


@dataclass
class Section:
    """기둥/보 단면 (사각 솔리드). `/db/sect` SECT_I.vSIZE=[h, b]."""

    id: int
    name: str
    h: float
    b: float
    shape: str = "SB"  # Solid Rectangle


@dataclass
class Thickness:
    """판/벽 두께. `/db/thik`. 슬래브·벽 요소의 SECT 필드가 이 id를 참조."""

    id: int
    name: str
    t: float


@dataclass
class LoadCase:
    """정적 하중 케이스. `/db/stld`. self_weight=True 이면 자중(BODF) 자동 부여."""

    name: str
    type: str = "USER"   # D/L/LR/S/W/E ... (공식 STLD 타입)
    desc: str = ""
    self_weight: bool = False


@dataclass
class FloorLoadType:
    """바닥하중 타입 정의. `/db/fbld`.

    items: [(load_case_name, load_value), ...]  (예: [("D",1.5), ("L",2.0)])
    PDF §3.2 의 "주거 2.0 / 설비실 7.0" 가 각각 하나의 FloorLoadType.
    """

    id: int
    name: str
    items: list[tuple[str, float]] = field(default_factory=list)
    sub_beam_weight: bool = True


@dataclass
class FloorLoadArea:
    """바닥하중 면 지정. `/db/fbla`. 표준층 내에서 평면 폴리곤으로 지정하면
    전개 시 mapped_stories 각 층의 해당 레벨에 적용된다."""

    type_name: str
    points: list  # list[Point2D]
    dist_type: int = 1   # 1=One Way · 2=Two Way · 3=Polygon-Centroid · 4=Polygon-Length
    direction: str = "GZ"
    group: str = ""


@dataclass
class Element:
    """표준층 평면의 구조부재 (상대좌표 + 단면/두께 참조)."""

    kind: str               # COLUMN / BEAM / WALL / SLAB
    material_id: int
    points: list            # list[Point2D] — 평면 좌표
    tag: str = ""
    section_id: int | None = None     # COLUMN/BEAM
    thickness_id: int | None = None   # WALL/SLAB
    angle: float = 0.0


@dataclass
class LoadCombo:
    """하중조합. `/db/lcom-gen`. terms: [(load_case_name, factor), ...]"""

    name: str
    terms: list                  # list[tuple[str, float]]
    active: str = "ACTIVE"
    itype: int = 0               # 0 = Add(선형합)
    desc: str = ""


# 표준층 역할 (PDF §3.3 제외/특수층 분류). 정보 태그 + 향후 자동판정 연계.
TYPICAL = "TYPICAL"      # 일반 표준층
PODIUM = "PODIUM"        # 裙房 (기단부)
TRANSFER = "TRANSFER"    # 전이층
ROOF = "ROOF"            # 지붕/피난층
BASEMENT = "BASEMENT"    # 지하/기초


@dataclass
class TypicalFloor:
    """표준층 — 자연층 N개로 전개되는 추상 단위 (PDF §2).

    role : 층 성격 태그(TYPICAL/PODIUM/TRANSFER/ROOF/BASEMENT) — 특수층은 보통
           단일 자연층이며 표준 귀납에서 제외 대상(PDF §3.3).
    diaphragm : True 면 각 자연층 평면 절점에 강성 다이어프램(RIGD, DOF 110001) 부여.
    """

    id: str
    mapped_stories: list  # list[int] — 연속(또는 동일 위상)
    story_height: float
    elements: list = field(default_factory=list)        # list[Element]
    floor_loads: list = field(default_factory=list)     # list[FloorLoadArea]
    role: str = TYPICAL
    diaphragm: bool = True


@dataclass
class Building:
    """전체 빌딩 — 전개기 입력."""

    name: str = "Story Model"
    base_level: float = 0.0
    materials: list = field(default_factory=list)         # list[Material]
    sections: list = field(default_factory=list)          # list[Section]
    thicknesses: list = field(default_factory=list)       # list[Thickness]
    load_cases: list = field(default_factory=list)        # list[LoadCase]
    floor_load_types: list = field(default_factory=list)  # list[FloorLoadType]
    load_combos: list = field(default_factory=list)       # list[LoadCombo]
    typical_floors: list = field(default_factory=list)    # list[TypicalFloor]
    # 최하단(base_level) 노드에 부여할 지지 구속 (Dx Dy Dz Rx Ry Rz +)
    base_constraint: str = "1111111"

    # ── 조회 헬퍼 ───────────────────────────────────────────────
    def all_stories(self) -> list:
        out: list = []
        for tf in self.typical_floors:
            out.extend(tf.mapped_stories)
        return sorted(out)

    def typical_floor_of(self, story: int):
        for tf in self.typical_floors:
            if story in tf.mapped_stories:
                return tf
        return None
