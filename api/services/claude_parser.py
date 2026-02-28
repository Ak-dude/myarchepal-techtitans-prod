"""
GPT-4o PDF parser via Azure OpenAI.

Receives a base64-encoded PDF, extracts text with pdfplumber, sends it to
GPT-4o, and returns a structured form template (sections + fields).
"""

import base64
import io
import json
import os
import re
from pathlib import Path
from typing import Any

import pdfplumber
from openai import AzureOpenAI
from dotenv import load_dotenv

# Load env vars from project root .env (two levels up from api/services/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

PARSE_PROMPT = """\
You are analyzing an archaeological site recording form. Extract its COMPLETE structure.

Return ONLY valid JSON — no markdown, no explanation — matching this exact schema:

{
  "templateName": "string",
  "siteType": "string (e.g. Cemetery, Habitation, Rock Art, Structural, Shell Midden, etc.)",
  "sections": [
    {
      "id": "section-0",
      "title": "string",
      "order": 0,
      "isCollapsible": true,
      "isProtected": false
    }
  ],
  "fields": [
    {
      "id": "unique-kebab-case-id",
      "sectionId": "section-0",
      "label": "string",
      "fieldType": "text",
      "order": 0,
      "isRequired": false,
      "isHidden": false,
      "isProtected": false,
      "options": null,
      "placeholder": null,
      "helpText": null,
      "conditionalLogic": null
    }
  ]
}

fieldType rules — choose the most appropriate:
- "text"                for single-line text inputs
- "textarea"            for multi-line / notes fields
- "number"              for numeric inputs (counts, measurements, percentages)
- "date"                for date fields
- "radio"               for mutually exclusive choices (Yes/No, pick one)
- "checkbox"            ONLY for a single standalone boolean tick box (e.g. "I agree", "Check if applicable")
- "select"              for single-choice dropdowns
- "multiselect"         for ANY group of checkboxes where multiple can be ticked (e.g. "check all that apply",
                        condition lists, feature lists) — ALWAYS populate "options" with every label in the group
- "coordinates_latlong" for latitude/longitude coordinate pairs
- "coordinates_utm"     for UTM coordinate fields (Zone, Easting, Northing)
- "file_upload"         for photo, map, or document attachment fields
- "repeating_group"     for tables / repeated row entries (e.g. burial records, artifact lists)
- "section_header"      for bold section titles that are not input fields
- "divider"             for horizontal rule separators

Additional rules:
- Set isProtected: true for any section/field marked "Office Use Only", "Admin Use", or similar.
- Set isRequired: true only when the form explicitly marks a field as required.
- Generate stable, unique, kebab-case IDs per field (e.g. "cemetery-name", "state-site-number").
- Preserve the visual order of sections and fields exactly as they appear top-to-bottom.
- For radio/select/multiselect fields include ALL listed options in the "options" array — never leave it null.
- If a group of checkboxes shares a common label/question, model it as ONE multiselect field with that
  label and all checkbox labels as options. Do NOT create separate checkbox fields for each tick box.
- For repeating_group fields, include a "groupFields" array with the sub-field definitions
  (same schema as a regular field, without nested groupFields).
- For fields with conditional visibility (e.g. "If Yes, explain"), set conditionalLogic:
  { "triggerFieldId": "<id-of-trigger-field>", "triggerValue": "<value>", "action": "show" }
- Include every input, checkbox, radio button, date box, and text area visible in the form.
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text_from_base64_pdf(base64_pdf: str) -> str:
    """Decode a base64 PDF and extract all text via pdfplumber."""
    pdf_bytes = base64.b64decode(base64_pdf)
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def parse_pdf_with_claude(base64_pdf: str) -> dict[str, Any]:
    """
    Extract form structure from a base64-encoded PDF using GPT-4o via Azure OpenAI.
    Returns the parsed template as a Python dict.

    Named parse_pdf_with_claude for backward compatibility with the router import.
    """
    endpoint = os.environ["VITE_AZURE_OPENAI_ENDPOINT"]
    api_key = os.environ["VITE_AZURE_OPENAI_API_KEY"]
    deployment = os.environ.get("VITE_AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")
    api_version = os.environ.get("VITE_AZURE_OPENAI_API_VERSION", "2024-02-15-preview")

    # Extract text from PDF
    pdf_text = _extract_text_from_base64_pdf(base64_pdf)
    if not pdf_text:
        raise ValueError("Could not extract any text from the uploaded PDF.")

    client = AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version=api_version,
    )

    response = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": PARSE_PROMPT},
            {"role": "user", "content": pdf_text},
        ],
        max_tokens=8096,
        temperature=0,
    )

    raw_text = response.choices[0].message.content or ""

    # Strip optional markdown code fences (```json ... ```)
    json_match = re.search(r"\{[\s\S]*\}", raw_text)
    if not json_match:
        raise ValueError(f"GPT-4o returned no JSON. Raw response:\n{raw_text[:500]}")

    return json.loads(json_match.group())
