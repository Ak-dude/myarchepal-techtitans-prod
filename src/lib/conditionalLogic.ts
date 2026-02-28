import type { TemplateField } from '@/types/siteTemplates';

/**
 * Evaluates which fields should be visible given the current form values.
 *
 * - action 'show'    → field is hidden by default; shown only when trigger matches
 * - action 'hide'    → field is visible by default; hidden when trigger matches
 * - action 'require' → visibility unaffected (requiredness is handled separately)
 *
 * Returns a map of fieldId → isVisible.
 */
export function evaluateVisibility(
  fields: TemplateField[],
  values: Record<string, unknown>
): Record<string, boolean> {
  const visibility: Record<string, boolean> = {};

  for (const field of fields) {
    if (!field.conditionalLogic) {
      visibility[field.id] = true;
      continue;
    }

    const { triggerFieldId, triggerValue, action } = field.conditionalLogic;
    const currentValue = values[triggerFieldId];

    // Multiselect values are arrays — check inclusion; scalar values use equality
    const conditionMet = Array.isArray(currentValue)
      ? currentValue.includes(triggerValue)
      : currentValue === triggerValue;

    if (action === 'show') {
      visibility[field.id] = conditionMet;
    } else if (action === 'hide') {
      visibility[field.id] = !conditionMet;
    } else {
      // 'require' — field is always visible; requiredness handled by form validation
      visibility[field.id] = true;
    }
  }

  return visibility;
}

/**
 * Returns a set of fieldIds that are dynamically required based on conditional logic.
 */
export function evaluateDynamicRequired(
  fields: TemplateField[],
  values: Record<string, unknown>
): Set<string> {
  const required = new Set<string>();

  for (const field of fields) {
    if (field.isRequired) {
      required.add(field.id);
      continue;
    }
    if (field.conditionalLogic?.action === 'require') {
      const { triggerFieldId, triggerValue } = field.conditionalLogic;
      const currentValue = values[triggerFieldId];
      const conditionMet = Array.isArray(currentValue)
        ? currentValue.includes(triggerValue)
        : currentValue === triggerValue;
      if (conditionMet) required.add(field.id);
    }
  }

  return required;
}
