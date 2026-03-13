"""
POST /api/parse-pdf

Receives a base64-encoded PDF from the frontend, sends it directly to
Claude Opus 4.6 as a native document block, and returns the extracted
form template (sections + fields).
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from api.services.claude_parser import parse_pdf_with_claude
from api.services.crashvault import capture_exception, log_info

logger = logging.getLogger("archepal.routers.pdf")

router = APIRouter()


class ParsePdfRequest(BaseModel):
    base64_pdf: str       # base64-encoded PDF (no data URI prefix)
    file_name: str        # original filename for logging
    org_id: str           # organization context


class ParsePdfResponse(BaseModel):
    template_name: str
    site_type: str
    sections: list
    fields: list


@router.post("/parse-pdf", response_model=ParsePdfResponse)
async def parse_pdf(body: ParsePdfRequest):
    """
    Parse an uploaded PDF form using Claude Sonnet 4.6.
    Returns sections and fields ready to be saved as a SiteTemplate.
    """
    logger.info("parse-pdf called — file=%s org=%s pdf_size=%d bytes",
                body.file_name, body.org_id, len(body.base64_pdf))

    if not body.base64_pdf:
        logger.warning("parse-pdf rejected — empty base64_pdf")
        raise HTTPException(status_code=400, detail="base64_pdf is required")

    try:
        result = parse_pdf_with_claude(body.base64_pdf)
    except ValueError as e:
        logger.warning("parse-pdf validation error — file=%s: %s", body.file_name, e)
        capture_exception(e, tags=["pdf", "validation"], context={"file_name": body.file_name, "org_id": body.org_id}, source="api.routers.pdf")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("parse-pdf failed — file=%s: %s", body.file_name, e, exc_info=True)
        capture_exception(e, tags=["pdf", "claude"], context={"file_name": body.file_name, "org_id": body.org_id}, source="api.routers.pdf")
        raise HTTPException(status_code=500, detail=f"Claude parsing failed: {str(e)}")

    sections_count = len(result.get("sections", []))
    fields_count = len(result.get("fields", []))
    template_name = result.get("templateName", "Untitled Form")

    logger.info("parse-pdf success — file=%s template=%s sections=%d fields=%d",
                body.file_name, template_name, sections_count, fields_count)
    log_info(
        f"PDF parsed: {body.file_name} → {template_name} ({sections_count} sections, {fields_count} fields)",
        tags=["pdf", "success"],
        context={"file_name": body.file_name, "org_id": body.org_id, "template_name": template_name},
        source="api.routers.pdf",
    )

    return ParsePdfResponse(
        template_name=template_name,
        site_type=result.get("siteType", "Unknown"),
        sections=result.get("sections", []),
        fields=result.get("fields", []),
    )
