"""
POST /api/parse-pdf

Receives a base64-encoded PDF from the frontend, sends it to Claude Sonnet 4.6
via Azure AI Foundry, and returns the extracted form template structure.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from api.services.claude_parser import parse_pdf_with_claude

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
    if not body.base64_pdf:
        raise HTTPException(status_code=400, detail="base64_pdf is required")

    try:
        result = parse_pdf_with_claude(body.base64_pdf)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude parsing failed: {str(e)}")

    return ParsePdfResponse(
        template_name=result.get("templateName", "Untitled Form"),
        site_type=result.get("siteType", "Unknown"),
        sections=result.get("sections", []),
        fields=result.get("fields", []),
    )
