import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FieldComponentProps } from './_types';

/** Inline validate function — keeps coordinate sub-field errors clear. */
function validateLatLng(v: LatLng | undefined, isRequired: boolean): true | string {
  const empty = !v || (!v.lat && !v.lng);
  if (empty) return isRequired ? 'Coordinates are required' : true;

  if (v.lat) {
    const n = parseFloat(v.lat);
    if (isNaN(n)) return 'Latitude must be a valid number';
    if (n < -90 || n > 90) return 'Latitude must be between -90 and 90';
  }
  if (v.lng) {
    const n = parseFloat(v.lng);
    if (isNaN(n)) return 'Longitude must be a valid number';
    if (n < -180 || n > 180) return 'Longitude must be between -180 and 180';
  }
  if (isRequired) {
    if (!v.lat) return 'Latitude is required';
    if (!v.lng) return 'Longitude is required';
  }
  return true;
}

interface LatLng { lat: string; lng: string; }

/** Handles fieldType: coordinates_latlong */
export default function CoordinatesLatLngField({ field, control, mode }: FieldComponentProps) {
  const [locating, setLocating] = useState(false);
  const disabled = mode === 'preview';

  return (
    <Controller
      name={field.id}
      control={control}
      defaultValue={field.defaultValue ?? { lat: '', lng: '' }}
      rules={{ validate: (v: LatLng | undefined) => validateLatLng(v, field.isRequired) }}
      render={({ field: rhf, fieldState }) => {
        const value = (rhf.value as LatLng) ?? { lat: '', lng: '' };

        const update = (patch: Partial<LatLng>) =>
          rhf.onChange({ ...value, ...patch });

        const useGPS = () => {
          if (!navigator.geolocation) {
            toast.error('Geolocation is not supported on this device.');
            return;
          }
          setLocating(true);
          navigator.geolocation.getCurrentPosition(
            pos => {
              update({
                lat: pos.coords.latitude.toFixed(6),
                lng: pos.coords.longitude.toFixed(6),
              });
              setLocating(false);
            },
            () => {
              toast.error('Could not get location. Please enter coordinates manually.');
              setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        };

        return (
          <div className="space-y-2">
            <Label>
              {field.label}
              {field.isRequired && <span className="text-destructive ml-1">*</span>}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor={`${field.id}-lat`} className="text-xs text-muted-foreground">
                  Latitude
                </Label>
                <Input
                  id={`${field.id}-lat`}
                  type="number"
                  step="any"
                  placeholder="e.g. 35.7796"
                  disabled={disabled}
                  value={value.lat}
                  onChange={e => update({ lat: e.target.value })}
                  onBlur={rhf.onBlur}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${field.id}-lng`} className="text-xs text-muted-foreground">
                  Longitude
                </Label>
                <Input
                  id={`${field.id}-lng`}
                  type="number"
                  step="any"
                  placeholder="e.g. -78.6382"
                  disabled={disabled}
                  value={value.lng}
                  onChange={e => update({ lng: e.target.value })}
                  onBlur={rhf.onBlur}
                />
              </div>
            </div>
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useGPS}
                disabled={locating}
              >
                {locating
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Locating…</>
                  : <><MapPin className="h-3.5 w-3.5 mr-1.5" />Use GPS</>
                }
              </Button>
            )}
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
