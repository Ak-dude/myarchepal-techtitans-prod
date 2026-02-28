"""
PDF export builder using reportlab.

Renders a SiteSubmission as a styled PDF report matching NC archaeology
form conventions.
"""

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BRAND_BLUE = colors.HexColor("#1e3a5f")
LIGHT_GREY = colors.HexColor("#cccccc")
ROW_ALT = colors.HexColor("#f5f5f5")


def _fmt_value(value: Any, field_type: str) -> str:
    """Format a field value as a human-readable string."""
    if value is None or value == "" or value == [] or value == {}:
        return "—"

    if field_type in ("multiselect", "checkbox") and isinstance(value, list):
        return ", ".join(str(v) for v in value) if value else "—"

    if field_type == "coordinates_latlong" and isinstance(value, dict):
        lat = value.get("lat", "")
        lng = value.get("lng", "")
        return f"{lat}, {lng}" if (lat or lng) else "—"

    if field_type == "coordinates_utm" and isinstance(value, dict):
        zone = value.get("zone", "")
        easting = value.get("easting", "")
        northing = value.get("northing", "")
        datum = value.get("datum", "")
        return f"Zone {zone}, E {easting}, N {northing} ({datum})" if zone else "—"

    if field_type == "file_upload" and isinstance(value, list):
        if not value:
            return "—"
        names = [
            a.get("fileName", "file") if isinstance(a, dict) else str(a)
            for a in value
        ]
        return ", ".join(names)

    if field_type == "repeating_group":
        # rendered separately as a table
        return ""

    return str(value)


def _fmt_timestamp(ts: Any) -> str:
    """Format a Firestore Timestamp or datetime-like object."""
    if ts is None:
        return "—"
    try:
        # Firebase Admin returns DatetimeWithNanoseconds (subclass of datetime)
        if hasattr(ts, "strftime"):
            return ts.strftime("%B %d, %Y at %I:%M %p")
        return str(ts)
    except Exception:
        return str(ts)


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------


def build_submission_pdf(
    site: dict,
    submission: dict,
    sections: list[dict],
    fields: list[dict],
    include_protected: bool = False,
) -> bytes:
    """
    Build a PDF report for a site submission.

    Args:
        site: Sites/{siteId} document data
        submission: submissions/{submissionId} document data
        sections: list of TemplateSection dicts
        fields: list of TemplateField dicts
        include_protected: include isProtected sections/fields (ORG_ADMIN only)

    Returns:
        PDF file as bytes
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    base = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "SiteTitle",
        parent=base["Title"],
        fontSize=16,
        spaceAfter=4,
        textColor=BRAND_BLUE,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=base["Normal"],
        fontSize=10,
        spaceAfter=2,
        textColor=colors.HexColor("#555555"),
    )
    section_style = ParagraphStyle(
        "SectionTitle",
        parent=base["Heading2"],
        fontSize=11,
        spaceBefore=14,
        spaceAfter=6,
        textColor=BRAND_BLUE,
    )
    label_style = ParagraphStyle(
        "FieldLabel",
        parent=base["Normal"],
        fontSize=8,
        spaceAfter=1,
        textColor=colors.HexColor("#777777"),
    )
    value_style = ParagraphStyle(
        "FieldValue",
        parent=base["Normal"],
        fontSize=10,
        spaceAfter=8,
    )
    th_style = ParagraphStyle(
        "TableHeader",
        parent=base["Normal"],
        fontSize=8,
        textColor=colors.white,
    )
    footer_style = ParagraphStyle(
        "Footer",
        parent=base["Normal"],
        fontSize=7,
        textColor=colors.grey,
        alignment=1,  # center
    )

    form_data: dict = submission.get("formData", {}) or {}
    elements = []

    # ---- Report header ----
    site_name = site.get("name", "Unnamed Site")
    state_num = site.get("stateSiteNumber", "")
    status = submission.get("status", "in_progress").replace("_", " ").title()
    last_saved = _fmt_timestamp(
        submission.get("submittedAt") or submission.get("lastSavedAt")
    )

    elements.append(Paragraph(site_name, title_style))
    if state_num:
        elements.append(Paragraph(f"State Site Number: {state_num}", subtitle_style))
    elements.append(
        Paragraph(f"Status: {status}  ·  Last saved: {last_saved}", subtitle_style)
    )
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(HRFlowable(width="100%", thickness=1, color=BRAND_BLUE))
    elements.append(Spacer(1, 0.1 * inch))

    # ---- Group fields by section ----
    fields_by_section: dict[str, list[dict]] = {}
    for field in sorted(fields, key=lambda f: f.get("order", 0)):
        sid = field.get("sectionId", "")
        fields_by_section.setdefault(sid, []).append(field)

    available_width = 7.0 * inch  # letter - margins

    # ---- Sections ----
    for section in sorted(sections, key=lambda s: s.get("order", 0)):
        if section.get("isProtected") and not include_protected:
            continue

        title = section.get("title", "Section")
        if section.get("isProtected"):
            title += " (Admin Only)"

        elements.append(Paragraph(title, section_style))
        elements.append(
            HRFlowable(width="100%", thickness=0.5, color=LIGHT_GREY)
        )
        elements.append(Spacer(1, 0.05 * inch))

        for field in fields_by_section.get(section.get("id", ""), []):
            if field.get("isProtected") and not include_protected:
                continue

            ftype = field.get("fieldType", "text")
            if ftype in ("section_header", "divider"):
                continue

            label = field.get("label", "")
            value = form_data.get(field.get("id", ""), None)

            if ftype == "repeating_group":
                rows: list = value if isinstance(value, list) else []
                group_fields: list = field.get("groupFields") or []
                elements.append(Paragraph(label, label_style))

                if group_fields and rows:
                    headers = [gf.get("label", gf.get("id", "")) for gf in group_fields]
                    gf_ids = [gf.get("id", "") for gf in group_fields]
                    col_w = available_width / len(headers)

                    table_data = [[Paragraph(h, th_style) for h in headers]]
                    for row in rows:
                        if not isinstance(row, dict):
                            continue
                        table_data.append(
                            [
                                Paragraph(str(row.get(gid, "") or "—"), base["Normal"])
                                for gid in gf_ids
                            ]
                        )

                    tbl = Table(table_data, colWidths=[col_w] * len(headers))
                    tbl.setStyle(
                        TableStyle(
                            [
                                ("BACKGROUND", (0, 0), (-1, 0), BRAND_BLUE),
                                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                                ("FONTSIZE", (0, 0), (-1, -1), 8),
                                ("GRID", (0, 0), (-1, -1), 0.5, LIGHT_GREY),
                                (
                                    "ROWBACKGROUNDS",
                                    (0, 1),
                                    (-1, -1),
                                    [colors.white, ROW_ALT],
                                ),
                                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                                ("TOPPADDING", (0, 0), (-1, -1), 4),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                            ]
                        )
                    )
                    elements.append(tbl)
                else:
                    elements.append(Paragraph("No entries recorded.", value_style))

                elements.append(Spacer(1, 0.1 * inch))
            else:
                formatted = _fmt_value(value, ftype)
                elements.append(Paragraph(label, label_style))
                elements.append(Paragraph(formatted, value_style))

        elements.append(Spacer(1, 0.05 * inch))

    # ---- Footer ----
    elements.append(Spacer(1, 0.2 * inch))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=LIGHT_GREY))
    elements.append(
        Paragraph(
            "Generated by ArchePal · NC Archaeology Site Management Platform",
            footer_style,
        )
    )

    doc.build(elements)
    return buffer.getvalue()
