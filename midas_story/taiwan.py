"""대만(Taiwan) RC/Frame 규격 상수 및 재료 팩토리.

모든 STANDARD/등급 문자열은 라이브 MIDAS Gen NX 로 검증됨(2026-06-11).

재료 규격 (MATL.PARAM.STANDARD)
  콘크리트 : "CNS560(RC)" / "CNS560-18(RC)"   등급 DB = "C"+fc'(kgf/cm²)
  강재     : "CNS(S)" / "CNS06(S)"            등급 DB = SS400/SN400/SM400/SM490/SN490

설계 코드 (배근/설계 — M3 에서 사용)
  RC 설계 : "TWD-USD112"
"""
from __future__ import annotations

from .domain import Material

# ── 재료 규격(STANDARD) ─────────────────────────────────────────
CNS560 = "CNS560(RC)"          # 콘크리트 (기본)
CNS560_18 = "CNS560-18(RC)"    # 콘크리트 (2018 개정판; 탄성계수 산정식 상이)
CNS_STEEL = "CNS(S)"           # 강재
CNS06_STEEL = "CNS06(S)"       # 강재 (2006)

# ── 라이브 검증된 유효 등급 ──────────────────────────────────────
CONCRETE_GRADES = [210, 245, 280, 315, 350, 420]   # fc' (kgf/cm²)
STEEL_GRADES = ["SS400", "SN400", "SM400", "SM490", "SN490"]

# ── 설계 코드 (M3 배근/설계 단계에서 사용) ───────────────────────
RC_DESIGN_CODE = "TWD-USD112"


def concrete(id: int, fc: int = 280, name: str | None = None,
             edition: str = CNS560) -> Material:
    """대만 RC 콘크리트 재료. fc' 는 kgf/cm² (예: 280).

    edition: CNS560 (기본) 또는 CNS560_18.
    """
    if fc not in CONCRETE_GRADES:
        raise ValueError(f"지원하지 않는 fc'={fc}. 가능: {CONCRETE_GRADES} (kgf/cm²)")
    db = f"C{fc}"
    return Material(id=id, name=name or db, type="CONC", standard=edition, db=db)


def steel(id: int, grade: str = "SN490", name: str | None = None,
          edition: str = CNS_STEEL) -> Material:
    """대만 강재 재료. grade 예: SN490, SS400.

    edition: CNS_STEEL (기본) 또는 CNS06_STEEL.
    """
    if grade not in STEEL_GRADES:
        raise ValueError(f"지원하지 않는 강종 '{grade}'. 가능: {STEEL_GRADES}")
    return Material(id=id, name=name or grade, type="STEEL", standard=edition, db=grade)
