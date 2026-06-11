#!/usr/bin/env python3
"""예제: 그리드 + 다중 표준층 기반 대만 RC 빌딩을 MIDAS Gen NX로 전개.

구성 (그리드 3×2 베이, 통경선 X:1~4 / Y:A~C)
  - 기단부(PODIUM)   1~2층  : 상업 바닥하중
  - 기준층(TYPICAL)  3~12층 : 주거 바닥하중
  - 지붕(ROOF)       13층    : 지붕 바닥하중
각 층 그리드에서 기둥·보·슬래브 자동 생성(build_frame) + 강성 다이어프램 + 대만 하중조합.

실행:
  python build_sample_building.py            # 드라이런
  python build_sample_building.py --kn       # 단위 M·KN
  set MIDAS_MAPI_KEY=...                      # (Windows)
  python build_sample_building.py --send      # 실제 전송
  python build_sample_building.py --send --save "E:\\path\\model.mgb"
"""
from __future__ import annotations

import sys
import os

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midas_story import (  # noqa: E402
    Building, TypicalFloor, Section, Thickness, LoadCase, FloorLoadType, FloorLoadArea,
    Grid, build_frame, taiwan_strength_combos, taiwan,
    Expander, RecordingClient, MidasClient, M_TONF, M_KN,
    PODIUM, TYPICAL, ROOF,
)


def make_building() -> Building:
    grid = Grid(x_spans=[6, 6, 6], y_spans=[5, 5])   # X:1~4, Y:A~C
    boundary = [grid.xy("1", "A"), grid.xy("4", "A"),
                grid.xy("4", "C"), grid.xy("1", "C")]  # 외곽 폴리곤(바닥하중용)

    # 단면/두께
    sections = [Section(id=1, name="C700", h=0.7, b=0.7),     # 기둥
                Section(id=2, name="G400x700", h=0.7, b=0.4)]  # 보
    thicks = [Thickness(id=1, name="SLAB150", t=0.15)]

    # 바닥하중 타입 (PDF §3.2: 용도별)
    flt = [
        FloorLoadType(id=1, name="Commercial", items=[("D", 2.0), ("L", 5.0)]),   # 기단부
        FloorLoadType(id=2, name="Residential", items=[("D", 1.5), ("L", 2.0)]),  # 기준층
        FloorLoadType(id=3, name="Roof", items=[("D", 2.5), ("LR", 1.0)]),        # 지붕
    ]

    def frame(area_type):
        els = build_frame(grid, material_id=1, column_section_id=1,
                          beam_section_id=2, slab_thickness_id=1)
        fl = [FloorLoadArea(type_name=area_type, points=boundary, dist_type=2)]
        return els, fl

    e_pod, l_pod = frame("Commercial")
    e_typ, l_typ = frame("Residential")
    e_rof, l_rof = frame("Roof")

    tfs = [
        TypicalFloor(id="PODIUM", role=PODIUM, mapped_stories=[1, 2],
                     story_height=4.5, elements=e_pod, floor_loads=l_pod),
        TypicalFloor(id="TYP", role=TYPICAL, mapped_stories=list(range(3, 13)),
                     story_height=3.2, elements=e_typ, floor_loads=l_typ),
        TypicalFloor(id="ROOF", role=ROOF, mapped_stories=[13],
                     story_height=3.2, elements=e_rof, floor_loads=l_rof),
    ]

    load_cases = [
        LoadCase(name="D", type="D", desc="Dead", self_weight=True),
        LoadCase(name="L", type="L", desc="Live"),
        LoadCase(name="LR", type="LR", desc="Roof Live"),
    ]

    return Building(
        name="Taiwan RC Building (grid+multi-floor)",
        base_level=0.0,
        materials=[taiwan.concrete(id=1, fc=280)],   # CNS560(RC) C280
        sections=sections,
        thicknesses=thicks,
        load_cases=load_cases,
        floor_load_types=flt,
        load_combos=taiwan_strength_combos(load_cases),  # TWD-USD112
        typical_floors=tfs,
        base_constraint="1111111",
    )


def main() -> None:
    send = "--send" in sys.argv
    units = M_KN if "--kn" in sys.argv else M_TONF
    save_path = None
    if "--save" in sys.argv:
        i = sys.argv.index("--save")
        if i + 1 < len(sys.argv):
            save_path = sys.argv[i + 1]

    building = make_building()
    exp = Expander(building, units=units, save_path=save_path)
    ops = exp.build()

    print(f"빌딩 전개 요약 (단위 {units.label}):")
    for tf in exp.summary()["typical_floors"]:
        print(f"  - {tf['id']:7} 층 {tf['stories'][0]}~{tf['stories'][-1]} "
              f"({len(tf['stories'])}개) 층고 {tf['height']} 부재 {tf['elements']}종")
    print(f"\n생성 연산 {len(ops)}개:")
    for op in ops:
        n = f"  (Assign {len(op.body['Assign'])})" if op.body and "Assign" in op.body else ""
        print(f"  {op.method:5} {op.command}{n}")

    if send:
        print("\n>>> MIDAS Gen NX 로 전송합니다...")
        responses = MidasClient().run(ops)
        ok = sum(1 for r in responses if r["status_code"] < 400)
        print(f"완료: {ok}/{len(responses)} 성공")
    else:
        RecordingClient().run(ops)
        print("\n(드라이런) 실제 전송은 --send 옵션.")


if __name__ == "__main__":
    main()
