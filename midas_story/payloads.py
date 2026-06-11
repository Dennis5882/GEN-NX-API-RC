"""MIDAS Gen NX `/db/*` Assign 바디 빌더 (공식 JSON Manual 스키마 기반).

각 함수는 순수 함수로, dict 페이로드를 반환한다(네트워크 없음).
"""
from __future__ import annotations

from .units import UnitSystem


def unit_body(units: UnitSystem) -> dict:
    return {"Assign": {"1": {"DIST": units.dist, "FORCE": units.force}}}


def matl_body(materials: list) -> dict:
    return {
        "Assign": {
            str(m.id): {
                "TYPE": m.type,
                "NAME": m.name,
                "PARAM": [{"P_TYPE": 1, "STANDARD": m.standard, "DB": m.db_name()}],
            }
            for m in materials
        }
    }


def sect_body(sections: list) -> dict:
    return {
        "Assign": {
            str(s.id): {
                "SECTTYPE": "DBUSER",
                "SECT_NAME": s.name,
                "SECT_BEFORE": {
                    "USE_SHEAR_DEFORM": True,
                    "SHAPE": s.shape,
                    "DATATYPE": 2,
                    "SECT_I": {"vSIZE": [s.h, s.b]},
                },
            }
            for s in sections
        }
    }


def thik_body(thicknesses: list) -> dict:
    return {
        "Assign": {
            str(t.id): {
                "NAME": t.name,
                "TYPE": "VALUE",
                "bINOUT": False,
                "T_IN": t.t,
                "T_OUT": 0,
                "O_VALUE": 0,
            }
            for t in thicknesses
        }
    }


def stld_body(load_cases: list) -> dict:
    return {
        "Assign": {
            str(i + 1): {"NAME": lc.name, "TYPE": lc.type, "DESC": lc.desc}
            for i, lc in enumerate(load_cases)
        }
    }


def node_body(nodes: dict) -> dict:
    """nodes: {node_id: (x, y, z)}"""
    return {
        "Assign": {
            str(nid): {"X": x, "Y": y, "Z": z} for nid, (x, y, z) in nodes.items()
        }
    }


def elem_body(elements: dict) -> dict:
    """elements: {elem_id: dict(이미 구성된 ELEM 필드)}"""
    return {"Assign": {str(eid): data for eid, data in elements.items()}}


def bodf_body(load_case_name: str, item_id: int = 1, fv=(0, 0, -1)) -> dict:
    return {"Assign": {str(item_id): {"LCNAME": load_case_name, "FV": list(fv)}}}


def fbld_body(floor_load_types: list) -> dict:
    return {
        "Assign": {
            str(f.id): {
                "NAME": f.name,
                "DESC": "",
                "ITEM": [
                    {
                        "LCNAME": lc_name,
                        "FLOOR_LOAD": value,
                        "OPT_SUB_BEAM_WEIGHT": f.sub_beam_weight,
                    }
                    for lc_name, value in f.items
                ],
            }
            for f in floor_load_types
        }
    }


def fbla_body(areas: dict) -> dict:
    """areas: {assign_id: dict(FBLA 필드)}"""
    return {"Assign": {str(aid): data for aid, data in areas.items()}}


def cons_body(node_ids: list, constraint: str) -> dict:
    return {
        "Assign": {
            str(nid): {"ITEMS": [{"ID": 1, "CONSTRAINT": constraint}]}
            for nid in node_ids
        }
    }


def rigd_body(links: list, dof: int = 110001) -> dict:
    """강성 다이어프램(Rigid Link). links: [(master_node, [slave_nodes]), ...]
    dof 110001 = Dx·Dy·Rz (면내 강체 = 층 다이어프램)."""
    out = {}
    for i, (master, slaves) in enumerate(links, start=1):
        out[str(master)] = {"ITEMS": [{"ID": i, "GROUP_NAME": "", "DOF": dof, "S_NODE": list(slaves)}]}
    return {"Assign": out}


def lcom_gen_body(combos: list) -> dict:
    """combos: list[LoadCombo]"""
    return {
        "Assign": {
            str(i + 1): {
                "NAME": cb.name,
                "ACTIVE": cb.active,
                "iTYPE": cb.itype,
                "DESC": cb.desc,
                "vCOMB": [
                    {"ANAL": "ST", "LCNAME": lc, "FACTOR": f} for lc, f in cb.terms
                ],
            }
            for i, cb in enumerate(combos)
        }
    }
