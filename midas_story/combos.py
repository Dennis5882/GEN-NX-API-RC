"""대만 RC 강도설계(TWD-USD112) 하중조합 자동 생성.

대만 混凝土結構設計規範(USD, ACI318 계열)의 강도설계 조합을 따른다.
Building 의 load_cases TYPE(D/L/LR/S/R/W/E)을 보고 존재하는 항만으로 조합을 만든다.

참고: W/E 의 ± 부호별 분리, 편심·방향별 조합은 해석 단계(M3)에서 확장.
"""
from __future__ import annotations

from .domain import LoadCombo


def _names_by_type(load_cases: list) -> dict:
    by: dict = {}
    for lc in load_cases:
        by.setdefault(lc.type, []).append(lc.name)
    return by


def _terms(*pairs) -> list:
    """pairs: (names_list, factor) → [(name, factor), ...] (빈 리스트는 자동 제외)."""
    out = []
    for names, f in pairs:
        for n in names:
            out.append((n, f))
    return out


def taiwan_strength_combos(load_cases: list) -> list:
    """TWD-USD112 강도설계 하중조합 목록(LoadCombo) 생성.

    D=고정, L=활, Lr/S/R=지붕활/설/우, W=풍, E=지진.
    """
    by = _names_by_type(load_cases)
    D = by.get("D", []) + by.get("DC", []) + by.get("DW", [])
    L = by.get("L", [])
    roof = by.get("LR", []) or by.get("S", []) or by.get("R", [])
    W = by.get("W", [])
    E = by.get("E", [])

    # ⚠️ MIDAS 하중조합 이름(NAME)은 최대 20자 — 수식은 DESC 로 (라이브 검증).
    defs = [
        ("cLCB1", "1.4D",              True,       _terms((D, 1.4))),
        ("cLCB2", "1.2D+1.6L+0.5Lr",   True,       _terms((D, 1.2), (L, 1.6), (roof, 0.5))),
        ("cLCB3", "1.2D+1.6Lr+1.0L",   bool(roof), _terms((D, 1.2), (roof, 1.6), (L, 1.0))),
        ("cLCB4", "1.2D+1.0W+1.0L+0.5Lr", bool(W), _terms((D, 1.2), (W, 1.0), (L, 1.0), (roof, 0.5))),
        ("cLCB5", "1.2D+1.0E+1.0L",    bool(E),    _terms((D, 1.2), (E, 1.0), (L, 1.0))),
        ("cLCB6", "0.9D+1.0W",         bool(W),    _terms((D, 0.9), (W, 1.0))),
        ("cLCB7", "0.9D+1.0E",         bool(E),    _terms((D, 0.9), (E, 1.0))),
    ]
    combos: list = []
    if not D:
        return combos
    for name, desc, cond, terms in defs:
        if cond and terms:
            combos.append(LoadCombo(name, terms, desc=desc))
    return combos
