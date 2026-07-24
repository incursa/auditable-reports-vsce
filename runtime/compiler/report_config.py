from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Mapping


PAGE_SIZES_INCHES = {
    "Letter": (8.5, 11.0),
    "Legal": (8.5, 14.0),
    "A4": (8.2677, 11.6929),
}
ORIENTATIONS = {"portrait", "landscape"}
SOURCE_DISPLAYS = {"visible", "hidden"}
DATE_DISPLAYS = {"timestamp", "date-only", "hidden"}
PROFILE_DEFAULTS = {
    "report": {"orientation": "landscape", "page_size": "Letter", "source_display": "visible", "date_display": "timestamp"},
    "technical": {"orientation": "landscape", "page_size": "Letter", "source_display": "visible", "date_display": "timestamp"},
    "lesson": {"orientation": "portrait", "page_size": "Letter", "source_display": "visible", "date_display": "date-only"},
    "journal": {"orientation": "portrait", "page_size": "Letter", "source_display": "visible", "date_display": "date-only"},
    "decision-brief": {"orientation": "portrait", "page_size": "Letter", "source_display": "hidden", "date_display": "date-only"},
}


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class ReportConfig:
    document_type: str
    orientation: str
    page_size: str
    source_display: str
    date_display: str
    pdf_name: str

    @property
    def width_inches(self) -> float:
        width, height = PAGE_SIZES_INCHES[self.page_size]
        return height if self.orientation == "landscape" else width

    @property
    def height_inches(self) -> float:
        width, height = PAGE_SIZES_INCHES[self.page_size]
        return width if self.orientation == "landscape" else height

    @property
    def css_size(self) -> str:
        return f"{self.width_inches:g}in {self.height_inches:g}in"

    @property
    def expected_media_box(self) -> tuple[float, float]:
        return self.width_inches * 72.0, self.height_inches * 72.0


def _choice(value: str, allowed: set[str], label: str) -> str:
    if value not in allowed:
        raise ConfigError(f"{label} must be one of: {', '.join(sorted(allowed))}")
    return value


def _page_size(value: str) -> str:
    for candidate in PAGE_SIZES_INCHES:
        if candidate.lower() == value.lower():
            return candidate
    raise ConfigError(f"page-size must be one of: {', '.join(PAGE_SIZES_INCHES)}")


def _pdf_name(value: str) -> str:
    if Path(value).name != value or "/" in value or "\\" in value:
        raise ConfigError("pdf-name must be a file name without a path")
    if not value.lower().endswith(".pdf") or value in {".pdf", "..pdf"}:
        raise ConfigError("pdf-name must end with .pdf")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*\.pdf", value, flags=re.I):
        raise ConfigError("pdf-name may contain only letters, digits, dots, underscores, and hyphens")
    return value


def resolve_report_config(
    metadata: Mapping[str, str],
    *,
    orientation: str | None = None,
    page_size: str | None = None,
    source_display: str | None = None,
    date_display: str | None = None,
    pdf_name: str | None = None,
) -> ReportConfig:
    document_type = metadata.get("document-type", "report")
    if document_type not in PROFILE_DEFAULTS:
        raise ConfigError(f"unsupported document-type: {document_type}")
    defaults = PROFILE_DEFAULTS[document_type]
    resolved_orientation = _choice(
        orientation or metadata.get("print-orientation", "") or defaults["orientation"],
        ORIENTATIONS,
        "print-orientation",
    )
    resolved_page_size = _page_size(page_size or metadata.get("page-size", "") or defaults["page_size"])
    resolved_source_display = _choice(
        source_display or metadata.get("source-display", "") or defaults["source_display"],
        SOURCE_DISPLAYS,
        "source-display",
    )
    resolved_date_display = _choice(
        date_display or metadata.get("date-display", "") or defaults["date_display"],
        DATE_DISPLAYS,
        "date-display",
    )
    resolved_pdf_name = _pdf_name(pdf_name or metadata.get("pdf-name", "") or "report.pdf")
    return ReportConfig(
        document_type=document_type,
        orientation=resolved_orientation,
        page_size=resolved_page_size,
        source_display=resolved_source_display,
        date_display=resolved_date_display,
        pdf_name=resolved_pdf_name,
    )


MEDIA_BOX_PATTERN = re.compile(
    rb"/MediaBox\s*\[\s*([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)\s*\]"
)


def read_pdf_media_boxes(path: Path) -> list[tuple[float, float]]:
    boxes = []
    for x1, y1, x2, y2 in MEDIA_BOX_PATTERN.findall(path.read_bytes()):
        boxes.append((abs(float(x2) - float(x1)), abs(float(y2) - float(y1))))
    if not boxes:
        raise ConfigError(f"could not find any PDF MediaBox entries in {path}")
    return boxes


def validate_pdf_media_boxes(path: Path, config: ReportConfig, *, tolerance_points: float = 1.5) -> None:
    expected_width, expected_height = config.expected_media_box
    for page_number, (actual_width, actual_height) in enumerate(read_pdf_media_boxes(path), start=1):
        if abs(actual_width - expected_width) > tolerance_points or abs(actual_height - expected_height) > tolerance_points:
            raise ConfigError(
                "PDF page "
                f"{page_number} MediaBox is {actual_width:g}x{actual_height:g} pt; "
                f"expected {expected_width:g}x{expected_height:g} pt "
                f"for {config.page_size} {config.orientation}"
            )
