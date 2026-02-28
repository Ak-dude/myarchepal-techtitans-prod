import { z } from 'zod';

/** Validates a string that must parse as a finite number. */
const floatStr = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine(v => !isNaN(parseFloat(v)) && isFinite(parseFloat(v)), {
      message: `${label} must be a valid number`,
    });

export const LatLngSchema = z.object({
  lat: floatStr('Latitude').refine(
    v => { const n = parseFloat(v); return n >= -90 && n <= 90; },
    { message: 'Latitude must be between -90 and 90' },
  ),
  lng: floatStr('Longitude').refine(
    v => { const n = parseFloat(v); return n >= -180 && n <= 180; },
    { message: 'Longitude must be between -180 and 180' },
  ),
});

export const UTMSchema = z.object({
  zone: z
    .string()
    .min(1, 'Zone is required')
    .regex(/^\d{1,2}[A-Za-z]$/, 'Zone must be like "17S"'),
  easting: floatStr('Easting').refine(
    v => parseFloat(v) > 0,
    { message: 'Easting must be a positive number' },
  ),
  northing: floatStr('Northing').refine(
    v => parseFloat(v) > 0,
    { message: 'Northing must be a positive number' },
  ),
  datum: z.string().min(1),
});

export type LatLngValue = z.infer<typeof LatLngSchema>;
export type UTMValue = z.infer<typeof UTMSchema>;
