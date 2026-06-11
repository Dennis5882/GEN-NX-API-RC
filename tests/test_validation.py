"""검증(불변식) 테스트."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402

from midas_story import (  # noqa: E402
    Building, TypicalFloor, Element, Material, Section, Thickness,
    LoadCase, FloorLoadType, COLUMN, BEAM, SLAB, WALL,
    validate, ValidationError,
)


def _minimal_building(**overrides) -> Building:
    b = Building(
        materials=[Material(id=1, name="C32")],
        sections=[Section(id=1, name="C600", h=0.6, b=0.6)],
        thicknesses=[Thickness(id=1, name="S150", t=0.15)],
        load_cases=[LoadCase(name="D", type="D")],
        typical_floors=[
            TypicalFloor(id="TF-A", mapped_stories=[2, 3, 4], story_height=3.0,
                         elements=[Element(kind=COLUMN, material_id=1, section_id=1,
                                           points=[(0, 0)])])
        ],
    )
    for k, v in overrides.items():
        setattr(b, k, v)
    return b


def test_valid_building_passes():
    validate(_minimal_building())  # 예외 없음


def test_noncontinuous_stories_fails():
    b = _minimal_building(typical_floors=[
        TypicalFloor(id="TF-A", mapped_stories=[2, 4, 6], story_height=3.0,
                     elements=[Element(kind=COLUMN, material_id=1, section_id=1, points=[(0, 0)])])
    ])
    with pytest.raises(ValidationError) as e:
        validate(b)
    assert any("연속" in m for m in e.value.errors)


def test_noncontinuous_allowed_with_flag():
    b = _minimal_building(typical_floors=[
        TypicalFloor(id="TF-A", mapped_stories=[2, 4, 6], story_height=3.0,
                     elements=[Element(kind=COLUMN, material_id=1, section_id=1, points=[(0, 0)])])
    ])
    validate(b, allow_noncontinuous=True)  # 통과


def test_overlapping_stories_fails():
    b = _minimal_building(typical_floors=[
        TypicalFloor(id="TF-A", mapped_stories=[2, 3], story_height=3.0,
                     elements=[Element(kind=COLUMN, material_id=1, section_id=1, points=[(0, 0)])]),
        TypicalFloor(id="TF-B", mapped_stories=[3, 4], story_height=3.0,
                     elements=[Element(kind=COLUMN, material_id=1, section_id=1, points=[(0, 0)])]),
    ])
    with pytest.raises(ValidationError) as e:
        validate(b)
    assert any("중복 매핑" in m for m in e.value.errors)


def test_missing_section_ref_fails():
    b = _minimal_building(typical_floors=[
        TypicalFloor(id="TF-A", mapped_stories=[2, 3], story_height=3.0,
                     elements=[Element(kind=COLUMN, material_id=1, section_id=99, points=[(0, 0)])])
    ])
    with pytest.raises(ValidationError) as e:
        validate(b)
    assert any("section_id=99" in m for m in e.value.errors)


def test_wrong_point_count_fails():
    b = _minimal_building(typical_floors=[
        TypicalFloor(id="TF-A", mapped_stories=[2, 3], story_height=3.0,
                     elements=[Element(kind=BEAM, material_id=1, section_id=1, points=[(0, 0)])])
    ])
    with pytest.raises(ValidationError) as e:
        validate(b)
    assert any("BEAM" in m for m in e.value.errors)


def test_floorloadtype_unknown_loadcase_fails():
    b = _minimal_building(
        floor_load_types=[FloorLoadType(id=1, name="R", items=[("NOPE", 2.0)])]
    )
    with pytest.raises(ValidationError) as e:
        validate(b)
    assert any("NOPE" in m for m in e.value.errors)
