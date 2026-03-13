import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import type { TemplateField, TemplateSection } from '@/types/siteTemplates';
import { evaluateVisibility } from '@/lib/conditionalLogic';

import TextField from '@/components/formFields/TextField';
import DateField from '@/components/formFields/DateField';
import MultiSelectField from '@/components/formFields/MultiSelectField';
import RadioField from '@/components/formFields/RadioField';
import CoordinatesLatLngField from '@/components/formFields/CoordinatesLatLngField';
import CoordinatesUTMField from '@/components/formFields/CoordinatesUTMField';
import FileUploadField from '@/components/formFields/FileUploadField';
import RepeatingGroupField from '@/components/formFields/RepeatingGroupField';
import SectionHeaderField from '@/components/formFields/SectionHeaderField';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DynamicFormRendererProps {
  sections: TemplateSection[];
  fields: TemplateField[];
  initialValues?: Record<string, unknown>;
  userRole: 'admin' | 'member';
  mode: 'fill' | 'preview';
  onSave?: (values: Record<string, unknown>) => Promise<void>;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
  onChange?: (values: Record<string, unknown>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DynamicFormRenderer({
  sections,
  fields,
  initialValues = {},
  userRole,
  mode,
  onSave,
  onSubmit,
  onChange,
}: DynamicFormRendererProps) {

  // Role filtering — members cannot see protected sections or fields
  const visibleSections = useMemo(
    () => userRole === 'member' ? sections.filter(s => !s.isProtected) : sections,
    [sections, userRole]
  );
  const visibleFields = useMemo(
    () => userRole === 'member' ? fields.filter(f => !f.isProtected) : fields,
    [fields, userRole]
  );

  const { control, handleSubmit, watch, formState: { isSubmitting } } = useForm<Record<string, unknown>>({
    defaultValues: initialValues,
  });

  // Re-evaluate conditional logic whenever any value changes
  const values = watch();
  const visibility = useMemo(
    () => evaluateVisibility(visibleFields, values),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleFields, JSON.stringify(values)]
  );

  // Notify parent of value changes (used for auto-save + progress bar)
  useEffect(() => {
    onChange?.(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  // Collapsed section state
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleSection = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Fields grouped by section, sorted by order
  const fieldsBySection = useMemo(() => {
    const map: Record<string, TemplateField[]> = {};
    for (const section of visibleSections) {
      map[section.id] = visibleFields
        .filter(f => f.sectionId === section.id)
        .sort((a, b) => a.order - b.order);
    }
    return map;
  }, [visibleSections, visibleFields]);

  // ---------------------------------------------------------------------------
  // Field renderer
  // ---------------------------------------------------------------------------

  const renderField = (field: TemplateField) => {
    if (visibility[field.id] === false) return null;

    const props = { field, control, mode };

    switch (field.fieldType) {
      case 'text':
      case 'textarea':
      case 'number':
        return <TextField key={field.id} {...props} />;
      case 'date':
        return <DateField key={field.id} {...props} />;
      // Single-value selection → radio buttons
      case 'select':
      case 'radio':
        return <RadioField key={field.id} {...props} />;
      // Multi-value selection → checkboxes
      case 'multiselect':
      case 'checkbox':
        return <MultiSelectField key={field.id} {...props} />;
      case 'coordinates_latlong':
        return <CoordinatesLatLngField key={field.id} {...props} />;
      case 'coordinates_utm':
        return <CoordinatesUTMField key={field.id} {...props} />;
      case 'file_upload':
        return <FileUploadField key={field.id} {...props} />;
      case 'repeating_group':
        return <RepeatingGroupField key={field.id} {...props} />;
      case 'section_header':
      case 'divider':
        return <SectionHeaderField key={field.id} field={field} />;
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Submit handlers
  // ---------------------------------------------------------------------------

  const handleSave = handleSubmit(async data => {
    await onSave?.(data);
  });

  const handleFinalSubmit = handleSubmit(async data => {
    await onSubmit?.(data);
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <form onSubmit={e => e.preventDefault()} className="space-y-4">

      {visibleSections
        .sort((a, b) => a.order - b.order)
        .map(section => {
          const sectionFields = fieldsBySection[section.id] ?? [];
          const isCollapsed = collapsed.has(section.id);

          return (
            <Card key={section.id}>
              {/* Section header */}
              <CardHeader
                className="cursor-pointer select-none py-3"
                onClick={() => section.isCollapsible && toggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">
                      {section.title}
                    </CardTitle>
                    {section.isProtected && userRole === 'admin' && (
                      <Badge variant="secondary" className="text-xs">Admin Only</Badge>
                    )}
                  </div>
                  {section.isCollapsible && (
                    isCollapsed
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      : <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {/* Section fields */}
              {!isCollapsed && (
                <CardContent className="space-y-5 pt-0">
                  {sectionFields.map(renderField)}
                  {sectionFields.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No fields in this section.</p>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })
      }

      {/* Action buttons — fill mode only */}
      {mode === 'fill' && (onSave || onSubmit) && (
        <div className="flex gap-3 pt-2 justify-end">
          {onSave && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSave}
              disabled={isSubmitting}
            >
              Save Draft
            </Button>
          )}
          {onSubmit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" disabled={isSubmitting}>
                  Submit Form
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit this form?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Once submitted, you won't be able to edit your responses.
                    Make sure all required fields are filled in correctly.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Go back</AlertDialogCancel>
                  <AlertDialogAction onClick={handleFinalSubmit}>
                    Yes, submit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
    </form>
  );
}
