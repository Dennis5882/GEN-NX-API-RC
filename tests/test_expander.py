"""전개기 테스트."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midas_story import (  # noqa: E402
    Building, TypicalFloor, Element, Material, Section, Thickness,
    LoadCase, FloorLoadType, FloorLoadArea,
    COLUMN, BEAM, SLAB, WALL,
    Expander, RecordingClient, M_TONF, M_KN,
)


def _building(stories, height=3.0, base=0.0):
    corners = [(0.0, 0.0), (6.0, 0.0), (6.0, 5.0), (0.0, 5.0)]
    elements = [Element(kind=COLUMN, material_id=1, section_id=1, points=[(x, y)])
                for (x, y) in corners]
    elements.append(Element(kind=BEAM, material_id=1, section_id=2,
                            points=[(0.0, 0.0), (6.0, 0.0)]))
    elements.append(Element(kind=SLAB, material_id=1, thickness_id=1, points=corners))
    return Building(
        base_level=base,
        materials=[Material(id=1, name="C32")],
        sections=[Section(id=1, name="C600", h=0.6, b=0.6),
                  Section(id=2, name="G", h=0.6, b=0.4)],
        thicknesses=[Thickness(id=1, name="S150", t=0.15)],
        load_cases=[LoadCase(name="D", type="D", self_weight=True)],
        typical_floors=[TypicalFloor(id="TF", mapped_stories=stories,
                                     story_height=height, elements=elements)],
    )


def _ops_by_cmd(ops):
    out = {}
    for op in ops:
        out.setdefault(op.command, []).append(op)
    return out


def test_operation_order_and_lifecycle():
    ops = Expander(_building([1, 2, 3])).build()
    cmds = [op.command for op in ops]
    assert cmds[0] == "/doc/new"
    # 기본값: 저장 안 함 (라이브 세션에만 생성)
    assert "/doc/save" not in cmds
    assert "/doc/saveas" not in cmds
    # 의존 순서: matl/sect/thik/stld 가 elem 보다 앞
    assert cmds.index("/db/node") < cmds.index("/db/elem")
    assert cmds.index("/db/sect") < cmds.index("/db/elem")
    assert cmds.index("/db/stld") < cmds.index("/db/bodf")


def test_save_path_adds_saveas():
    ops = Expander(_building([1]), save_path=r"C:\tmp\m.mgb").build()
    last = ops[-1]
    assert last.command == "/doc/saveas"
    assert last.body["Argument"] == r"C:\tmp\m.mgb"


def test_levels_cumulative():
    exp = Expander(_building([1, 2, 3], height=3.0, base=0.0))
    levels = exp._levels()
    assert levels[1] == (0.0, 3.0)
    assert levels[2] == (3.0, 6.0)
    assert levels[3] == (6.0, 9.0)


def test_node_dedup_shared_between_floors():
    # 같은 평면 4기둥 -> 인접 층이 노드를 공유해야 함
    exp = Expander(_building([1, 2]))
    ops = _ops_by_cmd(exp.build())
    node_assign = ops["/db/node"][0].body["Assign"]
    # 2개 층, 4개 기둥 평면점 -> 레벨 0,3,6 의 4점씩 = 12 노드 (공유 덕분에 24가 아님)
    assert len(node_assign) == 12


def test_column_is_vertical_beam():
    exp = Expander(_building([1]))
    ops = _ops_by_cmd(exp.build())
    elems = ops["/db/elem"][0].body["Assign"]
    nodes = {nid: None for nid in []}
    node_assign = ops["/db/node"][0].body["Assign"]
    # 기둥 요소(첫 4개) 는 BEAM 타입이며 두 노드의 X,Y 동일, Z 다름
    col = list(elems.values())[0]
    assert col["TYPE"] == "BEAM"
    n1, n2 = col["NODE"]
    p1, p2 = node_assign[str(n1)], node_assign[str(n2)]
    assert (p1["X"], p1["Y"]) == (p2["X"], p2["Y"])
    assert p1["Z"] != p2["Z"]


def test_base_supports_generated():
    exp = Expander(_building([1, 2], base=0.0))
    ops = _ops_by_cmd(exp.build())
    cons = ops["/db/cons"][0].body["Assign"]
    node_assign = ops["/db/node"][0].body["Assign"]
    # 지지 노드는 모두 z==base_level(0)
    for nid in cons:
        assert node_assign[nid]["Z"] == 0.0
    # 4개 기둥 베이스
    assert len(cons) == 4


def test_units_option():
    ops_t = _ops_by_cmd(Expander(_building([1]), units=M_TONF).build())
    ops_k = _ops_by_cmd(Expander(_building([1]), units=M_KN).build())
    assert ops_t["/db/unit"][0].body["Assign"]["1"]["FORCE"] == "TONF"
    assert ops_k["/db/unit"][0].body["Assign"]["1"]["FORCE"] == "KN"


def test_floor_load_assigned_per_story():
    b = _building([1, 2, 3])
    b.floor_load_types = [FloorLoadType(id=1, name="R", items=[("D", 1.5)])]
    b.typical_floors[0].floor_loads = [
        FloorLoadArea(type_name="R", points=[(0, 0), (6, 0), (6, 5), (0, 5)])
    ]
    ops = _ops_by_cmd(Expander(b).build())
    fbla = ops["/db/fbla"][0].body["Assign"]
    assert len(fbla) == 3  # 3개 층 각각 1개 면


def test_recording_client_roundtrip():
    ops = Expander(_building([1, 2])).build()
    rec = RecordingClient()
    rec.run(ops)
    assert len(rec.operations) == len(ops)
    assert ("POST", "/doc/new") in rec.calls()
