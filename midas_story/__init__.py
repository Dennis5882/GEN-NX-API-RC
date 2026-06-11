"""midas_story — 스토리(표준층) 기반 MIDAS Gen NX 모델링 코어.

PDF 규격서(標準層)의 표준층 개념을 도메인 모델로 정의하고,
표준층을 자연층으로 전개하여 MIDAS Gen NX Open API 페이로드를 생성한다.

순수 Python 코어: 네트워크/웹에 의존하지 않는 domain + validation + expander.
실제 전송은 client.MidasClient(또는 RecordingClient)가 담당한다.

레이어
  units      — 단위계 옵션(M·TONF / M·KN 등)
  domain     — Material/Section/Thickness/LoadCase/FloorLoadType/Element/TypicalFloor/Building
  validation — 불변식 검증(연속성, 단면 일치, id 참조 등)
  payloads   — /db/* Assign 바디 빌더
  expander   — 표준층 → 자연층 전개 → 연산(Operation) 목록 생성
  client     — REST 전송(MidasClient) / 기록(RecordingClient)
"""
from __future__ import annotations

from .units import UnitSystem, M_TONF, M_KN, UNIT_PRESETS
from .domain import (
    Material,
    Section,
    Thickness,
    LoadCase,
    FloorLoadType,
    FloorLoadArea,
    LoadCombo,
    Element,
    TypicalFloor,
    Building,
    COLUMN,
    BEAM,
    WALL,
    SLAB,
    TYPICAL,
    PODIUM,
    TRANSFER,
    ROOF,
    BASEMENT,
)
from .grid import Grid, build_frame
from .combos import taiwan_strength_combos
from .validation import validate, ValidationError
from .expander import Expander, Operation
from .client import MidasClient, RecordingClient
from . import taiwan

__all__ = [
    "UnitSystem",
    "M_TONF",
    "M_KN",
    "UNIT_PRESETS",
    "Material",
    "Section",
    "Thickness",
    "LoadCase",
    "FloorLoadType",
    "FloorLoadArea",
    "LoadCombo",
    "Element",
    "TypicalFloor",
    "Building",
    "COLUMN",
    "BEAM",
    "WALL",
    "SLAB",
    "TYPICAL",
    "PODIUM",
    "TRANSFER",
    "ROOF",
    "BASEMENT",
    "Grid",
    "build_frame",
    "taiwan_strength_combos",
    "validate",
    "ValidationError",
    "Expander",
    "Operation",
    "MidasClient",
    "RecordingClient",
    "taiwan",
]

__version__ = "1.0.2"
