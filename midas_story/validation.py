"""불변식 검증 (PDF §2, §3.1).

전개 전에 Building 도메인 모델의 정합성을 확인한다.
오류는 모아서 ValidationError 로 한 번에 보고한다.
"""
from __future__ import annotations

from .domain import Building, COLUMN, BEAM, WALL, SLAB


class ValidationError(Exception):
    """검증 실패. errors 목록을 함께 보유."""

    def __init__(self, errors: list):
        self.errors = errors
        super().__init__("검증 실패:\n  - " + "\n  - ".join(errors))


def _is_continuous(stories: list) -> bool:
    s = sorted(stories)
    return all(b - a == 1 for a, b in zip(s, s[1:]))


def validate(building: Building, allow_noncontinuous: bool = False) -> None:
    """Building 검증. 실패 시 ValidationError 발생."""
    errors: list = []

    mat_ids = {m.id for m in building.materials}
    sect_ids = {s.id for s in building.sections}
    thik_ids = {t.id for t in building.thicknesses}
    lc_names = {lc.name for lc in building.load_cases}
    flt_names = {f.name for f in building.floor_load_types}

    # id 중복
    _check_dup(errors, [m.id for m in building.materials], "Material id")
    _check_dup(errors, [s.id for s in building.sections], "Section id")
    _check_dup(errors, [t.id for t in building.thicknesses], "Thickness id")
    _check_dup(errors, [f.id for f in building.floor_load_types], "FloorLoadType id")

    # 자연층 중복 (표준층 간 disjoint)
    seen: dict = {}
    for tf in building.typical_floors:
        if not tf.mapped_stories:
            errors.append(f"표준층 '{tf.id}': mapped_stories 가 비어 있음")
        if tf.story_height <= 0:
            errors.append(f"표준층 '{tf.id}': story_height 는 양수여야 함 ({tf.story_height})")
        if not allow_noncontinuous and not _is_continuous(tf.mapped_stories):
            errors.append(
                f"표준층 '{tf.id}': mapped_stories 가 연속이 아님 {sorted(tf.mapped_stories)} "
                f"(PDF §2 — 연속 또는 동일 위상 필요; 의도된 경우 allow_noncontinuous=True)"
            )
        for s in tf.mapped_stories:
            if s in seen:
                errors.append(
                    f"자연층 {s} 가 표준층 '{seen[s]}' 와 '{tf.id}' 에 중복 매핑됨"
                )
            else:
                seen[s] = tf.id

    # FloorLoadType.items 의 하중케이스 참조
    for flt in building.floor_load_types:
        for lc_name, _ in flt.items:
            if lc_name not in lc_names:
                errors.append(
                    f"FloorLoadType '{flt.name}': 존재하지 않는 하중케이스 '{lc_name}' 참조"
                )

    # 하중조합: 이름 길이(MIDAS 제한 20자) + 참조 하중케이스
    for cb in building.load_combos:
        if len(cb.name) > 20:
            errors.append(f"하중조합 이름 20자 초과({len(cb.name)}): '{cb.name}' (수식은 desc 로)")
        for lc_name, _ in cb.terms:
            if lc_name not in lc_names:
                errors.append(f"하중조합 '{cb.name}': 존재하지 않는 하중케이스 '{lc_name}' 참조")

    # 부재 검증
    for tf in building.typical_floors:
        for i, el in enumerate(tf.elements):
            where = f"표준층 '{tf.id}' 부재[{i}]" + (f" '{el.tag}'" if el.tag else "")
            if el.material_id not in mat_ids:
                errors.append(f"{where}: 존재하지 않는 material_id={el.material_id}")
            n = len(el.points)
            if el.kind in (COLUMN,):
                _need(errors, where, el.section_id in sect_ids, f"section_id={el.section_id} (사각단면) 필요")
                if n != 1:
                    errors.append(f"{where}: COLUMN 은 평면 1점 필요 (현재 {n})")
            elif el.kind == BEAM:
                _need(errors, where, el.section_id in sect_ids, f"section_id={el.section_id} 필요")
                if n != 2:
                    errors.append(f"{where}: BEAM 은 평면 2점 필요 (현재 {n})")
            elif el.kind == WALL:
                _need(errors, where, el.thickness_id in thik_ids, f"thickness_id={el.thickness_id} 필요")
                if n != 2:
                    errors.append(f"{where}: WALL 은 평면 2점(벽 길이) 필요 (현재 {n})")
            elif el.kind == SLAB:
                _need(errors, where, el.thickness_id in thik_ids, f"thickness_id={el.thickness_id} 필요")
                if n not in (3, 4):
                    errors.append(f"{where}: SLAB(PLATE) 는 평면 3~4점 필요 (현재 {n})")
            else:
                errors.append(f"{where}: 알 수 없는 부재 종류 '{el.kind}'")

        # 바닥하중 면이 참조하는 타입 존재 여부
        for fla in tf.floor_loads:
            if fla.type_name not in flt_names:
                errors.append(
                    f"표준층 '{tf.id}': 바닥하중 면이 존재하지 않는 타입 '{fla.type_name}' 참조"
                )

    if errors:
        raise ValidationError(errors)


def _need(errors: list, where: str, ok: bool, msg: str) -> None:
    if not ok:
        errors.append(f"{where}: {msg}")


def _check_dup(errors: list, ids: list, label: str) -> None:
    seen = set()
    for i in ids:
        if i in seen:
            errors.append(f"{label} 중복: {i}")
        seen.add(i)
