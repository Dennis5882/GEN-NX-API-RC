"""전개기 (Expander) — 표준층 → 자연층 전개 → MIDAS Gen NX 연산 목록 생성.

핵심: "기하 동일, 내력 상이"(PDF §4). 표준층 1개를 mapped_stories 만큼 Z방향으로
복제하여 노드/요소를 생성한다. 단면·재료·두께·바닥하중타입은 1회 등록 후 참조한다.

build() 는 순수 함수(네트워크 없음): Operation 목록을 반환한다.
실제 전송은 client.MidasClient.run(operations) 가 담당한다.

레벨 규약
  stories 를 번호 오름차순 정렬 후, 각 층의 typical_floor.story_height 를 누적.
    z_below[s] = (s 아래까지의 누적 높이) + base_level
    z_floor[s] = z_below[s] + height[s]      (= 층 s 의 바닥/상단 레벨)
  수평재(BEAM/SLAB) → z_floor, 수직재(COLUMN/WALL) → z_below ↔ z_floor.
  z == base_level 노드 전체에 base_constraint 지지 부여.
"""
from __future__ import annotations

from dataclasses import dataclass

from .domain import Building, COLUMN, BEAM, WALL, SLAB
from .units import UnitSystem, M_TONF
from .validation import validate
from . import payloads as P

# 노드 좌표 dedup 허용오차: 1e-6 m = 0.001 mm (PDF §3.1 Tolerance)
_COORD_NDIGITS = 6


@dataclass
class Operation:
    """단일 API 호출 단위."""

    method: str   # POST / PUT / GET / DELETE
    command: str  # 예: "/db/node"
    body: dict | None = None

    def as_tuple(self):
        return (self.method, self.command, self.body)


class _NodeRegistry:
    """좌표 → 노드 id. 동일 좌표는 재사용(dedup)."""

    def __init__(self) -> None:
        self._map: dict = {}
        self.nodes: dict = {}  # id -> (x, y, z)
        self._next = 1

    def get(self, x: float, y: float, z: float) -> int:
        key = (round(x, _COORD_NDIGITS), round(y, _COORD_NDIGITS), round(z, _COORD_NDIGITS))
        if key not in self._map:
            nid = self._next
            self._next += 1
            self._map[key] = nid
            self.nodes[nid] = key
        return self._map[key]


class Expander:
    """Building → Operation 목록."""

    def __init__(self, building: Building, units: UnitSystem = M_TONF,
                 allow_noncontinuous: bool = False,
                 save_path: str | None = None) -> None:
        """save_path 가 주어지면 마지막에 `/doc/saveas` 연산을 추가한다.

        ⚠️ 기본값(None)은 저장하지 않는다. 새 문서에 대한 `/doc/save`/`saveas` 는
        Gen NX 에 모달 대화상자를 띄워 세션을 막을 수 있으므로, 모델은 라이브
        세션에 생성만 하고 저장은 사용자가 GUI 에서 하거나 명시적 경로로 요청한다.
        """
        self.building = building
        self.units = units
        self.allow_noncontinuous = allow_noncontinuous
        self.save_path = save_path

    # ── 레벨 계산 ────────────────────────────────────────────────
    def _levels(self) -> dict:
        """{story: (z_below, z_floor)}"""
        b = self.building
        height = {}
        for tf in b.typical_floors:
            for s in tf.mapped_stories:
                height[s] = tf.story_height
        levels = {}
        prev_top = b.base_level
        for s in sorted(height):
            z_below = prev_top
            z_floor = z_below + height[s]
            levels[s] = (z_below, z_floor)
            prev_top = z_floor
        return levels

    # ── 전개 ────────────────────────────────────────────────────
    def build(self) -> list:
        """검증 → 전개 → Operation 목록 반환."""
        b = self.building
        validate(b, allow_noncontinuous=self.allow_noncontinuous)

        levels = self._levels()
        reg = _NodeRegistry()
        elements: dict = {}      # elem_id -> ELEM 필드
        elem_id = 1
        wall_id = 1
        fbla_areas: dict = {}    # assign_id -> FBLA 필드
        fbla_id = 1

        for tf in b.typical_floors:
            for story in sorted(tf.mapped_stories):
                z_below, z_floor = levels[story]
                # 부재 전개
                for el in tf.elements:
                    if el.kind == COLUMN:
                        (x, y) = el.points[0]
                        n1 = reg.get(x, y, z_below)
                        n2 = reg.get(x, y, z_floor)
                        elements[elem_id] = {
                            "TYPE": "BEAM", "MATL": el.material_id,
                            "SECT": el.section_id, "NODE": [n1, n2], "ANGLE": el.angle,
                        }
                        elem_id += 1
                    elif el.kind == BEAM:
                        (x1, y1), (x2, y2) = el.points
                        n1 = reg.get(x1, y1, z_floor)
                        n2 = reg.get(x2, y2, z_floor)
                        elements[elem_id] = {
                            "TYPE": "BEAM", "MATL": el.material_id,
                            "SECT": el.section_id, "NODE": [n1, n2], "ANGLE": el.angle,
                        }
                        elem_id += 1
                    elif el.kind == WALL:
                        (x1, y1), (x2, y2) = el.points
                        nb1 = reg.get(x1, y1, z_below)
                        nb2 = reg.get(x2, y2, z_below)
                        nt2 = reg.get(x2, y2, z_floor)
                        nt1 = reg.get(x1, y1, z_floor)
                        elements[elem_id] = {
                            "TYPE": "WALL", "MATL": el.material_id,
                            "SECT": el.thickness_id, "NODE": [nb1, nb2, nt2, nt1],
                            "STYPE": 2, "WALL": wall_id, "W_CON": 0, "W_TYPE": 0,
                        }
                        elem_id += 1
                        wall_id += 1
                    elif el.kind == SLAB:
                        nodes = [reg.get(x, y, z_floor) for (x, y) in el.points]
                        elements[elem_id] = {
                            "TYPE": "PLATE", "MATL": el.material_id,
                            "SECT": el.thickness_id, "NODE": nodes,
                            "STYPE": 1, "ANGLE": el.angle,
                        }
                        elem_id += 1

                # 바닥하중 면 (mapped_stories 각 층 레벨에 적용)
                for fla in tf.floor_loads:
                    node_ids = [reg.get(x, y, z_floor) for (x, y) in fla.points]
                    fbla_areas[fbla_id] = {
                        "FLOOR_LOAD_TYPE_NAME": fla.type_name,
                        "FLOOR_DIST_TYPE": fla.dist_type,
                        "DIR": fla.direction,
                        "NODES": node_ids,
                        "GROUP_NAME": fla.group,
                    }
                    fbla_id += 1

        # 최하단 지지
        base_nodes = [
            nid for nid, (x, y, z) in reg.nodes.items()
            if round(z, _COORD_NDIGITS) == round(b.base_level, _COORD_NDIGITS)
        ]

        # 층 다이어프램 (RIGD): 자연층 평면 절점을 마스터에 강체연결(DOF 110001)
        want_diaphragm: dict = {}
        for tf in b.typical_floors:
            for s in tf.mapped_stories:
                zf = round(levels[s][1], _COORD_NDIGITS)
                want_diaphragm[zf] = tf.diaphragm
        nodes_by_z: dict = {}
        for nid, (x, y, z) in reg.nodes.items():
            nodes_by_z.setdefault(round(z, _COORD_NDIGITS), []).append(nid)
        diaphragm_links: list = []
        for zf, want in want_diaphragm.items():
            if not want:
                continue
            ns = sorted(nodes_by_z.get(zf, []))
            if len(ns) >= 2:
                diaphragm_links.append((ns[0], ns[1:]))

        # ── Operation 순서 조립 ─────────────────────────────────
        ops: list = [Operation("POST", "/doc/new", {})]
        ops.append(Operation("PUT", "/db/unit", P.unit_body(self.units)))
        if b.materials:
            ops.append(Operation("POST", "/db/matl", P.matl_body(b.materials)))
        if b.sections:
            ops.append(Operation("POST", "/db/sect", P.sect_body(b.sections)))
        if b.thicknesses:
            ops.append(Operation("POST", "/db/thik", P.thik_body(b.thicknesses)))
        if b.load_cases:
            ops.append(Operation("POST", "/db/stld", P.stld_body(b.load_cases)))
        if b.floor_load_types:
            ops.append(Operation("POST", "/db/fbld", P.fbld_body(b.floor_load_types)))
        # 좌표를 (x,y,z) 튜플로 변환
        node_xyz = {nid: (k[0], k[1], k[2]) for nid, k in reg.nodes.items()}
        if node_xyz:
            ops.append(Operation("POST", "/db/node", P.node_body(node_xyz)))
        if elements:
            ops.append(Operation("POST", "/db/elem", P.elem_body(elements)))
        if diaphragm_links:
            ops.append(Operation("POST", "/db/rigd", P.rigd_body(diaphragm_links)))
        # 자중
        for i, lc in enumerate([lc for lc in b.load_cases if lc.self_weight], start=1):
            ops.append(Operation("POST", "/db/bodf", P.bodf_body(lc.name, item_id=i)))
        if fbla_areas:
            ops.append(Operation("POST", "/db/fbla", P.fbla_body(fbla_areas)))
        if base_nodes:
            ops.append(Operation("POST", "/db/cons", P.cons_body(base_nodes, b.base_constraint)))
        if b.load_combos:
            ops.append(Operation("POST", "/db/lcom-gen", P.lcom_gen_body(b.load_combos)))
        if self.save_path:
            ops.append(Operation("POST", "/doc/saveas", {"Argument": self.save_path}))
        return ops

    # ── 요약(디버그/리포트용) ────────────────────────────────────
    def summary(self) -> dict:
        levels = self._levels()
        return {
            "stories": sorted(levels),
            "levels": levels,
            "typical_floors": [
                {"id": tf.id, "stories": sorted(tf.mapped_stories),
                 "height": tf.story_height, "elements": len(tf.elements)}
                for tf in self.building.typical_floors
            ],
        }
