import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { FieldComponentProps } from './_types';

interface UTMValue { zone: string; easting: string; northing: string; datum: string; }

/** Inline validate function for UTM coordinates. */
function validateUTM(v: UTMValue | undefined, isRequired: boolean): true | string {
  const empty = !v || (!v.zone && !v.easting && !v.northing);
  if (empty) return isRequired ? 'Coordinates are required' : true;

  if (v.zone && !/^\d{1,2}[A-Za-z]$/.test(v.zone)) return 'Zone must be like "17S"';
  if (v.easting) {
    const n = parseFloat(v.easting);
    if (isNaN(n)) return 'Easting must be a valid number';
    if (n <= 0) return 'Easting must be a positive number';
  }
  if (v.northing) {
    const n = parseFloat(v.northing);
    if (isNaN(n)) return 'Northing must be a valid number';
    if (n <= 0) return 'Northing must be a positive number';
  }
  if (isRequired) {
    if (!v.zone) return 'Zone is required';
    if (!v.easting) return 'Easting is required';
    if (!v.northing) return 'Northing is required';
  }
  return true;
}

/** Handles fieldType: coordinates_utm */
export default function CoordinatesUTMField({ field, control, mode }: FieldComponentProps) {
  const disabled = mode === 'preview';

  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={field.defaultValue ?? { zone: '', easting: '', northing: '', datum: 'NAD83' }}
      rules={{ validate: (v: UTMValue | undefined) => validateUTM(v, field.isRequired) }}
      render={({ field: rhf, fieldState }) => {
        const value = (rhf.value as UTMValue) ?? { zone: '', easting: '', northing: '', datum: 'NAD83' };
        const update = (patch: Partial<UTMValue>) => rhf.onChange({ ...value, ...patch });

        return (
          <div className="space-y-2">
            <Label>
              {field.label}
              {field.isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Zone</Label>
                <Input
                  placeholder="e.g. 17S"
                  disabled={disabled}
                  value={value.zone}
                  onChange={e => update({ zone: e.target.value })}
                  onBlur={rhf.onBlur}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Easting</Label>
                <Input
                  type="number"
                  placeholder="e.g. 712000"
                  disabled={disabled}
                  value={value.easting}
                  onChange={e => update({ easting: e.target.value })}
                  onBlur={rhf.onBlur}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Northing</Label>
                <Input
                  type="number"
                  placeholder="e.g. 3960000"
                  disabled={disabled}
                  value={value.northing}
                  onChange={e => update({ northing: e.target.value })}
                  onBlur={rhf.onBlur}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Datum</Label>
              <RadioGroup
                value={value.datum}
                onValueChange={disabled ? undefined : v => update({ datum: v })}
                disabled={disabled}
                className="flex gap-4"
              >
                {['NAD27', 'NAD83'].map(d => (
                  <div key={d} className="flex items-center gap-1.5">
                    <RadioGroupItem value={d} id={`${field.id}-${d}`} />
                    <Label htmlFor={`${field.id}-${d}`} className="font-normal cursor-pointer">{d}</Label>
                  </div>
                ))}
              </RadioGroup>
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
