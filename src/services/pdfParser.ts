import type { TemplateField, TemplateSection } from '@/types/siteTemplates';

export interface ParsedTemplate {
  templateName: string;
  siteType: string;
  sections: TemplateSection[];
  fields: TemplateField[];
}

/** Convert a File to a raw base64 string (no data-URI prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip the "data:application/pdf;base64," prefix
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a PDF to the FastAPI backend, which sends it to Claude Sonnet 4.6
 * via Azure AI Foundry and returns the extracted form template structure.
 */
export async function parsePdfTemplate(
  file: File,
  orgId: string
): Promise<ParsedTemplate> {
  const base64Pdf = await fileToBase64(file);

  const res = await fetch('/api/parse-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64_pdf: base64Pdf,
      file_name: file.name,
      org_id: orgId,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`PDF parsing failed (${res.status}): ${detail}`);
  }

  const data = await res.json();

  return {
    templateName: data.template_name,
    siteType: data.site_type,
    sections: data.sections as TemplateSection[],
    fields: data.fields as TemplateField[],
  };
}
