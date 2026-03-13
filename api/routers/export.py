"""
Export endpoints:
  GET /api/submissions/{siteId}/{submissionId}/export-pdf
  GET /api/submissions/{siteId}/{submissionId}/export-csv

Authentication: optional Authorization: Bearer <firebase_id_token> header.
If the token belongs to ORG_ADMIN or SUPER_ADMIN, protected sections are
included in the export. Otherwise only public fields are exported.
"""

import csv
import io
import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from api.services.fb_admin import get_db, verify_id_token
from api.services.pdf_builder import build_submission_pdf
from api.services.crashvault import capture_exception, log_info, log_warning

logger = logging.getLogger("archepal.routers.export")

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_caller_role(authorization: Optional[str]) -> str:
    """
    Decode the Firebase ID token from the Authorization header and look up the
    user's role in Firestore. Returns 'MEMBER' if the header is absent or invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        logger.debug("No auth header — defaulting to MEMBER role")
        return "MEMBER"
    token = authorization.removeprefix("Bearer ").strip()
    try:
        claims = verify_id_token(token)
        uid = claims.get("uid", "")
        if not uid:
            logger.warning("Token decoded but no uid found — defaulting to MEMBER")
            return "MEMBER"
        db = get_db()
        user_doc = db.collection("users").document(uid).get()
        if user_doc.exists:
            role = user_doc.to_dict().get("role", "MEMBER")
            logger.info("Auth resolved — uid=%s role=%s", uid, role)
            return role
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        capture_exception(e, tags=["auth", "export"], source="api.routers.export")
    return "MEMBER"


def _fetch_export_data(siteId: str, submissionId: str) -> tuple:
    """
    Fetch site, submission, sections, and fields from Firestore.
    Raises HTTPException on missing documents.
    """
    db = get_db()

    site_doc = db.collection("Sites").document(siteId).get()
    if not site_doc.exists:
        raise HTTPException(status_code=404, detail=f"Site '{siteId}' not found.")
    site = site_doc.to_dict()

    sub_doc = (
        db.collection("Sites")
        .document(siteId)
        .collection("submissions")
        .document(submissionId)
        .get()
    )
    if not sub_doc.exists:
        raise HTTPException(
            status_code=404, detail=f"Submission '{submissionId}' not found."
        )
    submission = sub_doc.to_dict()

    template_id = submission.get("templateId") or site.get("linkedTemplateId")
    if not template_id:
        raise HTTPException(
            status_code=400,
            detail="No template linked to this submission.",
        )

    sections_snap = (
        db.collection("siteTemplates")
        .document(template_id)
        .collection("sections")
        .stream()
    )
    sections = [{"id": d.id, **d.to_dict()} for d in sections_snap]

    fields_snap = (
        db.collection("siteTemplates")
        .document(template_id)
        .collection("fields")
        .stream()
    )
    fields = [{"id": d.id, **d.to_dict()} for d in fields_snap]

    return site, submission, sections, fields


# ---------------------------------------------------------------------------
# PDF export
# ---------------------------------------------------------------------------


@router.get("/submissions/{siteId}/{submissionId}/export-pdf")
async def export_pdf(
    siteId: str,
    submissionId: str,
    authorization: Optional[str] = Header(default=None),
):
    """Export a submission as a styled PDF report."""
    logger.info("export-pdf requested — site=%s submission=%s", siteId, submissionId)

    role = _get_caller_role(authorization)
    include_protected = role in ("ORG_ADMIN", "SUPER_ADMIN")

    site, submission, sections, fields = _fetch_export_data(siteId, submissionId)

    try:
        pdf_bytes = build_submission_pdf(
            site=site,
            submission=submission,
            sections=sections,
            fields=fields,
            include_protected=include_protected,
        )
    except Exception as e:
        logger.error("PDF build failed — site=%s: %s", siteId, e, exc_info=True)
        capture_exception(e, tags=["export", "pdf-build"], context={"siteId": siteId, "submissionId": submissionId}, source="api.routers.export")
        raise HTTPException(status_code=500, detail="PDF generation failed")

    safe_name = site.get("name", "submission").replace(" ", "_")
    filename = f"{safe_name}_{submissionId[:8]}.pdf"

    logger.info("export-pdf success — site=%s file=%s size=%d bytes", siteId, filename, len(pdf_bytes))
    log_info(
        f"PDF exported: {filename} ({len(pdf_bytes)} bytes)",
        tags=["export", "pdf"],
        context={"siteId": siteId, "submissionId": submissionId, "role": role},
        source="api.routers.export",
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# CSV export
# ---------------------------------------------------------------------------


@router.get("/submissions/{siteId}/{submissionId}/export-csv")
async def export_csv(
    siteId: str,
    submissionId: str,
    authorization: Optional[str] = Header(default=None),
):
    """
    Export repeating_group fields (e.g. burial records) as a CSV file.
    Uses the first repeating_group field found in the template.
    """
    logger.info("export-csv requested — site=%s submission=%s", siteId, submissionId)

    role = _get_caller_role(authorization)
    include_protected = role in ("ORG_ADMIN", "SUPER_ADMIN")

    site, submission, _sections, fields = _fetch_export_data(siteId, submissionId)
    form_data: dict = submission.get("formData", {}) or {}

    # Find repeating_group fields the caller is allowed to see
    rg_fields = [
        f
        for f in fields
        if f.get("fieldType") == "repeating_group"
        and (not f.get("isProtected") or include_protected)
    ]

    if not rg_fields:
        raise HTTPException(
            status_code=404,
            detail="No repeating group fields found in this template.",
        )

    # Use the first repeating_group field (typically the main data table)
    rg_field = rg_fields[0]
    rows: list = form_data.get(rg_field.get("id", ""), []) or []
    group_fields: list = rg_field.get("groupFields") or []

    # Build CSV
    output = io.StringIO()
    col_labels = [gf.get("label", gf.get("id", "")) for gf in group_fields]
    gf_ids = [gf.get("id", "") for gf in group_fields]

    writer = csv.DictWriter(output, fieldnames=col_labels, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        if not isinstance(row, dict):
            continue
        writer.writerow(
            {
                label: row.get(gid, "")
                for label, gid in zip(col_labels, gf_ids)
            }
        )

    csv_bytes = output.getvalue().encode("utf-8")
    safe_name = site.get("name", "submission").replace(" ", "_")
    field_label = rg_field.get("label", "data").replace(" ", "_")
    filename = f"{safe_name}_{field_label}.csv"

    logger.info("export-csv success — site=%s file=%s rows=%d", siteId, filename, len(rows))
    log_info(
        f"CSV exported: {filename} ({len(rows)} rows)",
        tags=["export", "csv"],
        context={"siteId": siteId, "submissionId": submissionId, "role": role, "rows": len(rows)},
        source="api.routers.export",
    )

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
