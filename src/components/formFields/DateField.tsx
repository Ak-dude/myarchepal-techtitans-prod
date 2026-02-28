import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldComponentProps } from './_types';

/** Handles fieldType: date */
export default function DateField({ field, control, mode }: FieldComponentProps) {
  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={field.defaultValue ?? ''}
      render={({ field: rhf, fieldState }) => (
        <div className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label}
            {field.isRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={field.id}
            type="date"
            disabled={mode === 'preview'}
            value={(rhf.value as string) ?? ''}
            onChange={rhf.onChange}
            onBlur={rhf.onBlur}
          />
          {field.helpText && (
            <p className="text-xs text-muted-foreground">{field.helpText}</p>
          )}
          {fieldState.error && (
            <p className="text-xs text-destructive">{fieldState.error.message}</p>
          )}
        </div>
      )}
    />
  );
}
