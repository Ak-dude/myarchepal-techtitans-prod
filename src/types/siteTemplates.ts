import { Timestamp } from 'firebase/firestore';

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'date'
  | 'select' | 'multiselect' | 'radio' | 'checkbox'
  | 'coordinates_latlong' | 'coordinates_utm'
  | 'file_upload' | 'repeating_group'
  | 'section_header' | 'divider';

export type ConditionalAction = 'show' | 'hide' | 'require';

export interface ConditionalRule {
  triggerFieldId: string;
  triggerValue: string | boolean | string[];
  action: ConditionalAction;
}

export interface TemplateField {
  id: string;
  sectionId: string;
  label: string;
  fieldType: FieldType;
  order: number;
  isRequired: boolean;
  isHidden: boolean;
  isProtected: boolean;        // hidden from MEMBER role entirely
  defaultValue?: unknown;
  options?: string[];          // for select/multiselect/radio/checkbox
  conditionalLogic?: ConditionalRule;
  placeholder?: string;
  helpText?: string;
  groupFields?: Omit<TemplateField, 'groupFields'>[];  // for repeating_group
}

export interface TemplateSection {
  id: string;
  title: string;
  order: number;
  isCollapsible: boolean;
  isProtected: boolean;        // e.g. "Office of State Archaeology Use"
}

export type TemplateSourceType = 'pdf_digitized' | 'customized' | 'blank_canvas';
export type TemplateStatus = 'draft' | 'published';

export interface SiteTemplate {
  id: string;
  orgId: string;
  name: string;
  siteType: string;
  sourceType: TemplateSourceType;
  status: TemplateStatus;
  sourcePdfStoragePath?: string;
  createdBy: string;           // Firebase Auth UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
  fieldCount: number;          // denormalized for list views
  isSystemTemplate?: boolean;  // true = shipped default, cannot be deleted
}
