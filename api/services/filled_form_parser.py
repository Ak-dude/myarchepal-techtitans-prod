"""
Filled form parser — GPT-4o vision.

Unlike claude_parser.py (structure only) and form_image_parser.py (values only,
needs template upfront), this service does BOTH in a single GPT-4o call:
  1. Extract the form structure (sections + fields)
  2. Read every filled-in value from this specific form instance
  3. Pull out any site name / site number visible in the form header

PDFs are rendered to PNG images via pymupdf before sending.
Used by POST /api/parse-filled-form when no template is provided upfront.

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

logger = logging.getLogger("archepal.services.filled_form_parser")

load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)

MODEL = "gpt-4o"
MAX_PAGES = 10

PDF_MEDIA_TYPE = "application/pdf"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _render_pdf_to_images(base64_pdf: str) -> list[str]:
    """Render each PDF page to a base64 PNG string (capped at MAX_PAGES)."""
    pdf_bytes = base64.b64decode(base64_pdf)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages: list[str] = []
    for i, page in enumerate(doc):
        if i >= MAX_PAGES:
            break
        pix = page.get_pixmap(dpi=150)
        pages.append(base64.b64encode(pix.tobytes("png")).decode())
    doc.close()
    return pages

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

PARSE_FILLED_PROMPT = """\
You are reading an archaeological site recording form that has already been filled out.
Your task has TWO parts — complete BOTH fully before stopping.

PART 1 — STRUCTURE
Extract the complete form structure (every section and every field), following these rules:
- Extract EVERY SINGLE field visible in the form. Do NOT skip, summarize, or stop early.
- Do NOT truncate the JSON. The response must be syntactically complete and valid.
- Do NOT stop generating until ALL sections and ALL fields have been output.
- If a section has 20 fields, output all 20. If the form has 80 fields, output all 80.
- Do NOT omit any field to save space. Do NOT write "..." or similar placeholders.
- Preserve the visual order of sections and fields exactly as they appear top-to-bottom.
- Generate stable, unique, kebab-case IDs per field (e.g. "cemetery-name", "state-site-number").

fieldType rules — choose the most appropriate:
- "text"                for single-line text inputs
- "textarea"            for multi-line / notes fields
- "number"              for numeric inputs (counts, measurements, percentages)
- "date"                for date fields
- "radio"               for mutually exclusive choices (Yes/No, pick one)
- "checkbox"            ONLY for a single standalone boolean tick box
- "select"              for single-choice dropdowns
- "multiselect"         for ANY group of checkboxes where multiple can be ticked — ALWAYS
                        populate "options" with every label in the group
- "coordinates_latlong" for latitude/longitude coordinate pairs
- "coordinates_utm"     for UTM coordinate fields (Zone, Easting, Northing)
- "file_upload"         for photo, map, or document attachment fields
- "repeating_group"     for tables / repeated row entries (burial records, artifact lists)
- "section_header"      for bold section titles that are not input fields
- "divider"             for horizontal rule separators

Additional structure rules:
- Set isProtected: true for any section/field marked "Office Use Only", "Admin Use", or similar.
- Set isRequired: true only when the form explicitly marks a field as required.
- For radio/select/multiselect fields include ALL listed options in the "options" array.
- If a group of checkboxes shares a common question, model it as ONE multiselect field.
- For repeating_group fields, include a "groupFields" array with sub-field definitions.
- For conditionally visible fields set conditionalLogic:
  { "triggerFieldId": "<id>", "triggerValue": "<value>", "action": "show" }

PART 2 — VALUES
For each field extracted in Part 1, also read the value that was written, checked, or
selected on THIS specific filled form. Use the exact field label as the key in "formData".

Value rules:
- text / textarea / number: the written value as a string (number type → still a string here)
- date: "YYYY-MM-DD" if the date is clear, otherwise return it exactly as written
- radio / select: the chosen option string — must exactly match one of the "options" values
- multiselect / checkbox: an array of the selected option strings
- coordinates_latlong: { "lat": <number>, "lng": <number> }
- coordinates_utm: { "zone": "<string>", "easting": "<string>", "northing": "<string>" }
- repeating_group: an array of row objects, each row being { "subFieldLabel": value, ... }
- If a field is blank, illegible, or not visible: OMIT that key entirely — no null values
- Only include fields you can actually read from the form

SITE METADATA
Also look at the form header, top section, or any identifying information and extract:
- "suggestedSiteName": the site name, site number, or location identifier visible on the form
  (e.g. "Oakdale Cemetery — 31WK002"). Return an empty string "" if nothing is found.

CRITICAL: Return ONLY valid JSON — no markdown fences, no explanation — matching this schema:

{
  "templateName": "string (form title, e.g. Cemetery Site Form)",
  "siteType": "string (e.g. Cemetery, Habitation, Rock Art, Structural, Shell Midden)",
  "suggestedSiteName": "string (site name/number from header, or empty string)",
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
  ],
  "formData": {
    "Exact Field Label": "extracted value"
  }
}

Do NOT stop until the closing } of the root JSON object has been emitted.
"""


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def parse_filled_form_with_claude(
    base64_data: str,
    media_type: str,
) -> dict[str, Any]:
    """
    Extract both structure (sections/fields) and filled values from a form PDF or image.

    Returns:
        {
          "template_name": str,
          "site_type": str,
          "suggested_site_name": str,
          "sections": list,
          "fields": list,
          "form_data": dict,   # { field_label: extracted_value }
        }

    Raises:
        ValueError: unsupported media type, or Claude returned no parseable JSON
    """
    if media_type not in (PDF_MEDIA_TYPE, *ALLOWED_IMAGE_TYPES):
        raise ValueError(f"Unsupported media type: {media_type}")

    logger.info(
        "parse-filled-form calling GPT-4o — media_type=%s data_size=%d chars",
        media_type, len(base64_data),
    )

    # Build content blocks: one image per PDF page, or a single image block
    content: list[dict] = []
    if media_type == PDF_MEDIA_TYPE:
        for page_b64 in _render_pdf_to_images(base64_data):
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:image/png;base64,{page_b64}", "detail": "high"},
            })
    else:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{media_type};base64,{base64_data}", "detail": "high"},
        })

    content.append({"type": "text", "text": PARSE_FILLED_PROMPT})

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=16000,
        messages=[{"role": "user", "content": content}],
    )

    raw_text = response.choices[0].message.content or ""

    if response.choices[0].finish_reason == "length":
        logger.warning("GPT-4o hit max_tokens — attempting JSON repair")
        raw_text = _repair_truncated_json(raw_text)

    json_match = re.search(r"\{[\s\S]*\}", raw_text)
    if not json_match:
        raise ValueError(f"GPT-4o returned no JSON. Raw response:\n{raw_text[:500]}")

    parsed = json.loads(json_match.group())

    sections = parsed.get("sections", [])
    fields = parsed.get("fields", [])
    form_data = parsed.get("formData", {})

    logger.info(
        "parse-filled-form success — sections=%d fields=%d form_data_keys=%d",
        len(sections), len(fields), len(form_data),
    )

    return {
        "template_name": parsed.get("templateName", "Untitled Form"),
        "site_type": parsed.get("siteType", "Unknown"),
        "suggested_site_name": parsed.get("suggestedSiteName", ""),
        "sections": sections,
        "fields": fields,
        "form_data": form_data,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_label(label: str) -> str:
    """
    Normalize a field label for fuzzy comparison.
    Lowercases, strips punctuation and extra whitespace.
    Exported so template_matcher.py can use the same normalization.
    """
    return re.sub(r"[^a-z0-9 ]", "", label.lower()).strip()


def _repair_truncated_json(raw: str) -> str:
    """
    Best-effort repair of JSON cut off mid-stream by a token limit.
    Closes any open string literal, then appends missing brackets/braces.
    Copied from claude_parser.py.
    """
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
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in ("{", "["):
            stack.append(ch)
        elif ch == "}" and stack and stack[-1] == "{":
            stack.pop()
        elif ch == "]" and stack and stack[-1] == "[":
            stack.pop()

    for opener in reversed(stack):
        raw += "]" if opener == "[" else "}"

    return raw
