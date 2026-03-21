"""
PDF parser pipeline — GPT-4o vision (single-step).

Renders each PDF page to a PNG image using pymupdf, then sends all page
images to GPT-4o in one call. Returns a fully structured SiteTemplate JSON.

Env vars required:
  OPENAI_API_KEY   — OpenAI API key
"""

import base64
import json
import logging
import os
import re
from pathlib import Path
from typing import Any

import fitz  # pymupdf
from openai import OpenAI
from dotenv import load_dotenv

from api.services.crashvault import capture_exception, log_info

logger = logging.getLogger("archepal.services.claude_parser")

# Load env vars from project root .env (two levels up from api/services/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

MODEL = "gpt-4o"
MAX_PAGES = 10  # cap to avoid excessive token usage

# ---------------------------------------------------------------------------
# Structuring prompt
# ---------------------------------------------------------------------------

PARSE_PROMPT = """\
You are analyzing an archaeological site recording form. Extract its COMPLETE structure.

CRITICAL RULES — follow without exception:
- Extract EVERY SINGLE field visible in the form. Do NOT skip, summarize, or stop early.
- Do NOT truncate the JSON. The response must be syntactically complete and valid.
- Do NOT stop generating until ALL sections and ALL fields have been output.
- If a section has 20 fields, output all 20. If the form has 80 fields, output all 80.
- Do NOT omit any field to save space. Do NOT write "..." or similar placeholders.

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
- Do NOT stop until the closing `}` of the root JSON object has been emitted.
"""


# ---------------------------------------------------------------------------
# Public entry point (called by the router)
# ---------------------------------------------------------------------------

def parse_pdf_with_claude(base64_pdf: str) -> dict[str, Any]:
    """
    Render each PDF page to PNG via pymupdf, then send all page images to
    GPT-4o vision. Returns a structured SiteTemplate JSON.
    """
    pdf_bytes = base64.b64decode(base64_pdf)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    content: list[dict] = []
    for i, page in enumerate(doc):
        if i >= MAX_PAGES:
            break
        pix = page.get_pixmap(dpi=150)
        page_b64 = base64.b64encode(pix.tobytes("png")).decode()
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/png;base64,{page_b64}", "detail": "high"},
        })
    doc.close()

    content.append({"type": "text", "text": PARSE_PROMPT})

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=16000,
        messages=[{"role": "user", "content": content}],
    )

    raw_text = response.choices[0].message.content or ""

    if response.choices[0].finish_reason == "length":
        raw_text = _repair_truncated_json(raw_text)

    json_match = re.search(r"\{[\s\S]*\}", raw_text)
    if not json_match:
        raise ValueError(f"GPT-4o returned no JSON. Raw response:\n{raw_text[:500]}")

    return json.loads(json_match.group())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _repair_truncated_json(raw: str) -> str:
    """
    Best-effort repair of a JSON string cut off mid-stream by a token limit.
    Closes any open string, then appends enough brackets/braces to make it valid.
    """
    # Close open string literal (odd number of unescaped quotes)
    unescaped_quotes = len(re.findall(r'(?<!\\)"', raw))
    if unescaped_quotes % 2 == 1:
        raw = raw + '"'

    stack = []
    in_string = False
    escape_next = False
    for ch in raw:
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in ('{', '['):
            stack.append(ch)
        elif ch == '}' and stack and stack[-1] == '{':
            stack.pop()
        elif ch == ']' and stack and stack[-1] == '[':
            stack.pop()

    for opener in reversed(stack):
        raw += ']' if opener == '[' else '}'

    return raw
