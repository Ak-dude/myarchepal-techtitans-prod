/**
 * FieldEditor — right-panel property editor for a single TemplateField.
 * Used by both TemplateEditor (/templates/:id/edit) and TemplateBuilder (/templates/new/blank).
 */
import { useEffect, useState, useCallback } from 'react';
import { Trash2, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import type { TemplateField, FieldType, ConditionalAction } from '@/types/siteTemplates';

// ---------------------------------------------------------------------------
// Constants (exported so palette can use them)
// ---------------------------------------------------------------------------

export const FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'number', 'date',
  'select', 'multiselect', 'radio', 'checkbox',
  'coordinates_latlong', 'coordinates_utm',
  'file_upload', 'repeating_group',
  'section_header', 'divider',
];

const CONDITIONAL_ACTIONS: ConditionalAction[] = ['show', 'hide', 'require'];
const TYPES_WITH_OPTIONS: FieldType[] = ['select', 'multiselect', 'radio', 'checkbox'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FieldEditorProps {
  field: TemplateField;
  allFields: TemplateField[];
  /** Local-only update (state only, no Firestore write). */
  onUpdate: (id: string, patch: Partial<TemplateField>) => void;
  /** Update + immediately persist to Firestore (for toggles & selects). */
  onUpdateAndSave: (id: string, patch: Partial<TemplateField>) => void;
  /** Called on input blur to persist the current field state. */
  onBlurSave: (field: TemplateField) => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// OptionsEditor (internal)
// ---------------------------------------------------------------------------

function OptionsEditor({
  options,
  onSave,
}: {
  options: string[];
  /** Called when the options array changes (on blur or add/remove). */
  onSave: (opts: string[]) => void;
}) {
  // Local state so typing doesn't trigger a Firestore save on every keystroke.
  // Re-sync from props only when the set of options changes (e.g. field switched).
  const [local, setLocal] = useState<string[]>(options);
  const optKey = options.join('\x00');
  useEffect(() => { setLocal(options); }, [optKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (next: string[]) => { setLocal(next); onSave(next); };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Options
      </Label>
      {local.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No options yet — click "Add option" below.</p>
      )}
      <div className="space-y-1.5">
        {local.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={opt}
              placeholder={`Option ${i + 1}`}
              className="h-7 text-sm flex-1"
              onChange={e => {
                const next = [...local];
                next[i] = e.target.value;
                setLocal(next); // local only while typing
              }}
              onBlur={() => onSave(local)} // persist on blur
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => commit(local.filter((_, idx) => idx !== i))}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={() => commit([...local, ''])}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add option
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldEditor
// ---------------------------------------------------------------------------

export default function FieldEditor({
  field,
  allFields,
  onUpdate,
  onUpdateAndSave,
  onBlurSave,
  onDelete,
}: FieldEditorProps) {
  const [localLabel, setLocalLabel] = useState(field.label);
  const [localPlaceholder, setLocalPlaceholder] = useState(field.placeholder ?? '');
  const [localHelpText, setLocalHelpText] = useState(field.helpText ?? '');

  // Reset local text when field selection changes
  useEffect(() => {
    setLocalLabel(field.label);
    setLocalPlaceholder(field.placeholder ?? '');
    setLocalHelpText(field.helpText ?? '');
  }, [field.id]);

  const hasOptions = TYPES_WITH_OPTIONS.includes(field.fieldType);
  const isLayoutType = ['section_header', 'divider'].includes(field.fieldType);
  const isComplexType = ['coordinates_latlong', 'coordinates_utm', 'file_upload', 'repeating_group'].includes(field.fieldType);

  const saveOptions = useCallback(
    (opts: string[]) => onUpdateAndSave(field.id, { options: opts }),
    [field.id, onUpdateAndSave],
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Field Properties</h3>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete field?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{field.label}</strong> will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={onDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Separator />

      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Label</Label>
        <Input
          value={localLabel}
          onChange={e => setLocalLabel(e.target.value)}
          onBlur={() => {
            onUpdate(field.id, { label: localLabel });
            onBlurSave({ ...field, label: localLabel });
          }}
          className="h-8 text-sm"
        />
      </div>

      {/* Field Type */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Field Type</Label>
        <Select
          value={field.fieldType}
          onValueChange={val => onUpdateAndSave(field.id, { fieldType: val as FieldType })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map(t => (
              <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Options editor — shown immediately after Field Type for visibility */}
      {hasOptions && (
        <>
          <Separator />
          <OptionsEditor
            key={field.id}
            options={field.options ?? []}
            onSave={saveOptions}
          />
        </>
      )}

      {/* Flags — skip for layout types */}
      {!isLayoutType && (
        <>
          <Separator />
          <div className="space-y-2.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flags</Label>
            {([
              { key: 'isRequired', label: 'Required' },
              { key: 'isHidden', label: 'Hidden' },
              { key: 'isProtected', label: 'Admin Only (Protected)' },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="text-sm font-normal">{label}</Label>
                <Switch
                  checked={!!field[key]}
                  onCheckedChange={v => onUpdateAndSave(field.id, { [key]: v })}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Placeholder + Help Text — only for simple text-like types */}
      {!isLayoutType && !isComplexType && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Placeholder</Label>
            <Input
              value={localPlaceholder}
              placeholder="Optional hint text…"
              onChange={e => setLocalPlaceholder(e.target.value)}
              onBlur={() => {
                onUpdate(field.id, { placeholder: localPlaceholder });
                onBlurSave({ ...field, placeholder: localPlaceholder });
              }}
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Help Text — for all types */}
      {!isLayoutType && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Help Text</Label>
          <Textarea
            value={localHelpText}
            placeholder="Optional guidance shown below the field…"
            rows={2}
            onChange={e => setLocalHelpText(e.target.value)}
            onBlur={() => {
              onUpdate(field.id, { helpText: localHelpText });
              onBlurSave({ ...field, helpText: localHelpText });
            }}
            className="text-sm resize-none"
          />
        </div>
      )}

      {/* Conditional Logic */}
      {!isLayoutType && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Conditional Logic
            </Label>
            <p className="text-xs text-muted-foreground">
              Show, hide, or require this field based on another field's value.
            </p>

            {/* Trigger field */}
            <Select
              value={field.conditionalLogic?.triggerFieldId ?? '__none__'}
              onValueChange={val => {
                if (val === '__none__') {
                  onUpdateAndSave(field.id, { conditionalLogic: undefined });
                } else {
                  onUpdateAndSave(field.id, {
                    conditionalLogic: {
                      triggerFieldId: val,
                      triggerValue: field.conditionalLogic?.triggerValue ?? '',
                      action: field.conditionalLogic?.action ?? 'show',
                    },
                  });
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Trigger field…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-sm text-muted-foreground">
                  No condition
                </SelectItem>
                {allFields
                  .filter(f => f.id !== field.id && !['section_header', 'divider'].includes(f.fieldType))
                  .map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-sm">
                      {f.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {field.conditionalLogic && (
              <>
                <Select
                  value={field.conditionalLogic.action}
                  onValueChange={val =>
                    onUpdateAndSave(field.id, {
                      conditionalLogic: { ...field.conditionalLogic!, action: val as ConditionalAction },
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONAL_ACTIONS.map(a => (
                      <SelectItem key={a} value={a} className="text-sm capitalize">{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="when value equals…"
                  className="h-8 text-sm"
                  value={String(field.conditionalLogic.triggerValue ?? '')}
                  onChange={e =>
                    onUpdateAndSave(field.id, {
                      conditionalLogic: { ...field.conditionalLogic!, triggerValue: e.target.value },
                    })
                  }
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
