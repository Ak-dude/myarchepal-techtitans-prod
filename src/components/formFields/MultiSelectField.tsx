import { Controller } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { FieldComponentProps } from './_types';

/** Handles fieldType: multiselect | checkbox */
export default function MultiSelectField({ field, control, mode }: FieldComponentProps) {
  const disabled = mode === 'preview';

  // Single boolean checkbox — only when there are NO options
  // (GPT-4o sometimes sets fieldType:"checkbox" but still provides options[] for a
  // grouped check-all-that-apply list; fall through to the multi-option path in that case)
  if (field.fieldType === 'checkbox' && !(field.options?.length)) {
    return (
      <Controller
        name={field.id}
        control={control}
        defaultValue={field.defaultValue ?? false}
        render={({ field: rhf }) => (
          <div className="flex items-start gap-2">
            <Checkbox
              id={field.id}
              checked={!!rhf.value}
              onCheckedChange={disabled ? undefined : rhf.onChange}
              disabled={disabled}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor={field.id} className="font-normal cursor-pointer leading-snug">
                {field.label}
                {field.isRequired && <span className="text-destructive ml-1">*</span>}
              </Label>
              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
            </div>
          </div>
        )}
      />
    );
  }

  // Multi-option checkboxes (multiselect, or checkbox with an options list)
  const options = field.options ?? [];

  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={field.defaultValue ?? []}
      render={({ field: rhf, fieldState }) => {
        const selected: string[] = Array.isArray(rhf.value) ? (rhf.value as string[]) : [];

        const toggle = (option: string) => {
          if (disabled) return;
          const next = selected.includes(option)
            ? selected.filter(v => v !== option)
            : [...selected, option];
          rhf.onChange(next);
        };

        return (
          <div className="space-y-2">
            <Label>
              {field.label}
              {field.isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            {options.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No options configured for this field.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.map(option => (
                <div key={option} className="flex items-center gap-2">
                  <Checkbox
                    id={`${field.id}-${option}`}
                    checked={selected.includes(option)}
                    onCheckedChange={() => toggle(option)}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor={`${field.id}-${option}`}
                    className="font-normal cursor-pointer text-sm"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </div>
            {field.helpText && (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            )}
            {fieldState.error && (
              <p className="text-xs text-destructive">{fieldState.error.message}</p>
            )}
          </div>
        );
      }}
    />
  );
}
