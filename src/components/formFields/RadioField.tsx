import { Controller } from 'react-hook-form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { FieldComponentProps } from './_types';

/** Handles fieldType: radio */
export default function RadioField({ field, control, mode }: FieldComponentProps) {
  const options = field.options ?? [];

  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={field.defaultValue ?? ''}
      render={({ field: rhf, fieldState }) => (
        <div className="space-y-2">
          <Label>
            {field.label}
            {field.isRequired && <span className="text-destructive ml-1">*</span>}
          </Label>
          <RadioGroup
            value={(rhf.value as string) ?? ''}
            onValueChange={mode === 'preview' ? undefined : rhf.onChange}
            disabled={mode === 'preview'}
            className="flex flex-wrap gap-x-6 gap-y-2"
          >
            {options.map(option => (
              <div key={option} className="flex items-center gap-2">
                <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                <Label htmlFor={`${field.id}-${option}`} className="font-normal cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
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
