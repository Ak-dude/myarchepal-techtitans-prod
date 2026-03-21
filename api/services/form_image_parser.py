"""
Form image parser — GPT-4o vision.

Sends a photo/scan of a filled paper form to GPT-4o along with the template
field definitions, and returns extracted values as { fieldId: value } JSON.

Env vars required:
  OPENAI_API_KEY   — OpenAI API key
"""

import json
import logging
import os
import re
from typing import Any

from openai import OpenAI

logger = logging.getLogger("archepal.services.form_image_parser")

MODEL = "gpt-4o"

ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _build_prompt(fields: list[dict]) -> str:
    lines = []
    for f in fields:
        line = f'  id="{f["id"]}"  label="{f["label"]}"  type="{f["fieldType"]}"'
        if f.get("options"):
            line += f'  options={json.dumps(f["options"])}'
        lines.append(line)

    return f"""\
You are reading a filled-out archaeological site recording form from a photograph or scan.

The form has these fields:
{chr(10).join(lines)}

Extract the value written or selected for each field from the image.

Rules:
- Return ONLY valid JSON — no markdown fences, no explanation.
- The JSON must be a single flat object: {{"fieldId": value, ...}}
- Use the exact field id (not the label) as the key.
- text / textarea / number: return the written value as a string (or number for number type).
- date: return "YYYY-MM-DD" if the date is clear, otherwise return the text as written.
- radio / select: return the chosen option string — must exactly match one of the listed options.
- multiselect / checkbox: return an array of selected option strings.
- coordinates_latlong: return {{"lat": number, "lng": number}}.
- coordinates_utm: return {{"zone": "string", "easting": "string", "northing": "string"}}.
- If a field is blank, illegible, or not visible, omit it entirely — do NOT include null values.
- Only include fields you can actually read from the image.

Return the JSON object now:"""


def parse_form_image_with_claude(
    base64_image: str,
    media_type: str,
    fields: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Send a base64-encoded image of a filled form to Claude Sonnet 4.6.
    Returns a dict of { fieldId: extractedValue } for every readable field.
    """
    if media_type not in ALLOWED_MEDIA_TYPES:
        raise ValueError(f"Unsupported media type: {media_type}")

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=4000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{media_type};base64,{base64_image}",
                            "detail": "high",
                        },
                    },
                    {
                        "type": "text",
                        "text": _build_prompt(fields),
                    },
                ],
            }
        ],
    )

    raw_text = response.choices[0].message.content or ""

    json_match = re.search(r"\{[\s\S]*\}", raw_text)
    if not json_match:
        raise ValueError(f"GPT-4o returned no JSON. Raw response:\n{raw_text[:500]}")

    return json.loads(json_match.group())
