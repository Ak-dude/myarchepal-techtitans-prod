import type { Control } from 'react-hook-form';
import type { TemplateField } from '@/types/siteTemplates';

export interface FieldComponentProps {
  field: TemplateField;
  control: Control<Record<string, unknown>>;
  mode: 'fill' | 'preview';
}
