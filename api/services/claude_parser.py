"""
PDF parser pipeline — GPT-4o vision (single-step).

Renders each PDF page to a PNG image using pymupdf, then sends all page
images to GPT-4o in one call. Returns a fully structured SiteTemplate JSON.

Env vars required:
  VITE_AZURE_OPENAI_ENDPOINT         — Azure OpenAI endpoint
  VITE_AZURE_OPENAI_API_KEY          — Azure OpenAI API key
  VITE_AZURE_OPENAI_DEPLOYMENT_NAME  — deployment name (e.g. gpt-5.4-mini)
  VITE_AZURE_OPENAI_API_VERSION      — API version
"""

import base64
import json
import logging
import os
import re
from pathlib import Path
from typing import Any

import fitz  # pymupdf
from openai import AzureOpenAI
from dotenv import load_dotenv


logger = logging.getLogger("archepal.services.claude_parser")

# Load env vars from project root .env (two levels up from api/services/)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

MODEL = os.environ.get("VITE_AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5.4-mini")
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

    client = AzureOpenAI(
        azure_endpoint=os.environ["VITE_AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["VITE_AZURE_OPENAI_API_KEY"],
        api_version=os.environ.get("VITE_AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
    )
    response = client.chat.completions.create(
        model=MODEL,
        max_completion_tokens=16384,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": content}],
    )

    raw_text = response.choices[0].message.content or ""

    if response.choices[0].finish_reason == "length":
        raw_text = _repair_truncated_json(raw_text)

    json_match = re.search(r"\{[\s\S]*\}", raw_text)
    if not json_match:
        raise ValueError(f"GPT-4o returned no JSON. Raw response:\n{raw_text[:500]}")

    json_str = json_match.group()
    try:
        result = json.loads(json_str)
    except json.JSONDecodeError:
        logger.warning("GPT-4o returned malformed JSON — attempting repair")
        json_str = _repair_truncated_json(json_str)
        try:
            result = json.loads(json_str)
        except json.JSONDecodeError as e:
            raise ValueError(f"GPT-4o returned invalid JSON after repair attempt: {e}")

    return _normalize_response(result)


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


# ---------------------------------------------------------------------------
# Response normalizer — handles gpt-5.4-mini pages[] format and type aliases
# ---------------------------------------------------------------------------

_FIELD_TYPE_MAP: dict[str, str] = {
    "checkbox_group": "multiselect",
    "date_or_text":   "date",
    "coordinate":     "text",
    "group":          "text",       # fallback; handled explicitly below
    "table":          "repeating_group",
    # pass-through types (already valid)
    "text": "text", "textarea": "textarea", "number": "number", "date": "date",
    "select": "select", "multiselect": "multiselect", "radio": "radio", "checkbox": "checkbox",
    "coordinates_latlong": "coordinates_latlong", "coordinates_utm": "coordinates_utm",
    "file_upload": "file_upload", "repeating_group": "repeating_group",
    "section_header": "section_header", "divider": "divider",
}


def _map_field_type(raw_type: str) -> str:
    return _FIELD_TYPE_MAP.get(raw_type, "text")


def _normalize_response(raw: dict) -> dict:
    """
    Accepts either the native {templateName, siteType, sections[], fields[]} format
    or the pages[]-based format that gpt-5.4-mini may return without the strict prompt.
    Always returns the native format expected by the router.
    """
    if "pages" in raw and "sections" not in raw:
        logger.info("claude_parser: detected pages[] format — normalizing to sections/fields")
        return _convert_pages_format(raw)

    # Already in native format — light-normalize field types in case of aliases
    if "fields" in raw:
        raw["fields"] = [_normalize_field(f) for f in raw["fields"]]
    return raw


def _normalize_field(field: dict) -> dict:
    """Fix fieldType if model used 'type' key or an aliased type name."""
    if "fieldType" not in field and "type" in field:
        field["fieldType"] = _map_field_type(field.pop("type"))
    elif "fieldType" in field:
        field["fieldType"] = _map_field_type(field["fieldType"])
    if "id" not in field and "name" in field:
        field["id"] = field["name"]
    return field


def _convert_pages_format(raw: dict) -> dict:
    """Convert pages[] → {templateName, siteType, sections[], fields[]}."""
    sections: list[dict] = []
    fields: list[dict] = []
    seen_sections: dict[str, str] = {}
    section_order = 0
    field_order = 0

    for page_obj in raw.get("pages", []):
        section_title = page_obj.get("section", "Unnamed Section")
        is_protected = any(
            kw in section_title.lower()
            for kw in ["office use", "admin", "restricted", "archaeology use"]
        )

        if section_title not in seen_sections:
            section_id = f"section-{section_order}"
            seen_sections[section_title] = section_id
            sections.append({
                "id": section_id,
                "title": section_title,
                "order": section_order,
                "isCollapsible": True,
                "isProtected": is_protected,
            })
            section_order += 1

        section_id = seen_sections[section_title]

        # Section-level table (e.g. Burial/Marker Table on page 5)
        if page_obj.get("type") == "table" or "columns" in page_obj:
            columns = page_obj.get("columns", [])
            group_fields = [
                {
                    "id": col.get("name", f"col-{i}"),
                    "sectionId": section_id,
                    "label": col.get("label", ""),
                    "fieldType": _map_field_type(col.get("type", "text")),
                    "order": i,
                    "isRequired": False,
                    "isHidden": False,
                    "isProtected": False,
                    "options": col.get("options") or None,
                    "placeholder": None,
                    "helpText": None,
                    "conditionalLogic": None,
                }
                for i, col in enumerate(columns)
            ]
            table_id = section_title.lower().replace(" ", "-").replace("/", "-")
            fields.append({
                "id": table_id,
                "sectionId": section_id,
                "label": section_title,
                "fieldType": "repeating_group",
                "order": field_order,
                "isRequired": False,
                "isHidden": False,
                "isProtected": is_protected,
                "options": None,
                "placeholder": None,
                "helpText": None,
                "conditionalLogic": None,
                "groupFields": group_fields,
            })
            field_order += 1
            continue

        # Regular fields list
        for field_obj in page_obj.get("fields", []):
            field_type = field_obj.get("type", "text")
            field_name = field_obj.get("name") or field_obj.get("id") or f"field-{field_order}"
            field_label = field_obj.get("label", "")
            options = field_obj.get("options") or None

            if field_type == "group":
                subfields = field_obj.get("subfields", [])
                sub_names = {sf.get("name", "") for sf in subfields}

                if "latitude" in sub_names or "longitude" in sub_names:
                    # Lat/lng coordinate group
                    fields.append({
                        "id": field_name,
                        "sectionId": section_id,
                        "label": field_label,
                        "fieldType": "coordinates_latlong",
                        "order": field_order,
                        "isRequired": False,
                        "isHidden": False,
                        "isProtected": is_protected,
                        "options": None,
                        "placeholder": None,
                        "helpText": None,
                        "conditionalLogic": None,
                    })
                    field_order += 1
                    if "utm_zone" in sub_names or "utm_easting" in sub_names:
                        fields.append({
                            "id": field_name + "-utm",
                            "sectionId": section_id,
                            "label": field_label + " (UTM)",
                            "fieldType": "coordinates_utm",
                            "order": field_order,
                            "isRequired": False,
                            "isHidden": False,
                            "isProtected": is_protected,
                            "options": None,
                            "placeholder": None,
                            "helpText": None,
                            "conditionalLogic": None,
                        })
                        field_order += 1
                else:
                    # Generic group — flatten subfields as individual text fields
                    for sf in subfields:
                        sf_name = sf.get("name", f"field-{field_order}")
                        fields.append({
                            "id": sf_name,
                            "sectionId": section_id,
                            "label": sf.get("label", ""),
                            "fieldType": _map_field_type(sf.get("type", "text")),
                            "order": field_order,
                            "isRequired": False,
                            "isHidden": False,
                            "isProtected": is_protected,
                            "options": sf.get("options") or None,
                            "placeholder": None,
                            "helpText": None,
                            "conditionalLogic": None,
                        })
                        field_order += 1
            else:
                normalized_field: dict = {
                    "id": field_name,
                    "sectionId": section_id,
                    "label": field_label,
                    "fieldType": _map_field_type(field_type),
                    "order": field_order,
                    "isRequired": field_obj.get("isRequired", False),
                    "isHidden": False,
                    "isProtected": is_protected,
                    "options": options,
                    "placeholder": None,
                    "helpText": None,
                    "conditionalLogic": None,
                }
                fields.append(normalized_field)
                field_order += 1

                # additional_field → separate field shown conditionally on "Other"
                additional = field_obj.get("additional_field")
                if additional:
                    fields.append({
                        "id": additional.get("name", f"field-{field_order}"),
                        "sectionId": section_id,
                        "label": additional.get("label", ""),
                        "fieldType": _map_field_type(additional.get("type", "text")),
                        "order": field_order,
                        "isRequired": False,
                        "isHidden": False,
                        "isProtected": is_protected,
                        "options": None,
                        "placeholder": None,
                        "helpText": None,
                        "conditionalLogic": {
                            "triggerFieldId": field_name,
                            "triggerValue": "Other",
                            "action": "show",
                        },
                    })
                    field_order += 1

    return {
        "templateName": raw.get("document_title") or raw.get("templateName") or "Untitled Form",
        "siteType": raw.get("siteType") or "Unknown",
        "sections": sections,
        "fields": fields,
    }
