"""그리드(통경선) 시스템 + 그리드 기반 프레임 자동 생성.

엔지니어는 좌표가 아니라 통경선 교점(예: X열 "2", Y열 "B")으로 사고한다.
Grid 는 스팬(베이 폭) 목록으로 정의하고, 라벨(X:1,2,3… / Y:A,B,C…)로 교점을 조회한다.
build_frame() 은 그리드로부터 기둥·보·슬래브를 한 번에 생성해 표준층 작성을 가속한다.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .domain import Element, COLUMN, BEAM, SLAB


def _alpha_labels(n: int) -> list:
    # A, B, ..., Z, AA, AB ...
    out = []
    for i in range(n):
        s, k = "", i
        while True:
            s = chr(ord("A") + k % 26) + s
            k = k // 26 - 1
            if k < 0:
                break
        out.append(s)
    return out


@dataclass
class Grid:
    """통경선 그리드.

    x_spans: X방향 베이 폭 목록 (예: [6, 6, 6] → 4개 통경선)
    y_spans: Y방향 베이 폭 목록
    x_labels: 기본 "1","2",...  / y_labels: 기본 "A","B",...
    """

    x_spans: list
    y_spans: list
    x_labels: list = None
    y_labels: list = None
    x_origin: float = 0.0
    y_origin: float = 0.0
    _xc: list = field(default=None, repr=False)
    _yc: list = field(default=None, repr=False)

    def __post_init__(self) -> None:
        self._xc = _cumulative(self.x_origin, self.x_spans)
        self._yc = _cumulative(self.y_origin, self.y_spans)
        if self.x_labels is None:
            self.x_labels = [str(i + 1) for i in range(len(self._xc))]
        if self.y_labels is None:
            self.y_labels = _alpha_labels(len(self._yc))
        if len(self.x_labels) != len(self._xc):
            raise ValueError("x_labels 개수가 통경선 수와 다름")
        if len(self.y_labels) != len(self._yc):
            raise ValueError("y_labels 개수가 통경선 수와 다름")

    # ── 조회 ─────────────────────────────────────────────
    def xy(self, xlabel, ylabel) -> tuple:
        """통경선 교점 좌표 (x, y)."""
        try:
            ix = self.x_labels.index(str(xlabel))
            iy = self.y_labels.index(str(ylabel))
        except ValueError:
            raise KeyError(f"통경선 교점 없음: {xlabel}-{ylabel}")
        return (self._xc[ix], self._yc[iy])

    def ref(self, token) -> tuple:
        """문자열 "2-B" 또는 튜플 ("2","B") 로 교점 좌표 조회."""
        if isinstance(token, (tuple, list)):
            return self.xy(token[0], token[1])
        xl, yl = str(token).split("-")
        return self.xy(xl, yl)

    @property
    def intersections(self) -> list:
        """모든 교점 (xlabel, ylabel, x, y)."""
        out = []
        for xl, x in zip(self.x_labels, self._xc):
            for yl, y in zip(self.y_labels, self._yc):
                out.append((xl, yl, x, y))
        return out

    @property
    def width(self) -> float:
        return self._xc[-1] - self._xc[0]

    @property
    def depth(self) -> float:
        return self._yc[-1] - self._yc[0]


def _cumulative(origin: float, spans: list) -> list:
    coords = [origin]
    for s in spans:
        coords.append(coords[-1] + s)
    return coords


def build_frame(grid: Grid, material_id: int, column_section_id: int,
                beam_section_id: int, slab_thickness_id: int | None = None,
                columns: bool = True, beams: bool = True,
                slabs: bool = True) -> list:
    """그리드로부터 표준층 부재(기둥·보·슬래브)를 자동 생성.

    - 기둥: 모든 통경선 교점에 1개
    - 보  : 인접 교점을 잇는 X·Y 방향 격자선마다 1개
    - 슬래브: 베이(사각 패널)마다 1개 (slab_thickness_id 필요)
    """
    elems: list = []
    xc, yc = grid._xc, grid._yc
    xl, yl = grid.x_labels, grid.y_labels

    if columns:
        for x in xc:
            for y in yc:
                elems.append(Element(kind=COLUMN, material_id=material_id,
                                     section_id=column_section_id,
                                     points=[(x, y)], tag="C"))
    if beams:
        # X방향 보 (각 Y선에서 인접 X교점 연결)
        for y in yc:
            for i in range(len(xc) - 1):
                elems.append(Element(kind=BEAM, material_id=material_id,
                                     section_id=beam_section_id,
                                     points=[(xc[i], y), (xc[i + 1], y)], tag="GX"))
        # Y방향 보
        for x in xc:
            for j in range(len(yc) - 1):
                elems.append(Element(kind=BEAM, material_id=material_id,
                                     section_id=beam_section_id,
                                     points=[(x, yc[j]), (x, yc[j + 1])], tag="GY"))
    if slabs and slab_thickness_id is not None:
        for i in range(len(xc) - 1):
            for j in range(len(yc) - 1):
                panel = [(xc[i], yc[j]), (xc[i + 1], yc[j]),
                         (xc[i + 1], yc[j + 1]), (xc[i], yc[j + 1])]
                elems.append(Element(kind=SLAB, material_id=material_id,
                                     thickness_id=slab_thickness_id,
                                     points=panel, tag="S"))
    return elems
