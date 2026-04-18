import { z } from 'zod';

/** Lavalink v4 filter payload shape. Subset we expose to users. */
export const audioFiltersSchema = z.object({
  volume: z.number().min(0).max(5).optional(),
  equalizer: z
    .array(
      z.object({
        band: z.number().int().min(0).max(14),
        gain: z.number().min(-0.25).max(1),
      }),
    )
    .max(15)
    .optional(),
  karaoke: z
    .object({
      level: z.number().min(0).max(2).default(1),
      monoLevel: z.number().min(0).max(2).default(1),
      filterBand: z.number().default(220),
      filterWidth: z.number().default(100),
    })
    .optional(),
  timescale: z
    .object({
      speed: z.number().min(0.1).max(3).default(1),
      pitch: z.number().min(0.1).max(3).default(1),
      rate: z.number().min(0.1).max(3).default(1),
    })
    .optional(),
  tremolo: z
    .object({
      frequency: z.number().min(0).max(14).default(2),
      depth: z.number().min(0).max(1).default(0.5),
    })
    .optional(),
  vibrato: z
    .object({
      frequency: z.number().min(0).max(14).default(2),
      depth: z.number().min(0).max(1).default(0.5),
    })
    .optional(),
  rotation: z.object({ rotationHz: z.number().default(0.2) }).optional(),
  distortion: z
    .object({
      sinOffset: z.number().default(0),
      sinScale: z.number().default(1),
      cosOffset: z.number().default(0),
      cosScale: z.number().default(1),
      tanOffset: z.number().default(0),
      tanScale: z.number().default(1),
      offset: z.number().default(0),
      scale: z.number().default(1),
    })
    .optional(),
  lowPass: z.object({ smoothing: z.number().min(1).max(100).default(20) }).optional(),
});
export type AudioFilters = z.infer<typeof audioFiltersSchema>;

export const filterPresetSchema = z.enum([
  'none',
  'bassboost',
  'nightcore',
  'vaporwave',
  '8d',
  'karaoke',
  'pop',
  'rock',
  'jazz',
  'classical',
]);
export type FilterPreset = z.infer<typeof filterPresetSchema>;
