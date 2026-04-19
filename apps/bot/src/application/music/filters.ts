import type { FilterOptions } from 'shoukaku';

export type FilterName = 'off' | 'bassboost' | 'nightcore' | 'eightd';

/**
 * Curated filter presets. Each maps a human-facing name to a Shoukaku
 * FilterOptions payload. `off` is handled separately in the controller
 * (clears all filters by passing {} to setFilters).
 */
export const FILTER_PRESETS: Record<Exclude<FilterName, 'off'>, FilterOptions> = {
  bassboost: {
    equalizer: [
      { band: 0, gain: 0.25 },
      { band: 1, gain: 0.25 },
      { band: 2, gain: 0.2 },
      { band: 3, gain: 0.1 },
      { band: 4, gain: 0 },
      { band: 5, gain: -0.05 },
      { band: 6, gain: -0.1 },
    ],
  },
  nightcore: {
    timescale: {
      speed: 1.2,
      pitch: 1.2,
      rate: 1,
    },
  },
  eightd: {
    rotation: {
      rotationHz: 0.2,
    },
  },
};
