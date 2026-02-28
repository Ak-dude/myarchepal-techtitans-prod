import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { FieldComponentProps } from './_types';

/** Handles fieldType: text | textarea | number */
export default function TextField({ field, control, mode }: FieldComponentProps) {
  const disabled = mode === 'preview';

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

          {field.fieldType === 'textarea' ? (
            <Textarea
              id={field.id}
              placeholder={field.placeholder ?? ''}
              disabled={disabled}
              value={(rhf.value as string) ?? ''}
              onChange={rhf.onChange}
              onBlur={rhf.onBlur}
              rows={3}
            />
          ) : (
            <Input
              id={field.id}
              type={field.fieldType === 'number' ? 'number' : 'text'}
              placeholder={field.placeholder ?? ''}
              disabled={disabled}
              value={(rhf.value as string | number) ?? ''}
              onChange={rhf.onChange}
              onBlur={rhf.onBlur}
            />
          )}

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
