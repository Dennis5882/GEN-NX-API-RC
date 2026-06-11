"""단위계 옵션.

MIDAS Gen NX `/db/unit` 의 DIST/FORCE 값을 캡슐화한다.
대만 RC 관행(M·TONF)과 SI(M·KN)를 프리셋으로 제공하고, 사용자가 선택한다.
"""
from __future__ import annotations

from dataclasses import dataclass

# /db/unit 이 허용하는 값 (공식 매뉴얼)
VALID_DIST = {"M", "CM", "MM", "IN", "FT"}
VALID_FORCE = {"KN", "N", "KGF", "TONF", "LBF", "KIPS"}


@dataclass(frozen=True)
class UnitSystem:
    """길이/힘 단위. 모델 전개 시 `/db/unit` 으로 1회 설정된다."""

    dist: str = "M"
    force: str = "TONF"

    def __post_init__(self) -> None:
        if self.dist not in VALID_DIST:
            raise ValueError(f"지원하지 않는 길이 단위: {self.dist} (가능: {sorted(VALID_DIST)})")
        if self.force not in VALID_FORCE:
            raise ValueError(f"지원하지 않는 힘 단위: {self.force} (가능: {sorted(VALID_FORCE)})")

    @property
    def label(self) -> str:
        return f"{self.force}·{self.dist}"


# 프리셋
M_TONF = UnitSystem(dist="M", force="TONF")  # 대만 RC 관행
M_KN = UnitSystem(dist="M", force="KN")      # SI

UNIT_PRESETS: dict[str, UnitSystem] = {
    "M_TONF": M_TONF,
    "M_KN": M_KN,
}
