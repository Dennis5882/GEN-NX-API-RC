"""M1.5 테스트 — 그리드, 프레임 자동생성, 다이어프램, 하중조합, 다중 표준층."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midas_story import (  # noqa: E402
    Building, TypicalFloor, Section, Thickness, LoadCase, FloorLoadType, FloorLoadArea,
    Grid, build_frame, taiwan_strength_combos,
    Expander, M_TONF, PODIUM, TYPICAL, ROOF, COLUMN, BEAM, SLAB,
)


# ── 그리드 ────────────────────────────────────────────────
def test_grid_labels_and_coords():
    g = Grid(x_spans=[6, 6, 6], y_spans=[5, 5])
    assert g.x_labels == ["1", "2", "3", "4"]
    assert g.y_labels == ["A", "B", "C"]
    assert g.xy("1", "A") == (0.0, 0.0)
    assert g.xy("4", "C") == (18.0, 10.0)
    assert g.ref("2-B") == (6.0, 5.0)
    assert g.width == 18.0 and g.depth == 10.0


def test_build_frame_counts():
    g = Grid(x_spans=[6, 6, 6], y_spans=[5, 5])   # 4x3 = 12 교점
    els = build_frame(g, material_id=1, column_section_id=1,
                      beam_section_id=2, slab_thickness_id=1)
    cols = [e for e in els if e.kind == COLUMN]
    beams = [e for e in els if e.kind == BEAM]
    slabs = [e for e in els if e.kind == SLAB]
    assert len(cols) == 12               # 4*3 교점
    # X보: 3*3=9, Y보: 4*2=8 → 17
    assert len(beams) == 17
    assert len(slabs) == 6               # 3*2 베이


def _grid_building(diaphragm=True):
    g = Grid(x_spans=[6, 6], y_spans=[5])
    els = build_frame(g, 1, 1, 2, 1)
    lcs = [LoadCase("D", "D", self_weight=True), LoadCase("L", "L"), LoadCase("LR", "LR")]
    return Building(
        materials=[__import__("midas_story").taiwan.concrete(1, 280)],
        sections=[Section(1, "C", 0.6, 0.6), Section(2, "G", 0.6, 0.4)],
        thicknesses=[Thickness(1, "S", 0.15)],
        load_cases=lcs,
        load_combos=taiwan_strength_combos(lcs),
        typical_floors=[TypicalFloor("TYP", [1, 2, 3], 3.0, els, diaphragm=diaphragm)],
    )


# ── 다이어프램 ────────────────────────────────────────────
def _by_cmd(ops):
    d = {}
    for op in ops:
        d.setdefault(op.command, []).append(op)
    return d


def test_diaphragm_rigd_per_floor():
    ops = _by_cmd(Expander(_grid_building(diaphragm=True)).build())
    assert "/db/rigd" in ops
    rigd = ops["/db/rigd"][0].body["Assign"]
    # 3개 층 → 마스터 3개. 각 항목 DOF=110001
    assert len(rigd) == 3
    for master, data in rigd.items():
        assert data["ITEMS"][0]["DOF"] == 110001
        assert len(data["ITEMS"][0]["S_NODE"]) >= 1


def test_diaphragm_off():
    ops = _by_cmd(Expander(_grid_building(diaphragm=False)).build())
    assert "/db/rigd" not in ops


# ── 하중조합 ──────────────────────────────────────────────
def test_taiwan_combos_generated():
    lcs = [LoadCase("D", "D"), LoadCase("L", "L"), LoadCase("LR", "LR")]
    combos = taiwan_strength_combos(lcs)
    # 이름은 20자 제한 → 짧은 이름, 수식은 desc
    assert all(len(c.name) <= 20 for c in combos)
    descs = [c.desc for c in combos]
    assert "1.4D" in descs
    assert any("1.2D+1.6L" in d for d in descs)
    # 1.4D 조합은 D만 포함
    c14 = next(c for c in combos if c.desc == "1.4D")
    assert c14.terms == [("D", 1.4)]


def test_combos_emitted_as_lcom_gen():
    ops = _by_cmd(Expander(_grid_building()).build())
    assert "/db/lcom-gen" in ops
    assert len(ops["/db/lcom-gen"][0].body["Assign"]) >= 2


# ── 다중 표준층 ───────────────────────────────────────────
def test_multi_typical_floor_levels_and_roles():
    g = Grid(x_spans=[6], y_spans=[5])
    els = build_frame(g, 1, 1, 2, 1)
    lcs = [LoadCase("D", "D", self_weight=True)]
    b = Building(
        materials=[__import__("midas_story").taiwan.concrete(1, 280)],
        sections=[Section(1, "C", 0.6, 0.6), Section(2, "G", 0.6, 0.4)],
        thicknesses=[Thickness(1, "S", 0.15)],
        load_cases=lcs,
        typical_floors=[
            TypicalFloor("POD", [1, 2], 4.5, els, role=PODIUM),
            TypicalFloor("TYP", [3, 4, 5], 3.2, els, role=TYPICAL),
            TypicalFloor("ROOF", [6], 3.2, els, role=ROOF),
        ],
    )
    exp = Expander(b)
    levels = exp._levels()
    # 기단부 2개층(4.5) 후 기준층 시작 레벨 = 9.0
    assert levels[2][1] == 9.0
    assert levels[3][0] == 9.0
    ops = exp.build()  # 검증 통과(disjoint + 연속)
    assert ops[0].command == "/doc/new"
