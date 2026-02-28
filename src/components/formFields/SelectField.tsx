import { Controller } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { FieldComponentProps } from './_types';

/** Handles fieldType: select */
export default function SelectField({ field, control, mode }: FieldComponentProps) {
  const options = field.options ?? [];

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
          <Select
            value={(rhf.value as string) ?? ''}
            onValueChange={mode === 'preview' ? undefined : rhf.onChange}
            disabled={mode === 'preview'}
          >
            <SelectTrigger id={field.id}>
              <SelectValue placeholder={field.placeholder ?? `Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map(option => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
