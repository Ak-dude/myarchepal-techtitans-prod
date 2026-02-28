import type { TemplateField } from '@/types/siteTemplates';

export type ReliabilityLabel = 'Complete' | 'Incomplete' | 'Unreliable';

export interface ReliabilityResult {
  /** 0–100: percentage of non-protected required fields that are filled */
  score: number;
  label: ReliabilityLabel;
}

/**
 * Determine the data reliability of a form submission.
 *
 * Complete   → score === 100
 * Incomplete → 50 ≤ score < 100
 * Unreliable → score < 50
 */
export function calculateReliability(
  fields: TemplateField[],
  formData: Record<string, unknown>,
): ReliabilityResult {
  const required = fields.filter(f => f.isRequired && !f.isProtected && !f.isHidden);
  if (required.length === 0) return { score: 100, label: 'Complete' };

  const filled = required.filter(f => {
    const v = formData[f.id];
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') {
      // Coordinate objects: at least one sub-value must be non-empty
      return Object.values(v as Record<string, unknown>).some(
        sv => sv !== '' && sv !== null && sv !== undefined,
      );
    }
    return true;
  });

  const score = Math.round((filled.length / required.length) * 100);

  let label: ReliabilityLabel;
  if (score >= 100) label = 'Complete';
  else if (score >= 50) label = 'Incomplete';
  else label = 'Unreliable';

  return { score, label };
}
